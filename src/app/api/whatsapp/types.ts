// ─────────────────────────────────────────────────────────────────────────────
// types.ts — Shared TypeScript types for the WhatsApp Expense Bot
// ─────────────────────────────────────────────────────────────────────────────

export type ExpenseStep =
  | "idle"
  | "awaiting_app_client"
  | "awaiting_app_duration"
  | "awaiting_app_city"
  | "awaiting_app_participants_count"
  | "awaiting_app_participants_details"
  | "awaiting_app_selection_add"
  | "awaiting_app_selection_view"
  | "awaiting_date_range"
  | "awaiting_expense_type"
  | "awaiting_subcategory"
  | "awaiting_amount"
  | "awaiting_receipt"
  | "awaiting_additional_receipt"
  | "awaiting_single_or_multiple"
  | "awaiting_person_count"
  | "awaiting_person_names"
  | "awaiting_city"
  | "awaiting_manual_category"
  | "awaiting_verification";

export type ExtractedReceiptData = {
  amount?: string;
  amountNumeric?: number;
  utrNumber?: string;
  transactionId?: string;
  paymentMethod?: string;
  merchant?: string;
  merchantCategory?: string;
  date?: string;
  status?: string;
  rawDescription?: string;
  transactionTime?: string;
};

export type ExpenseSession = {
  step: ExpenseStep;
  userId?: string;
  userName?: string;
  // Application ID Flow
  applicationId?: string;
  clientName?: string;
  visitDuration?: string;
  // Participant details
  appParticipantCount?: number;
  appParticipantDetails?: { name: string; phone: string }[];
  // Step data
  dateRange?: string;
  expenseType?: string;
  amount?: string;
  amountNumeric?: number;
  // Receipt — support multiple receipts
  receiptMediaIds?: string[];
  receiptImageUrls?: string[];       // Supabase Storage public URLs
  extractedReceipts?: ExtractedReceiptData[];
  totalReceiptAmount?: number;
  // Participants
  personType?: "single" | "multiple";
  personCount?: number;
  personNames?: string[];
  subCategory?: string;
  city?: string;
  cityTier?: string;
};

export type ReceiptMismatch = {
  type: "amount" | "date" | "both" | "none";
  claimedAmount?: string;
  receiptAmount?: string;
  claimedDate?: string;
  receiptDate?: string;
  shortfallAmount?: number;
};

export type ExpenseRecord = {
  meta: {
    recordedAt: string;
    userPhone: string;
    userName: string;
    sessionId: string;
  };
  expense: {
    applicationId?: string;
    clientName?: string;
    visitDuration?: string;
    dateRange: string;
    normalizedDateRange: string;
    type: string;
    subCategory?: string;
    claimedAmount: string;
    claimedAmountNumeric: number;
    city?: string;
    cityTier?: string;
    participants: {
      type: "single" | "multiple";
      count: number;
      names: string[];
    };
  };
  receipts: {
    count: number;
    totalExtractedAmount: number;
    amountMatch: boolean;
    dateMatch: boolean;
    items: {
      mediaId: string;
      imageUrl?: string;             // Supabase Storage public URL
      extractedAmount: string;
      utrNumber: string;
      transactionId: string;
      paymentMethod: string;
      merchant: string;
      transactionDate: string;
      transactionTime?: string;
      status: string;
      rawDescription: string;
    }[];
  };
  verification: {
    verified: boolean;
    verifiedAt: string;
    mismatches: string[];
    auditExplanation?: string;
    auditTimeline?: string[];
  };
};

export type RefinedInput = {
  dateRange?: string;
  normalizedDate?: string;
  amount?: string;
  amountNumeric?: number;
  originalInput: string;
  refinedAt: string;
};

export type ApplicationRecord = {
  userPhone: string;
  applicationId: string;
  clientName: string;
  visitDuration: string;
  city: string;
  cityTier: string;
  participantCount: number;
  participantDetails: { name: string; phone: string }[];
};
