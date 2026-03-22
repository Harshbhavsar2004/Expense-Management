import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { getCashfreeToken, BASE_URL } from "@/lib/cashfree";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const token = await getCashfreeToken();

    const res = await fetch(`${BASE_URL}/v1/getBalance`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();

    if (!res.ok || json.status !== "SUCCESS") {
      return NextResponse.json(
        { error: json.message ?? "Failed to fetch balance" },
        { status: res.status }
      );
    }

    return NextResponse.json({
      ledgerBalance:    json.data?.balance          ?? 0,
      availableBalance: json.data?.availableBalance ?? 0,
    });
  } catch (err: any) {
    console.error("[cashfree-balance]", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
