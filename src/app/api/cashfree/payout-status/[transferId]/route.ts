import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTransferStatusV2, mapCashfreeStatus } from "@/lib/cashfree";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ transferId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { transferId } = await params;

    const { ok, status: httpStatus, data: json } = await getTransferStatusV2(transferId);

    if (!ok) {
      return NextResponse.json({ 
        error: json.message ?? "Failed to fetch transfer status", 
        raw: json 
      }, { status: httpStatus });
    }

    const mappedStatus = mapCashfreeStatus(json.status, json.status_code);

    // If terminal, update the application record
    if (mappedStatus === "SUCCESS" || mappedStatus === "FAILURE" || mappedStatus === "REVERSED") {
      await supabase
        .from("applications")
        .update({
          payout_status: mappedStatus,
          payout_completed_at: json.updated_on || new Date().toISOString(),
        })
        .eq("cashfree_transfer_id", transferId);
    }

    return NextResponse.json({
      transferId,
      status: json.status,
      statusCode: json.status_code,
      mappedStatus,
      utr:    json.transfer_utr    ?? null,
      amount: json.transfer_amount ?? null,
      raw:    json,
    });
  } catch (err: any) {
    console.error("[payout-status]", err);
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
