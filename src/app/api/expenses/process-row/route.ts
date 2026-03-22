import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { analyseReceipt } from "@/app/api/whatsapp/vision";
import { uploadReceiptImage } from "@/app/api/whatsapp/db";
import type { ParsedExcelRow } from "../parse-excel/route";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";

function buildAuditPrompt(params: {
  expenseId: string;
  userId: string;
  userPhone: string;
  userName: string;
  expenseType: string;
  city: string;
  cityTier: string;
  visitDuration: string;
  amount: number;
  receiptTotal: number;
  receiptDate: string;
  receiptStatus: string;
  utrNumber: string;
}) {
  return [
    `Perform a full 9-rule audit on this expense claim.`,
    ``,
    `Expense ID: ${params.expenseId}`,
    `User ID: ${params.userId}`,
    `User Phone: ${params.userPhone}`,
    `Employee: ${params.userName}`,
    `Category: ${params.expenseType}`,
    `City: ${params.city}`,
    `City Tier: ${params.cityTier}`,
    `Visit Duration: ${params.visitDuration}`,
    `Participants: 1`,
    `Claimed Amount: ${params.amount}`,
    `Receipt Total: ${params.receiptTotal}`,
    `Receipt Date: ${params.receiptDate}`,
    `Receipt Status: ${params.receiptStatus}`,
    `UTR Number: ${params.utrNumber}`,
    ``,
    `Apply all 9 mismatch rules using the pre-computed facts. Call set_audit_result exactly once with your verdict.`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase.from("users").select("phone, full_name").eq("id", user.id).single();

    const body = await req.json() as {
      row: ParsedExcelRow;
      applicationId: string;
      clientName: string;
      city: string;
      cityTier: string;
      visitDuration: string;
    };

    const { row, applicationId, clientName, city, cityTier, visitDuration } = body;
    const userPhone = profile?.phone ?? "";
    const userName  = profile?.full_name ?? "Unknown";
    const sessionId = `excel-import-${Date.now()}`;

    // ── 1. Vision agent: extract receipt data from proof image ─────────────
    let receiptData = { amount: "0", utrNumber: "", date: "", status: "UNKNOWN", merchant: "", rawDescription: "" };
    let imageUrl: string | null = null;

    if (row.imageBase64 && row.imageMimeType) {
      try {
        const extracted = await analyseReceipt(row.imageBase64, row.imageMimeType);
        receiptData = {
          amount:        extracted.amount ?? String(row.amount),
          utrNumber:     extracted.utrNumber ?? "",
          date:          extracted.date ?? row.date,
          status:        extracted.status ?? "UNKNOWN",
          merchant:      extracted.merchant ?? row.description,
          rawDescription: extracted.rawDescription ?? "",
        };
        // Upload image to Supabase storage
        imageUrl = await uploadReceiptImage(row.imageBase64, row.imageMimeType, userPhone || user.id, row.rowIndex);
      } catch (e) {
        console.error("[ProcessRow] Vision error:", e);
      }
    }

    const receiptTotal  = parseFloat(receiptData.amount.replace(/[^0-9.]/g, "")) || row.amount;
    const amountMatch   = Math.abs(receiptTotal - row.amount) < 1;
    const normalizedDate = row.date; // already parsed from Excel

    // ── 2. Insert expense ──────────────────────────────────────────────────
    const { data: expenseData, error: expErr } = await supabase
      .from("expenses")
      .insert({
        user_id:                user.id,
        user_phone:             userPhone,
        user_name:              userName,
        session_id:             sessionId,
        application_id:         applicationId,
        client_name:            clientName,
        visit_duration:         visitDuration,
        date_range:             normalizedDate,
        normalized_date_range:  normalizedDate,
        expense_type:           row.description,
        sub_category:           "",
        claimed_amount:         `₹${row.amount}`,
        claimed_amount_numeric: row.amount,
        participant_type:       "single",
        participant_count:      1,
        participant_names:      [row.members || "Self"],
        verified:               false,
        verified_at:            new Date().toISOString(),
        mismatches:             [],
        total_receipt_amount:   receiptTotal,
        amount_match:           amountMatch,
        date_match:             true,
        city,
        city_tier:              cityTier,
      })
      .select("id")
      .single();

    if (expErr || !expenseData) {
      console.error("[ProcessRow] Expense insert error:", expErr);
      return NextResponse.json({ error: expErr?.message ?? "Failed to create expense" }, { status: 500 });
    }

    const expenseId = expenseData.id;

    // Insert receipt row if we have image data
    if (imageUrl || row.imageBase64) {
      await supabase.from("receipts").insert({
        expense_id:       expenseId,
        user_id:          user.id,
        media_id:         sessionId,
        image_url:        imageUrl ?? null,
        extracted_amount: receiptTotal,
        utr_number:       receiptData.utrNumber,
        transaction_id:   "",
        payment_method:   "UPI",
        merchant:         receiptData.merchant,
        transaction_date: receiptData.date,
        transaction_time: "",
        status:           receiptData.status,
        raw_description:  receiptData.rawDescription,
      });
    }

    // ── 3. Trigger audit agent (fire-and-forget style — we wait for result) ─
    let auditResult: any = null;
    try {
      const prompt = buildAuditPrompt({
        expenseId,
        userId:        user.id,
        userPhone,
        userName,
        expenseType:   row.description,
        city,
        cityTier,
        visitDuration,
        amount:        row.amount,
        receiptTotal,
        receiptDate:   receiptData.date || row.date,
        receiptStatus: receiptData.status,
        utrNumber:     receiptData.utrNumber || "not provided",
      });

      const auditRes = await fetch(`${AGENT_URL}/audit/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          thread_id: `audit-${expenseId}`,
          run_id:    crypto.randomUUID(),
          agent_name: "AuditAgent",
          messages: [{ id: crypto.randomUUID(), role: "user", content: prompt, created_at: Math.floor(Date.now() / 1000) }],
          actions: [], state: null, context: [], tools: [], forwarded_props: {},
        }),
      });

      if (auditRes.ok) {
        // Read the SSE stream to get STATE_SNAPSHOT
        const reader = auditRes.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let state: Record<string, unknown> = {};

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const raw = line.slice(6).trim();
              if (!raw || raw === "[DONE]") continue;
              try {
                const event = JSON.parse(raw);
                if (event.type === "STATE_SNAPSHOT" && event.snapshot) state = event.snapshot;
              } catch {}
            }
          }
          auditResult = state?.audit_output ?? null;
        }
      }
    } catch (auditErr) {
      console.error("[ProcessRow] Audit error:", auditErr);
    }

    return NextResponse.json({ expenseId, auditResult, receiptStatus: receiptData.status });
  } catch (err) {
    console.error("[ProcessRow] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
