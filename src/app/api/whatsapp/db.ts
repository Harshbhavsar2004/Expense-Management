import { supabase } from "@/lib/supabase";
import type { ExpenseRecord, ApplicationRecord } from "./types";

/**
 * Uploads a receipt image (base64) to Supabase Storage bucket "receipts".
 * Returns the public URL or null on failure.
 */
export async function uploadReceiptImage(
  base64: string,
  mimeType: string,
  phone: string,
  index: number,
  supabaseClient?: any
): Promise<string | null> {
  const client = supabaseClient || supabase;
  try {
    const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const fileName = `${phone}/${Date.now()}_${index}.${ext}`;
    const buffer = Buffer.from(base64, "base64");

    const { error } = await client.storage
      .from("receipts")
      .upload(fileName, buffer, { contentType: mimeType, upsert: false });

    if (error) {
      console.error("[DB] Storage upload error:", error.message);
      return null;
    }

    const { data: urlData } = client.storage
      .from("receipts")
      .getPublicUrl(fileName);

    console.log(`[DB] Receipt image uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl ?? null;
  } catch (err) {
    console.error("[DB] Unexpected error in uploadReceiptImage:", err);
    return null;
  }
}

/**
 * Saves an expense record and its associated receipts to Supabase.
 * Returns the created expense ID or null.
 */
export async function saveExpenseToSupabase(record: ExpenseRecord, userId?: string, supabaseClient?: any): Promise<string | null> {
  const client = supabaseClient || supabase;
  try {
    // 1. Insert the main expense record
    const { data: expenseData, error: expenseError } = await client
      .from("expenses")
      .insert({
        user_id: userId,
        user_phone: record.meta.userPhone,
        user_name: record.meta.userName,
        session_id: record.meta.sessionId,
        application_id: record.expense.applicationId,
        client_name: record.expense.clientName,
        visit_duration: record.expense.visitDuration,
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
        user_id: userId,
        media_id: r.mediaId,
        image_url: r.imageUrl ?? null,
        extracted_amount: r.extractedAmount,
        utr_number: r.utrNumber,
        transaction_id: r.transactionId,
        payment_method: r.paymentMethod,
        merchant: r.merchant,
        transaction_date: r.transactionDate,
        transaction_time: r.transactionTime,
        status: r.status,
        raw_description: r.rawDescription,
      }));

      const { error: receiptsError } = await client
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

/**
 * Saves a new application (trip/project) record to Supabase.
 */
export async function saveApplicationToSupabase(app: ApplicationRecord, userId?: string, supabaseClient?: any): Promise<boolean> {
  const client = supabaseClient || supabase;
  try {
    const { error } = await client
      .from("applications")
      .insert({
        user_id: userId,
        user_phone: app.userPhone,
        application_id: app.applicationId,
        client_name: app.clientName,
        visit_duration: app.visitDuration,
        city: app.city,
        city_tier: app.cityTier,
        participant_count: app.participantCount,
        participant_details: app.participantDetails
      });

    if (error) {
      console.error("[DB] Error saving application:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[DB] Unexpected error during application save:", err);
    return false;
  }
}

// ── Query types ───────────────────────────────────────────────────────────────
export type ExpenseRow = {
  id: string;
  created_at: string;
  user_phone?: string;
  user_name?: string;
  application_id?: string;
  client_name?: string;
  visit_duration?: string;
  date_range: string;
  expense_type: string;
  sub_category?: string;
  claimed_amount: string;
  claimed_amount_numeric?: number;
  participant_type: string;
  participant_count?: number;
  participant_names: string[];
  verified: boolean;
  mismatches: string[];
  total_receipt_amount: number;
  amount_match?: boolean;
  date_match?: boolean;
  city?: string;
  city_tier?: string;
  audit_explanation?: string;
  audit_timeline?: string[];
  receipts?: { transaction_time?: string }[];
};

/**
 * Fetch the last N expenses submitted by a phone number.
 */
export async function getRecentExpenses(
  phone: string,
  limit = 10,
  userId?: string,
  supabaseClient?: any
): Promise<ExpenseRow[]> {
  const client = supabaseClient || supabase;
  let query = client
    .from("expenses")
    .select(
      "id, created_at, user_name, user_phone, application_id, client_name, visit_duration, date_range, expense_type, sub_category, claimed_amount, claimed_amount_numeric, participant_type, participant_count, participant_names, verified, mismatches, total_receipt_amount, amount_match, date_match, city, city_tier, audit_explanation, audit_timeline, receipts(transaction_time)"
    )
    .eq("user_phone", phone);

  if (userId) query = query.eq("user_id", userId);
  
  const { data, error } = await query
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
  toIso: string,
  userId?: string,
  supabaseClient?: any
): Promise<ExpenseRow[]> {
  const client = supabaseClient || supabase;
  let query = client
    .from("expenses")
    .select(
      "id, created_at, user_name, user_phone, application_id, client_name, visit_duration, date_range, expense_type, sub_category, claimed_amount, claimed_amount_numeric, participant_type, participant_count, participant_names, verified, mismatches, total_receipt_amount, amount_match, date_match, city, city_tier, audit_explanation, audit_timeline, receipts(transaction_time)"
    )
    .eq("user_phone", phone)
    .gte("created_at", fromIso)
    .lte("created_at", toIso);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[DB] getExpensesInDateRange error:", error);
    return [];
  }
  return (data ?? []) as ExpenseRow[];
}

/**
 * Fetch distinct Application IDs for a user from both applications and expenses tables.
 */
export async function getUserApplications(phone: string, userId?: string, supabaseClient?: any): Promise<string[]> {
  const client = supabaseClient || supabase;
  
  // Query applications table
  let appQuery = client
    .from("applications")
    .select("application_id")
    .eq("user_phone", phone);
  
  if (userId) appQuery = appQuery.eq("user_id", userId);
  
  const { data: appData, error: appError } = await appQuery;

  // Query expenses table (fallback/compatibility)
  let expQuery = client
    .from("expenses")
    .select("application_id")
    .eq("user_phone", phone)
    .not("application_id", "is", null);

  if (userId) expQuery = expQuery.eq("user_id", userId);
  
  const { data: expData, error: expError } = await expQuery;

  if (appError) console.error("[DB] getUserApplications apps error:", appError);
  if (expError) console.error("[DB] getUserApplications exps error:", expError);

  const ids = new Set<string>();
  if (appData) appData.forEach((d: any) => ids.add(d.application_id));
  if (expData) expData.forEach((d: any) => ids.add(d.application_id));

  return Array.from(ids).filter(Boolean).sort();
}

/**
 * Fetch all expenses for a specific application ID.
 */
export async function getExpensesByApplication(
  phone: string,
  applicationId: string,
  userId?: string,
  supabaseClient?: any
): Promise<ExpenseRow[]> {
  const client = supabaseClient || supabase;
  let query = client
    .from("expenses")
    .select(
      "id, created_at, user_name, user_phone, application_id, client_name, visit_duration, date_range, expense_type, sub_category, claimed_amount, claimed_amount_numeric, participant_type, participant_count, participant_names, verified, mismatches, total_receipt_amount, amount_match, date_match, city, city_tier, audit_explanation, audit_timeline, receipts(transaction_time)"
    )
    .eq("user_phone", phone)
    .eq("application_id", applicationId);
    
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[DB] getExpensesByApplication error:", error);
    return [];
  }
  return (data ?? []) as ExpenseRow[];
}

/**
 * Saves a chat message to Supabase.
 */
export async function saveChatMessage(payload: {
  userId?: string;
  phone: string;
  role: "user" | "assistant";
  content: string;
  messageType?: string;
  mediaId?: string;
  imageAnalysis?: any;
}, supabaseClient?: any) {
  const client = supabaseClient || supabase;
  try {
    const { error } = await client.from("chat_messages").insert({
      user_id: payload.userId,
      phone: payload.phone,
      role: payload.role,
      content: payload.content,
      message_type: payload.messageType || "text",
      media_id: payload.mediaId,
      image_analysis: payload.imageAnalysis,
    });
    if (error) console.error("[DB] saveChatMessage error:", error);
  } catch (err) {
    console.error("[DB] Unexpected error in saveChatMessage:", err);
  }
}

/**
 * Fetch a user profile by phone number (robust matching).
 */
export async function getUserByPhone(phone: string, supabaseClient?: any) {
  const client = supabaseClient || supabase;
  
  // Normalize incoming phone: remove all non-digits and take last 10
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 10) return null;
  const last10 = clean.slice(-10);

  // 1. Try exact match first (standard phone column)
  const { data: exactData } = await client
    .from("users")
    .select("id")
    .eq("phone", phone)
    .single();
  if (exactData) return exactData;

  // 2. Try matching the last 10 digits in the database
  // This handles '+91', '91', '0' prefixes and even minor typos in the stored number
  const { data: suffixData } = await client
    .from("users")
    .select("id")
    .like("phone", `%${last10}`)
    .single();
    
  return suffixData || null;
}

/**
 * Links a Zoho Cliq userId to a user profile matching the provided email.
 */
export async function upsertCliqId(
  cliqUserId: string,
  email: string,
  supabaseClient?: any
): Promise<void> {
  const client = supabaseClient || supabase;
  try {
    const { error } = await client
      .from("users")
      .update({ cliq_user_id: cliqUserId })
      .eq("email", email);

    if (error) {
      console.error("[DB] upsertCliqId error:", error.message);
    } else {
      console.log(`[DB] Successfully linked Cliq ID ${cliqUserId} to ${email}`);
    }
  } catch (err) {
    console.error("[DB] Unexpected error in upsertCliqId:", err);
  }
}
