import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET — fetch global policy defaults
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("global_policy")
      .select("*")
      .single();

    if (error && error.code === "PGRST116") {
      // No row yet — return defaults
      return NextResponse.json({
        meal_tier1_limit: 900,
        meal_tier2_limit: 700,
        meal_tier3_limit: 450,
        travel_allowed: true,
        travel_daily_limit: null,
        hotel_allowed: true,
        hotel_daily_limit: null,
        requires_receipt: true,
        reimbursement_cycle: "15-25 of month",
        custom_notes: null,
      });
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — save global policy and apply to all users
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const payload = {
      meal_tier1_limit: Number(body.meal_tier1_limit),
      meal_tier2_limit: Number(body.meal_tier2_limit),
      meal_tier3_limit: Number(body.meal_tier3_limit),
      travel_allowed: Boolean(body.travel_allowed),
      travel_daily_limit: body.travel_daily_limit ? Number(body.travel_daily_limit) : null,
      hotel_allowed: Boolean(body.hotel_allowed),
      hotel_daily_limit: body.hotel_daily_limit ? Number(body.hotel_daily_limit) : null,
      requires_receipt: Boolean(body.requires_receipt),
      reimbursement_cycle: String(body.reimbursement_cycle || "15-25 of month"),
      custom_notes: body.custom_notes || null,
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    };

    // Upsert global_policy (single row, id = 1)
    const { error: gpError } = await supabase
      .from("global_policy")
      .upsert({ id: 1, ...payload }, { onConflict: "id" });
    if (gpError) return NextResponse.json({ error: gpError.message }, { status: 500 });

    // Apply base values to ALL users' policies
    const { error: bulkError } = await supabase
      .from("policies")
      .update({
        meal_tier1_limit: payload.meal_tier1_limit,
        meal_tier2_limit: payload.meal_tier2_limit,
        meal_tier3_limit: payload.meal_tier3_limit,
        travel_allowed: payload.travel_allowed,
        travel_daily_limit: payload.travel_daily_limit,
        hotel_allowed: payload.hotel_allowed,
        hotel_daily_limit: payload.hotel_daily_limit,
        requires_receipt: payload.requires_receipt,
        reimbursement_cycle: payload.reimbursement_cycle,
        custom_notes: payload.custom_notes,
      })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // update all rows

    if (bulkError) return NextResponse.json({ error: bulkError.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
