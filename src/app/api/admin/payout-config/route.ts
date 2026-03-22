import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    if (!await requireAdmin(supabase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { data, error } = await supabase
      .from("payout_config")
      .select("auto_payout_enabled, fixed_amount, updated_at")
      .eq("id", 1)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[payout-config GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!await requireAdmin(supabase)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json();
    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (typeof body.auto_payout_enabled === "boolean") update.auto_payout_enabled = body.auto_payout_enabled;
    if (typeof body.fixed_amount === "number" && body.fixed_amount > 0) update.fixed_amount = body.fixed_amount;

    const { data, error } = await supabase
      .from("payout_config")
      .update(update)
      .eq("id", 1)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[payout-config PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
