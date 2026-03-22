import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getCashfreeV2Headers, BASE_URL } from "@/lib/cashfree";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, bankAccount, ifsc, phone, email } = body as {
      name: string; bankAccount: string; ifsc: string; phone: string; email: string;
    };

    if (!name || !bankAccount || !ifsc) {
      return NextResponse.json({ error: "name, bankAccount and ifsc are required" }, { status: 400 });
    }

    const beneId = `EXPIFY_${user.id}`;

    // 2. Create beneficiary on Cashfree (v2 — uses x-client-id/secret directly)
    const cfRes = await fetch(`${BASE_URL}/payout/beneficiary`, {
      method: "POST",
      headers: getCashfreeV2Headers(),
      body: JSON.stringify({
        beneficiary_id:      beneId,
        beneficiary_name:    name,
        beneficiary_email:   email || user.email,
        beneficiary_phone:   (phone ?? "").replace(/\D/g, ""),
        bank_account_number: bankAccount,
        bank_ifsc:           ifsc.toUpperCase(),
        beneficiary_address: "India",
      }),
    });
    const cfJson = await cfRes.json();
    console.log("[add-beneficiary] Cashfree response:", JSON.stringify(cfJson));

    // 409 / beneficiary_exists = already exists, treat as success
    const alreadyExists = cfRes.status === 409 || cfJson.code === "beneficiary_already_exists";
    if (!cfRes.ok && !alreadyExists) {
      console.error("[add-beneficiary] Cashfree error:", cfJson);
      return NextResponse.json(
        { error: cfJson.message ?? "Failed to register bank account with payment provider." },
        { status: 502 }
      );
    }

    // 3. Save bank details in Supabase users table
    const { error: dbErr } = await supabase
      .from("users")
      .update({
        cashfree_bene_id:    beneId,
        bank_account_number: bankAccount,
        bank_ifsc:           ifsc.toUpperCase(),
        bank_account_name:   name,
        bank_verified:       true,
      })
      .eq("id", user.id);

    if (dbErr) {
      console.error("[add-beneficiary] DB error:", dbErr);
      return NextResponse.json({ error: dbErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, beneId });
  } catch (err: any) {
    console.error("[add-beneficiary]", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
