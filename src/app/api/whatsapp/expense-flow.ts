// ─────────────────────────────────────────────────────────────────────────────
// expense-flow.ts — Full expense entry state machine
// ─────────────────────────────────────────────────────────────────────────────

import type { ExpenseSession, ExtractedReceiptData, ReceiptMismatch } from "./types";
import { getSession, setSession, clearSession } from "./session";
import { sendText, sendCard, sendList, sendImageCard, downloadMedia } from "./whatsapp";
import { analyseReceipt } from "./vision";
import { logExpenseRecord } from "./logger";
import { triggerAudit } from "./agent";

const LOGO_URL =
  process.env.FRISTINE_LOGO_URL ||
  "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Culinary_fruits_front_view.jpg/1200px-Culinary_fruits_front_view.jpg";

// ── Welcome card ──────────────────────────────────────────────────────────────
export async function sendWelcomeCard(to: string, userName?: string): Promise<void> {
  const name = userName ? `*${userName}*` : "there";
  await sendImageCard(
    to,
    LOGO_URL,
    `Hello, ${name}.\n\nYou are connected to the *Fristine Infotech Expense Management System*.\n\nThis platform allows you to submit, track, and review business expenses directly from WhatsApp.\n\nHow may I assist you today?`,
    "Fristine Infotech · Expense Management",
    [
      { id: "ADD_EXPENSE",   label: "Submit Expense"  },
      { id: "VIEW_EXPENSES", label: "View History"    },
    ]
  );
}

// ── Expense type list ─────────────────────────────────────────────────────────
async function sendExpenseTypeList(to: string): Promise<void> {
  await sendList(
    to,
    "Step 2 of 6 · Expense Category",
    "Select the category that best describes this expense.\n\nAll submissions are recorded for reimbursement processing.",
    "Fristine Infotech · Expense Management",
    "Select Category",
    [{
      title: "Expense Categories",
      rows: [
        { id: "TRAVEL",        title: "Travel Expenses",     description: "Flights, trains, taxis, fuel" },
        { id: "FOOD",          title: "Meals",               description: "Client meals, team lunches"    },
        { id: "ACCOMMODATION", title: "Hotel Accommodation", description: "Hotels, lodging"               },
        { id: "OFFICE",        title: "Office Supplies",description: "Stationery, equipment"         },
        { id: "COMMUNICATION", title: "Communication",  description: "Phone, internet, courier"      },
        { id: "MISCELLANEOUS", title: "Miscellaneous",  description: "Any other business expense"    },
      ],
    }]
  );
}

// ── Participant selector ──────────────────────────────────────────────────────
async function sendParticipantCard(to: string): Promise<void> {
  await sendCard(
    to,
    "Step 1: Participants",
    "Was this expense incurred for yourself only, or does it cover multiple team members?",
    "Fristine Infotech · Expense Management",
    [
      { id: "SINGLE_PERSON",   label: "Only Me"          },
      { id: "MULTIPLE_PERSONS",label: "Multiple People"  },
    ]
  );
}

// ── Detect mismatches between claimed values and receipt ──────────────────────
export function detectMismatches(session: ExpenseSession): ReceiptMismatch {
  const receipts = session.extractedReceipts ?? [];
  if (receipts.length === 0) return { type: "none" };

  const totalExtracted = session.totalReceiptAmount ?? 0;
  const claimed = session.amountNumeric ?? 0;
  const amountMismatch = claimed > 0 && totalExtracted > 0 && Math.abs(totalExtracted - claimed) >= 1;

  // Date check: compare session.dateRange with any receipt date
  let dateMismatch = false;
  const sessionDateStr = (session.dateRange ?? "").toLowerCase();

  // Only flag date mismatch if the user entered a specific date (not a range phrase)
  // and the receipt has a date that differs
  const firstReceiptDate = receipts[0]?.date;
  if (
    firstReceiptDate &&
    sessionDateStr &&
    !sessionDateStr.includes("–") &&
    !sessionDateStr.includes("-")
  ) {
    // Normalize both to compare (rough check)
    const receiptLower = firstReceiptDate.toLowerCase();
    const sessionLower = sessionDateStr.toLowerCase();
    // If they share no common tokens (day/month/year), flag as mismatch
    const sessionTokens = sessionLower.split(/\s+/);
    const matched = sessionTokens.some((t) => receiptLower.includes(t) && t.length > 2);
    if (!matched) dateMismatch = true;
  }

  if (amountMismatch && dateMismatch) return {
    type: "both",
    claimedAmount: session.amount,
    receiptAmount: `Rs. ${totalExtracted.toFixed(2)}`,
    claimedDate: session.dateRange,
    receiptDate: firstReceiptDate,
    shortfallAmount: claimed - totalExtracted,
  };
  if (amountMismatch) return {
    type: "amount",
    claimedAmount: session.amount,
    receiptAmount: `Rs. ${totalExtracted.toFixed(2)}`,
    shortfallAmount: claimed - totalExtracted,
  };
  if (dateMismatch) return {
    type: "date",
    claimedDate: session.dateRange,
    receiptDate: firstReceiptDate,
  };
  return { type: "none" };
}

