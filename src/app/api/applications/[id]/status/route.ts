import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { performCashfreePayout } from "@/lib/cashfree";

// Categories treated as "meal" for daily-cap grouping
const MEAL_KEYWORDS = ["food", "meal", "breakfast", "lunch", "dinner", "dining", "restaurant", "cafe", "snack", "tiffin", "canteen"];
const isMeal = (type: string) => MEAL_KEYWORDS.some((k) => (type ?? "").toLowerCase().includes(k));

// Tags that make an expense unreimbursable
const BLOCKING_TAGS = new Set(["duplicate_receipt", "failed_screenshot", "receipt_quality_issue"]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status } = body;

    if (!["submitted", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const updateData: Record<string, any> = { status };

    if (status === "submitted") {
      updateData.submitted_at = new Date().toISOString();

      // ── 1. Fetch application (need user_id + city_tier for policy) ─────
      const { data: app } = await supabase
        .from("applications")
        .select("user_id, city_tier")
        .eq("application_id", id)
        .single();

      // ── 2. Fetch user policy via SECURITY DEFINER RPC ─────────────────
      let dailyMealLimit = 450; // fallback (Tier III default)
      if (app?.user_id) {
        const { data: policyRows } = await supabase
          .rpc("get_effective_policy", { p_user_id: app.user_id });
        const policy = Array.isArray(policyRows) ? policyRows[0] : policyRows;
        if (policy) {
          const tier = (app.city_tier ?? "").toLowerCase().replace(/[-\s]+/g, " ").trim();
          if (tier.includes("tier i") && !tier.includes("tier ii") && !tier.includes("tier iii")) {
            dailyMealLimit = Number(policy.effective_meal_tier1_limit ?? 900);
          } else if (tier.includes("tier ii") && !tier.includes("tier iii")) {
            dailyMealLimit = Number(policy.effective_meal_tier2_limit ?? 700);
          } else {
            dailyMealLimit = Number(policy.effective_meal_tier3_limit ?? 450);
          }
        }
      }

      // ── 3. Fetch all expenses ─────────────────────────────────────────
      const { data: expenses, error: expErr } = await supabase
        .from("expenses")
        .select("id, claimed_amount_numeric, reimbursable_amount, mismatches, verified, expense_type, date_range, normalized_date_range")
        .eq("application_id", id);

      if (!expErr && expenses) {
        // Base reimbursable per expense (from audit agent, or full claimed if not yet audited)
        const reimbMap = new Map<string, number>();
        for (const exp of expenses) {
          const tags: string[] = Array.isArray(exp.mismatches) ? exp.mismatches : [];
          const blocked = tags.some((t) => BLOCKING_TAGS.has(t));
          if (blocked) {
            reimbMap.set(exp.id, 0);
          } else if (exp.reimbursable_amount != null) {
            // Trust the value the audit agent computed (already capped per-expense)
            reimbMap.set(exp.id, Number(exp.reimbursable_amount));
          } else {
            // Not yet audited — use full claimed amount
            reimbMap.set(exp.id, Number(exp.claimed_amount_numeric ?? 0));
          }
        }

        // ── 4. Daily meal cap across expenses ──────────────────────────
        // Group meal expenses by date. If the day's total exceeds the
        // daily cap, scale each meal's reimbursable proportionally.
        const mealsByDate = new Map<string, typeof expenses>();
        for (const exp of expenses) {
          if (!isMeal(exp.expense_type ?? "")) continue;
          const date = exp.date_range || exp.normalized_date_range || "unknown";
          if (!mealsByDate.has(date)) mealsByDate.set(date, []);
          mealsByDate.get(date)!.push(exp);
        }

        for (const [, dayExps] of mealsByDate) {
          const dayTotal = dayExps.reduce((s, e) => s + (reimbMap.get(e.id) ?? 0), 0);
          if (dayTotal > dailyMealLimit && dailyMealLimit > 0) {
            // Scale down proportionally — each meal gets its fair share of the cap
            const ratio = dailyMealLimit / dayTotal;
            for (const exp of dayExps) {
              const cur = reimbMap.get(exp.id) ?? 0;
              reimbMap.set(exp.id, Math.round(cur * ratio));
            }
          }
        }

        // ── 5. Persist updated reimbursable_amount back to each expense ─
        for (const exp of expenses) {
          const newReimb = reimbMap.get(exp.id) ?? 0;
          if (newReimb !== Number(exp.reimbursable_amount ?? -1)) {
            await supabase
              .from("expenses")
              .update({ reimbursable_amount: newReimb })
              .eq("id", exp.id);
          }
        }

        // ── 6. Compute application-level summary ───────────────────────
        let totalClaimed       = 0;
        let reimbursableAmount = 0;
        let reimbursableCount  = 0;
        let flaggedCount       = 0;

        for (const exp of expenses) {
          const amount = Number(exp.claimed_amount_numeric ?? 0);
          const reimb  = reimbMap.get(exp.id) ?? 0;
          const tags: string[] = Array.isArray(exp.mismatches) ? exp.mismatches : [];

          totalClaimed += amount;
          reimbursableAmount += reimb;

          if (tags.length === 0 || exp.verified === true) {
            reimbursableCount += 1;
          } else {
            flaggedCount += 1;
          }
        }

        updateData.total_claimed       = totalClaimed;
        updateData.reimbursable_amount = reimbursableAmount;
        updateData.reimbursable_count  = reimbursableCount;
        updateData.flagged_count       = flaggedCount;
      }
    }

    const { error } = await supabase
      .from("applications")
      .update(updateData)
      .eq("application_id", id);

    if (error) {
      console.error("[API] Error updating application status:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── 7. Auto-Payout Trigger ─────────────────────────────────────────
    if (status === "approved") {
      try {
        // a. Fetch payout config
        const { data: config } = await supabase.from("payout_config").select("*").eq("id", 1).single();
        
        if (config?.auto_payout_enabled) {
          const reimbAmt = updateData.reimbursable_amount ?? 0;
          
          if (reimbAmt > 0 && reimbAmt <= config.fixed_amount) {
            console.log(`[auto-payout] Triggering for ${id}, amount: ${reimbAmt}`);
            
            // b. Fetch user details for payout
            const { data: appWithUser } = await supabase
              .from("applications")
              .select("id, application_id, user_id, users(*)")
              .eq("application_id", id)
              .single();

            if (!appWithUser) {
              console.error(`[auto-payout] Application ${id} not found for payout`);
              return;
            }
            
            const userRow = appWithUser.users as any;
            if (userRow?.bank_account_number && userRow?.bank_ifsc) {
              const { ok, data: payData, transferId, beneId } = await performCashfreePayout({
                applicationId: id,
                amount: reimbAmt,
                userRow
              });

              if (ok) {
                const transferJson = payData as any;
                // c. Update application & user
                const { error: updErr } = await supabase.from("applications").update({
                  cashfree_transfer_id:  transferId,
                  payout_status:         "PENDING",
                  payout_initiated_at:   new Date().toISOString(),
                }).eq("id", appWithUser.id);

                if (updErr) {
                  console.error(`[auto-payout] Supabase update FAILED for ${id}:`, updErr);
                }

                if (!userRow.cashfree_bene_id) {
                  await supabase.from("users").update({ cashfree_bene_id: beneId }).eq("id", userRow.id);
                }
                console.log(`[auto-payout] SUCCESS for ${id}`);
              } else {
                console.error(`[auto-payout] FAILED for ${id}:`, payData);
              }
            }
          } else {
            console.log(`[auto-payout] Skipped for ${id}: amount ${reimbAmt} exceeds threshold ${config.fixed_amount}`);
          }
        }
      } catch (payoutErr) {
        console.error("[auto-payout] unexpected error:", payoutErr);
      }
    }

    return NextResponse.json({
      success:            true,
      reimbursable_amount: updateData.reimbursable_amount,
      reimbursable_count:  updateData.reimbursable_count,
      flagged_count:       updateData.flagged_count,
      total_claimed:       updateData.total_claimed,
    });
  } catch (err) {
    console.error("[API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
