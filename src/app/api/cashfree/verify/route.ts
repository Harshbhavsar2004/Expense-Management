import { NextResponse } from "next/server";
import { getCashfreeToken } from "@/lib/cashfree";

export async function GET() {
  try {
    if (!process.env.CASHFREE_CLIENT_ID || !process.env.CASHFREE_CLIENT_SECRET) {
      return NextResponse.json({
        ok: false,
        error: "CASHFREE_CLIENT_ID or CASHFREE_CLIENT_SECRET is missing from environment variables.",
      }, { status: 500 });
    }

    const token = await getCashfreeToken();

    return NextResponse.json({
      ok: true,
      message: "Cashfree Payout credentials are valid.",
      base_url: process.env.CASHFREE_PAYOUT_BASE_URL ?? "https://payout-gamma.cashfree.com",
      client_id: process.env.CASHFREE_CLIENT_ID.slice(0, 6) + "****",
      signature_enabled: !!process.env.CASHFREE_PUBLIC_KEY,
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
