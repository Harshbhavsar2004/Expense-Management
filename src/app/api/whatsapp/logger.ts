// ─────────────────────────────────────────────────────────────────────────────
// logger.ts — Structured JSON console logger for expense records
// ─────────────────────────────────────────────────────────────────────────────

import type { ExpenseSession, ExpenseRecord } from "./types";
import { saveExpenseToSupabase } from "./db";

export function logExpenseRecord(
  phone: string,
  session: ExpenseSession,
  verified: boolean,
  mismatches: string[] = []
): void {
  const receipts = session.extractedReceipts ?? [];
  const totalExtracted = session.totalReceiptAmount ?? 0;
  const claimedNumeric = session.amountNumeric ?? 0;

  const record: ExpenseRecord = {
    meta: {
      recordedAt: new Date().toISOString(),
      userPhone: phone,
      userName: session.userName ?? "Unknown",
      sessionId: `EXP-${phone}-${Date.now()}`,
    },
    expense: {
      dateRange: session.dateRange ?? "",
      normalizedDateRange: session.dateRange ?? "",
      type: session.expenseType ?? "",
      subCategory: session.subCategory,
      claimedAmount: session.amount ?? "",
      claimedAmountNumeric: claimedNumeric,
      participants: {
        type: session.personType ?? "single",
        count: session.personType === "multiple" ? (session.personCount ?? 1) : 1,
        names: session.personNames ?? ["Self"],
      },
    },
    receipts: {
      count: receipts.length,
      totalExtractedAmount: totalExtracted,
      amountMatch: Math.abs(totalExtracted - claimedNumeric) < 1,
      dateMatch: !mismatches.includes("date"),
      items: receipts.map((r, i) => ({
        mediaId: session.receiptMediaIds?.[i] ?? "",
        extractedAmount: r.amount ?? "Not extracted",
        utrNumber: r.utrNumber ?? "Not found",
        transactionId: r.transactionId ?? "Not found",
        paymentMethod: r.paymentMethod ?? "Unknown",
        merchant: r.merchant ?? "Unknown",
        transactionDate: r.date ?? "Unknown",
        status: r.status ?? "Unknown",
        rawDescription: r.rawDescription ?? "",
      })),
    },
    verification: {
      verified,
      verifiedAt: new Date().toISOString(),
      mismatches,
    },
  };

  const divider = "=".repeat(66);
  console.log(`\n${divider}`);
  console.log("  FRISTINE INFOTECH - EXPENSE RECORD");
  console.log(divider);
  console.log(JSON.stringify(record, null, 2));
  console.log(divider);

  // Attempt to save to Supabase asynchronously (static import, more reliable in Next.js)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[DB] Supabase credentials missing — skipping DB save.");
    console.log(`${divider}\n`);
    return;
  }

  saveExpenseToSupabase(record)
    .then((supabaseId) => {
      if (supabaseId) {
        console.log(`[DB] Record persisted in Supabase ID: ${supabaseId}`);
      } else {
        console.error("[DB] Supabase save returned null — check DB logs above for the error details.");
      }
      console.log(`${divider}\n`);
    })
    .catch((err) => {
      console.error("[DB] Unexpected error during Supabase save:", err);
      console.log(`${divider}\n`);
    });
}

