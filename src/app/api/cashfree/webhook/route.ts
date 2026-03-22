import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";

const CLIENT_SECRET = process.env.CASHFREE_CLIENT_SECRET ?? "";

// Cashfree webhook signature verification:
// HMAC-SHA256(timestamp + rawBody, CLIENT_SECRET) → base64 → compare with x-webhook-signature
function verifySignature(timestamp: string, rawBody: string, signature: string): boolean {
  const signed = createHmac("sha256", CLIENT_SECRET)
    .update(timestamp + rawBody)
    .digest("base64");
  return signed === signature;
}

// Map Cashfree event → payout_status value
const EVENT_STATUS: Record<string, string> = {
  TRANSFER_SUCCESS:  "SUCCESS",
  TRANSFER_FAILED:   "FAILURE",
  TRANSFER_REVERSED: "REVERSED",
};

export async function POST(req: NextRequest) {
  try {
    const rawBody  = await req.text();
    const timestamp = req.headers.get("x-webhook-timestamp") ?? "";
    const signature = req.headers.get("x-webhook-signature") ?? "";

    // Verify signature (skip verification if secret not configured — dev only)
    if (CLIENT_SECRET && signature) {
      if (!verifySignature(timestamp, rawBody, signature)) {
        console.warn("[webhook] Signature mismatch — rejecting request");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event: string = payload?.event ?? "";
    const transferId: string = payload?.data?.transfer?.transferId ?? "";

    if (!transferId) {
      return NextResponse.json({ received: true, skipped: "no transferId" });
    }

    const newStatus = EVENT_STATUS[event];
    if (!newStatus) {
      // Unhandled event type — acknowledge and ignore
      return NextResponse.json({ received: true, skipped: `unhandled event: ${event}` });
    }

    const supabase = await createClient();
    const update: Record<string, any> = { payout_status: newStatus };
    if (newStatus === "SUCCESS") {
      update.payout_completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("applications")
      .update(update)
      .eq("cashfree_transfer_id", transferId);

    if (error) {
      console.error("[webhook] DB update error:", error);
      // Still return 200 so Cashfree doesn't retry unnecessarily
    } else {
      console.log(`[webhook] ${event} → ${newStatus} for transfer ${transferId}`);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[webhook]", err);
    // Always return 200 to prevent Cashfree retries on our parse errors
    return NextResponse.json({ received: true });
  }
}
