import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: payouts, error } = await supabase
      .from("applications")
      .select(`
        id, 
        application_id, 
        total_claimed, 
        reimbursable_amount, 
        payout_status, 
        payout_initiated_at, 
        cashfree_transfer_id
      `)
      .eq("user_id", user.id)
      .not("cashfree_transfer_id", "is", null)
      .order("payout_initiated_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(payouts ?? []);
  } catch (err) {
    console.error("[API] user/payouts error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
