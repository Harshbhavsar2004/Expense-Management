import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const category = searchParams.get("category");

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    let query = supabase
      .from("expenses")
      .select(
        `id, created_at, user_name, user_phone, date_range, expense_type,
         sub_category, claimed_amount, claimed_amount_numeric,
         participant_type, participant_count, participant_names,
         verified, verified_at, mismatches,
         total_receipt_amount, amount_match, date_match,
         audit_explanation, audit_timeline, city, city_tier,
         receipts(id, image_url, extracted_amount, transaction_date, transaction_time)`
      )
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    if (from) {
      query = query.gte("created_at", new Date(from).toISOString());
    }
    if (to) {
      // Include full day by going to end of the "to" day
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      query = query.lte("created_at", toDate.toISOString());
    }
    if (category && category !== "all") {
      query = query.eq("expense_type", category);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[API] Error fetching expenses:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[API] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
