import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { 
  performCashfreePayout,
  CreateBeneficiaryRequestV2,
  CreateTransferRequestV2
} from "@/lib/cashfree";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { applicationId, amount } = await req.json();
    if (!applicationId || !amount) {
      return NextResponse.json({ error: "applicationId and amount are required" }, { status: 400 });
    }

    // 1. Fetch application + user bank details
    const { data: app, error: appErr } = await supabase
      .from("applications")
      .select(`
        id, application_id, user_id,
        users(id, full_name, email, phone, bank_account_number, bank_ifsc, bank_account_name, cashfree_bene_id)
      `)
      .eq("application_id", applicationId)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const userRow = app.users as any;
    if (!userRow?.bank_account_number || !userRow?.bank_ifsc) {
      return NextResponse.json(
        { error: "User has no bank details registered. Ask them to complete onboarding." },
        { status: 422 }
      );
    }

    // 2. Perform payout (using shared helper)
    const { ok, status: payStatus, data: payData, transferId, beneId } = await performCashfreePayout({
      applicationId,
      amount: Number(amount),
      userRow
    });
    console.log("[cashfree transfer] response:", JSON.stringify(payData));
    const transferJson = payData as any;

    if (!ok) {
      console.error("[cashfree transfer] FAILED:", transferJson);
      return NextResponse.json({ 
        error: transferJson.message ?? "Transfer initiation failed", 
        code: transferJson.code,
        description: transferJson.status_description,
        raw: transferJson 
      }, { status: payStatus || 502 });
    }

    if (!userRow.cashfree_bene_id) {
      await supabase.from("users").update({ cashfree_bene_id: beneId }).eq("id", userRow.id);
    }

    // 4. Update application with transfer details
    const referenceId = transferJson.cf_transfer_id;
    console.log(`[initiate-payout] Updating DB for ${applicationId}:`, {
      cashfree_transfer_id:  transferId,
      cashfree_reference_id: referenceId,
      payout_status:         "PENDING"
    });

    const { error: updateErr, count } = await supabase
      .from("applications")
      .update({
        cashfree_transfer_id:  transferId,
        payout_status:         "PENDING",
        payout_initiated_at:   new Date().toISOString(),
      })
      .eq("id", app.id)
      .select();

    if (updateErr) {
      console.error("[initiate-payout] Supabase update FAILED:", updateErr);
      return NextResponse.json({ error: "Transfer was successful but failed to update application status in database: " + updateErr.message }, { status: 500 });
    }

    console.log(`[initiate-payout] Supabase update SUCCESS. Rows updated:`, count ?? 1);

    return NextResponse.json({ 
      success: true, 
      transferId, 
      referenceId, 
      beneId, 
      status: transferJson.status,
      description: transferJson.status_description 
    });
  } catch (err: any) {
    console.error("[initiate-payout]", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
