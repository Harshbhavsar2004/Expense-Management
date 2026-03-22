import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabase
      .from("applications")
      .select(`
        id, application_id, client_name, city, status,
        reimbursable_amount, total_claimed, submitted_at,
        cashfree_transfer_id, payout_status, payout_initiated_at, payout_completed_at,
        user_id,
        users(id, full_name, email, phone, bank_account_number, bank_ifsc, bank_account_name, cashfree_bene_id, bank_verified)
      `)
      .eq("status", "approved")
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("[approved apps]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data ?? []);
  } catch (err) {
    console.error("[approved apps]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