// ── Build receipt verification card body ──────────────────────────────────────
function buildVerificationBody(session: ExpenseSession, mismatch: ReceiptMismatch): string {
  const receipts = session.extractedReceipts ?? [];
  const lines: string[] = [];

  lines.push("*Step 3: Verification*\n");

  receipts.forEach((r, i) => {
    if (receipts.length > 1) lines.push(`_Receipt ${i + 1} of ${receipts.length}_`);
    lines.push(`*Date:* ${r.date ?? "—"}`);
    lines.push(`*Amount:* ${r.amount ?? "—"}`);
    lines.push(`*Merchant:* ${r.merchant ?? "—"}`);
    lines.push(`*Category:* ${r.merchantCategory ?? "—"}`);
    if (receipts.length > 1 && i < receipts.length - 1) lines.push("");
  });

  lines.push("\nPlease confirm the details above are accurate, or add a category manually.");
  return lines.join("\n");
}

// ── Build confirmation summary ────────────────────────────────────────────────
function buildConfirmationBody(session: ExpenseSession): string {
  const r = session.extractedReceipts?.[0];
  const participants =
    session.personType === "single"
      ? "Self"
      : `${session.personNames?.join(", ")} (${session.personCount} persons)`;

  return [
    "*Expense Submitted Successfully*\n",
    `Date: ${r?.date || "—"}`,
    `Merchant: ${r?.merchant || "—"}`,
    `Category: ${r?.merchantCategory || "—"}`,
    `Amount: ${r?.amount || session.amount || "—"}`,
    `Participants: ${participants}`,
    `\nYour expense has been recorded in Supabase.`,
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN STATE MACHINE
// ─────────────────────────────────────────────────────────────────────────────
export async function handleExpenseFlow(
  phone: string,
  session: ExpenseSession,
  incomingText: string,
  buttonId?: string,
  mediaId?: string,
  mediaMimeType?: string,
  mediaBase64?: string
): Promise<void> {
  const input = buttonId || incomingText.trim();

  switch (session.step) {

    // ── STEP 1: PARTICIPANTS ─────────────────────────────────────────────────
    case "awaiting_single_or_multiple": {
      if (input === "SINGLE_PERSON") {
        session.personType = "single";
        session.personNames = ["Self"];
        session.personCount = 1;
        session.step = "awaiting_city";
        setSession(phone, session);
        await sendText(phone, "*Step 1.5: City Location*\n\nPlease enter the name of the city you visited.");
      } else if (input === "MULTIPLE_PERSONS") {
        session.personType = "multiple";
        session.step = "awaiting_person_count";
        setSession(phone, session);
        await sendText(phone,
          "*Step 1a · Number of Participants*\n\nHow many people does this expense cover?\n\nEnter a number (minimum 2)."
        );
      } else {
        await sendParticipantCard(phone);
      }
      break;
    }

    case "awaiting_person_count": {
      const count = parseInt(incomingText.trim(), 10);
      if (isNaN(count) || count < 2) {
        await sendText(phone, "Please enter a number of 2 or more.");
        return;
      }
      session.personCount = count;
      session.step = "awaiting_person_names";
      setSession(phone, session);
      await sendText(phone,
        `*Step 1b · Participant Names*\n\nEnter the full names of all *${count} participants*, separated by commas.`
      );
      break;
    }

    case "awaiting_person_names": {
      const names = incomingText.split(",").map((n) => n.trim()).filter(Boolean);
      if (session.personCount && names.length !== session.personCount) {
        await sendText(phone,
          `You indicated *${session.personCount} participants* but provided *${names.length} name(s)*.\n\nPlease re-enter all ${session.personCount} names separated by commas.`
        );
        return;
      }
      session.personNames = names;
      session.step = "awaiting_city";
      setSession(phone, session);
      await sendText(phone, "*Step 1.5: City Location*\n\nPlease enter the name of the city you visited.");
      break;
    }

    // ── STEP 1.5: CITY ──────────────────────────────────────────────────────
    case "awaiting_city": {
      const city = incomingText.trim();
      const { getCityTier } = await import("./city-tool");
      const tier = getCityTier(city);
      
      session.city = city;
      session.cityTier = tier;
      session.step = "awaiting_receipt";
      setSession(phone, session);
      
      await sendText(phone, `*City:* ${city} (${tier})\n\n*Step 2: Upload Receipt*\n\nPlease upload the UPI screenshot or payment receipt.`);
      break;
    }

    // ── STEP 2: RECEIPT ──────────────────────────────────────────────────────
    case "awaiting_receipt": {
      if (!mediaId || !mediaBase64 || !mediaMimeType) {
        await sendText(phone, "Please upload an image of your payment receipt/screenshot.");
        return;
      }

      await sendText(phone, "_Extracting data from screenshot..._");
      const extracted = await analyseReceipt(mediaBase64, mediaMimeType);
      
      // Categorize merchant
      const { getMerchantCategory } = await import("./merchant-tool");
      if (extracted.merchant) {
         extracted.merchantCategory = getMerchantCategory(extracted.merchant);
      }

      session.receiptMediaIds = [mediaId];
      session.extractedReceipts = [extracted];
      session.totalReceiptAmount = extracted.amountNumeric ?? 0;
      session.amount = extracted.amount;
      session.amountNumeric = extracted.amountNumeric;
      session.step = "awaiting_verification";
      setSession(phone, session);

      await sendVerificationCard(phone, session);
      break;
    }

    // ── STEP 3: VERIFICATION / MANUAL CATEGORY ──────────────────────────────
    case "awaiting_manual_category": {
      if (session.extractedReceipts && session.extractedReceipts.length > 0) {
        session.extractedReceipts[0].merchantCategory = incomingText.trim();
        session.step = "awaiting_verification";
        setSession(phone, session);
        await sendVerificationCard(phone, session);
      }
      break;
    }

    case "awaiting_verification": {
      // Handled via buttons in route.ts
      break;
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export async function sendVerificationCard(
  phone: string,
  session: ExpenseSession,
  mismatch: ReceiptMismatch = { type: "none" }
): Promise<void> {
  await sendCard(
    phone,
    "Verification",
    buildVerificationBody(session, mismatch),
    "Fristine Infotech · Expense Management",
    [
      { id: "VERIFY_YES",      label: "Confirm"          },
      { id: "ADD_MANUAL_CAT",  label: "Add Category"     },
    ]
  );
}

export async function finalizeExpense(phone: string, session: ExpenseSession): Promise<void> {
  const { saveExpenseToSupabase } = await import("./db");
  
  // Transform session to ExpenseRecord for DB
  const record: any = {
    meta: {
      recordedAt: new Date().toISOString(),
      userPhone: phone,
      userName: session.userName || "WhatsApp User",
      sessionId: phone + "-" + Date.now(),
    },
    expense: {
      dateRange: session.extractedReceipts?.[0]?.date || "Unknown",
      normalizedDateRange: session.extractedReceipts?.[0]?.date || "Unknown",
      type: session.extractedReceipts?.[0]?.merchantCategory || "Miscellaneous",
      subCategory: "", 
      claimedAmount: session.extractedReceipts?.[0]?.amount || "0",
      claimedAmountNumeric: session.extractedReceipts?.[0]?.amountNumeric || 0,
      city: session.city,
      cityTier: session.cityTier,
      participants: {
        type: session.personType,
        count: session.personCount || 1,
        names: session.personNames || ["Self"],
      },
    },
    receipts: {
      count: session.extractedReceipts?.length || 0,
      totalExtractedAmount: session.totalReceiptAmount || 0,
      amountMatch: true,
      dateMatch: true,
      items: (session.extractedReceipts || []).map((r, i) => ({
        mediaId: session.receiptMediaIds?.[i] || "",
        extractedAmount: r.amount || "0",
        utrNumber: r.utrNumber || "",
        transactionId: r.transactionId || "",
        paymentMethod: r.paymentMethod || "",
        merchant: r.merchant || "",
        transactionDate: r.date || "",
        status: r.status || "",
        rawDescription: r.rawDescription || "",
      })),
    },
    verification: {
      verified: false, // Default to false until audit confirms
      verifiedAt: new Date().toISOString(),
      mismatches: [],
    },
  };

  const expenseId = await saveExpenseToSupabase(record);

  clearSession(phone);

  await sendCard(
    phone,
    "Expense Submitted",
    buildConfirmationBody(session),
    "Fristine Infotech · Expense Management",
    [
      { id: "ADD_EXPENSE",   label: "New Expense"   },
      { id: "VIEW_EXPENSES", label: "View History"  },
    ]
  );

  // ── Trigger Automated Audit & Notify ──
  if (expenseId) {
    try {
      console.log(`[Flow] Triggering auto-audit for ${expenseId}`);
      const auditResult = await triggerAudit(expenseId, session);
      if (auditResult) {
        let msg = `*Audit Status Update*\n\n`;
        if (auditResult.verified) {
          msg += `✅ Your expense has been *Verified* against company policy.`;
        } else {
          msg += `⚠️ *Policy Mismatch Detected*\n\n${auditResult.explanation}\n\nPlease review the details in your dashboard.`;
        }
        await sendText(phone, msg);
      }
    } catch (err) {
      console.error("[Flow] Audit trigger failed:", err);
    }
  }
}

// ── View expenses / report ────────────────────────────────────────────────────
export async function sendExpenseMenu(phone: string): Promise<void> {
  await sendCard(
    phone,
    "Expense History",
    "Select an option to view or export your expense records.",
    "Fristine Infotech · Expense Management",
    [
      { id: "VIEW_RECENT",     label: "Recent Entries" },
      { id: "GENERATE_REPORT", label: "Generate Report"},
    ]
  );
}

export async function sendReportDatePrompt(phone: string): Promise<void> {
  await sendText(phone,
    "*Generate Expense Report*\n\nEnter the date range for your report.\n\nExamples:\n· 01 Mar 2026 - 31 Mar 2026\n· this month\n· last week"
  );
}
