import { supabase } from "@/lib/supabase";
import type { ExpenseRecord } from "./types";

/**
 * Saves an expense record and its associated receipts to Supabase.
 * Returns the created expense ID or null.
 */
export async function saveExpenseToSupabase(record: ExpenseRecord): Promise<string | null> {
  try {
    // 1. Insert the main expense record
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        user_phone: record.meta.userPhone,
        user_name: record.meta.userName,
        session_id: record.meta.sessionId,
        date_range: record.expense.dateRange,
        normalized_date_range: record.expense.normalizedDateRange,
        expense_type: record.expense.type,
        sub_category: record.expense.subCategory,
        claimed_amount: record.expense.claimedAmount,
        claimed_amount_numeric: record.expense.claimedAmountNumeric,
        participant_type: record.expense.participants.type,
        participant_count: record.expense.participants.count,
        participant_names: record.expense.participants.names,
        verified: record.verification.verified,
        verified_at: record.verification.verifiedAt,
        mismatches: record.verification.mismatches,
        total_receipt_amount: record.receipts.totalExtractedAmount,
        amount_match: record.receipts.amountMatch,
        date_match: record.receipts.dateMatch,
        city: record.expense.city,
        city_tier: record.expense.cityTier,
        audit_explanation: record.verification.auditExplanation,
        audit_timeline: record.verification.auditTimeline,
      })
      .select("id")
      .single();

    if (expenseError) {
      console.error("[DB] Error inserting expense:", expenseError);
      return null;
    }

    const expenseId = expenseData.id;

    // 2. Insert associated receipts if any
    if (record.receipts.items.length > 0) {
      const receiptRows = record.receipts.items.map((r) => ({
        expense_id: expenseId,
        media_id: r.mediaId,
        extracted_amount: r.extractedAmount,
        utr_number: r.utrNumber,
        transaction_id: r.transactionId,
        payment_method: r.paymentMethod,
        merchant: r.merchant,
        transaction_date: r.transactionDate,
        status: r.status,
        raw_description: r.rawDescription,
      }));

      const { error: receiptsError } = await supabase
        .from("receipts")
        .insert(receiptRows);

      if (receiptsError) {
        console.error("[DB] Error inserting receipts:", receiptsError);
      }
    }

    console.log(`[DB] Successfully saved expense record: ${expenseId}`);
    return expenseId;
  } catch (err) {
    console.error("[DB] Unexpected error during Supabase save:", err);
    return null;
  }
}

// ── Query types ───────────────────────────────────────────────────────────────
export type ExpenseRow = {
  id: string;
  created_at: string;
  date_range: string;
  expense_type: string;
  sub_category?: string;
  claimed_amount: string;
  participant_type: string;
  participant_names: string[];
  verified: boolean;
  mismatches: string[];
  total_receipt_amount: number;
  city?: string;
  city_tier?: string;
  audit_explanation?: string;
  audit_timeline?: string[];
};

/**
 * Fetch the last N expenses submitted by a phone number.
 */
export async function getRecentExpenses(
  phone: string,
  limit = 10
): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, created_at, date_range, expense_type, sub_category, claimed_amount, participant_type, participant_names, verified, mismatches, total_receipt_amount, city, city_tier, audit_explanation, audit_timeline"
    )
    .eq("user_phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[DB] getRecentExpenses error:", error);
    return [];
  }
  return (data ?? []) as ExpenseRow[];
}

/**
 * Fetch expenses recorded between two UTC ISO timestamps.
 */
export async function getExpensesInDateRange(
  phone: string,
  fromIso: string,
  toIso: string
): Promise<ExpenseRow[]> {
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, created_at, date_range, expense_type, sub_category, claimed_amount, participant_type, participant_names, verified, mismatches, total_receipt_amount, city, city_tier, audit_explanation, audit_timeline"
    )
    .eq("user_phone", phone)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[DB] getExpensesInDateRange error:", error);
    return [];
  }
  return (data ?? []) as ExpenseRow[];
}
