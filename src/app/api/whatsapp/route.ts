// ─────────────────────────────────────────────────────────────────────────────
// route.ts — WhatsApp webhook handler (thin orchestrator only)
// All business logic lives in the lib/ files
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";

import { getSession, setSession, clearSession } from "./session";
import { sendText, sendCard, downloadMedia, markAsRead } from "./whatsapp";
import { analyseGeneralImage } from "./vision";
import { getAgentReply } from "./agent";
import {
  handleExpenseFlow,
  sendWelcomeCard,
  sendExpenseMenu,
  sendReportDatePrompt,
} from "./expense-flow";
import { getRecentExpenses, getExpensesInDateRange } from "./db";
import type { ExpenseRow } from "./db";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a list of DB expense rows into a concise WhatsApp string.
 */
function formatExpenseRows(rows: ExpenseRow[]): string {
  return rows
    .map((r, i) => {
      const cat = r.sub_category
        ? `${r.expense_type} (${r.sub_category})`
        : r.expense_type;
      const date = r.date_range || new Date(r.created_at).toLocaleDateString("en-IN");
      const verified = r.verified ? "✅" : "⏳";
      return `*${i + 1}.* ${verified} ${date}\n   ${cat} — *${r.claimed_amount}*`;
    })
    .join("\n\n");
}

/**
 * Convert a natural date range string into UTC ISO start/end timestamps.
 * Handles: "today", "yesterday", "this week", "this month", "last month",
 * and explicit ranges like "01 Mar 2026 - 31 Mar 2026".
 */
function parseDateRangeToIso(dateRange: string): { fromIso: string; toIso: string } {
  const now = new Date();
  const lower = dateRange.toLowerCase().trim();

  const startOf = (d: Date) => {
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const endOf = (d: Date) => {
    d.setHours(23, 59, 59, 999);
    return d;
  };

  if (lower === "today") {
    return { fromIso: startOf(new Date()).toISOString(), toIso: endOf(new Date()).toISOString() };
  }
  if (lower === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { fromIso: startOf(y).toISOString(), toIso: endOf(new Date(y)).toISOString() };
  }
  if (lower.includes("this week")) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    return { fromIso: startOf(start).toISOString(), toIso: endOf(new Date()).toISOString() };
  }
  if (lower.includes("last week")) {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() - 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { fromIso: startOf(start).toISOString(), toIso: endOf(end).toISOString() };
  }
  if (lower.includes("this month")) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromIso: startOf(start).toISOString(), toIso: endOf(new Date()).toISOString() };
  }
  if (lower.includes("last month")) {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { fromIso: startOf(start).toISOString(), toIso: endOf(end).toISOString() };
  }

  // Try parsing "DD Mon YYYY - DD Mon YYYY" or "DD Mon YYYY – DD Mon YYYY"
  const parts = dateRange.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    const from = new Date(parts[0].trim());
    const to = new Date(parts[parts.length - 1].trim());
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      return { fromIso: startOf(from).toISOString(), toIso: endOf(to).toISOString() };
    }
  }

  // Fallback: treat as single day
  const day = new Date(dateRange);
  if (!isNaN(day.getTime())) {
    return { fromIso: startOf(day).toISOString(), toIso: endOf(new Date(day)).toISOString() };
  }

  // Last resort: last 30 days
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  return { fromIso: startOf(thirtyDaysAgo).toISOString(), toIso: endOf(new Date()).toISOString() };
}


// Per-user state for report generation (outside expense flow)
const reportPending = new Set<string>();

// ── GET: Webhook verification ─────────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === VERIFY_TOKEN) {
    console.log("[WA] Webhook verified");
    return new NextResponse(p.get("hub.challenge"), { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST: Incoming messages ───────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    if (body.object !== "whatsapp_business_account")
      return new NextResponse("Not Found", { status: 404 });

    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    const contact = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
    if (!message) return new NextResponse("OK", { status: 200 }); // status updates

    // Mark as read immediately — this is what keeps WhatsApp scrolled to the
    // bottom instead of jumping back to the first unread message.
    markAsRead(message.id);

    const phone: string = message.from;
    const userName: string | undefined = contact?.profile?.name;
    const session = getSession(phone);

    if (userName && !session.userName) {
      session.userName = userName;
      setSession(phone, session);
    }

    console.log(`[WA] ${message.type} from ${phone} (${userName ?? "?"}) — step: ${session.step}`);

    // ── IMAGE ──────────────────────────────────────────────────────────────
    if (message.type === "image") {
      const mediaId: string = message.image.id;
      const caption: string | undefined = message.image.caption;
      const media = await downloadMedia(mediaId);

      if (session.step === "awaiting_receipt" || session.step === "awaiting_additional_receipt") {
        if (!media) {
          await sendText(phone, "Unable to retrieve your image. Please try sending it again.");
        } else {
          await handleExpenseFlow(phone, session, caption ?? "", undefined, mediaId, media.mimeType, media.base64);
        }
        return new NextResponse("OK", { status: 200 });
      }

      // General image analysis
      await sendText(phone, "_Analysing image..._");
      if (!media) {
        await sendText(phone, "Unable to retrieve your image. Please try again.");
      } else {
        const desc = await analyseGeneralImage(media.base64, media.mimeType, caption);
        await sendText(phone, desc);
      }
      return new NextResponse("OK", { status: 200 });
    }

    // ── INTERACTIVE (button / list reply) ──────────────────────────────────
    if (message.type === "interactive") {
      const iType = message.interactive.type;
      const buttonId: string | undefined =
        iType === "button_reply"
          ? message.interactive.button_reply.id
          : message.interactive.list_reply?.id;
      const buttonText: string | undefined =
        iType === "button_reply"
          ? message.interactive.button_reply.title
          : message.interactive.list_reply?.title;

      console.log(`[WA] Button: ${buttonId}`);

      // ── Main navigation ──
      if (buttonId === "ADD_EXPENSE") {
        clearSession(phone);
        const fresh = getSession(phone);
        fresh.userName = userName;
        fresh.step = "awaiting_single_or_multiple"; // Start with participants
        setSession(phone, fresh);
        await handleExpenseFlow(phone, fresh, "", buttonId);
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "VIEW_EXPENSES") {
        await sendExpenseMenu(phone);
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "VIEW_RECENT") {
        const rows = await getRecentExpenses(phone, 10);
        if (rows.length === 0) {
          await sendCard(
            phone,
            "Recent Expenses",
            "No expenses found. Submit your first expense to get started.",
            "Fristine Infotech · Expense Management",
            [
              { id: "ADD_EXPENSE", label: "Submit Expense" },
              { id: "MAIN_MENU",   label: "Main Menu"      },
            ]
          );
        } else {
          const summary = formatExpenseRows(rows);
          await sendCard(
            phone,
            `Recent Expenses (Last ${rows.length})`,
            summary,
            "Fristine Infotech · Expense Management",
            [
              { id: "ADD_EXPENSE",     label: "New Expense"    },
              { id: "GENERATE_REPORT", label: "Full Report"    },
            ]
          );
        }
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "GENERATE_REPORT") {
        reportPending.add(phone);
        await sendReportDatePrompt(phone);
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "MAIN_MENU") {
        clearSession(phone);
        await sendWelcomeCard(phone, userName);
        return new NextResponse("OK", { status: 200 });
      }

      // ── Confirmation / Manual Category ──
      if (buttonId === "VERIFY_YES" && (session.step === "awaiting_verification" || session.step === "awaiting_manual_category")) {
        const { finalizeExpense } = await import("./expense-flow");
        await finalizeExpense(phone, session);
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "ADD_MANUAL_CAT" && session.step === "awaiting_verification") {
        session.step = "awaiting_manual_category";
        setSession(phone, session);
        await sendText(phone, "Please enter the merchant category manually (e.g., Food, Travel, etc.).");
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "VERIFY_NO" && session.step === "awaiting_verification") {
        session.step = "awaiting_receipt";
        session.extractedReceipts = [];
        session.receiptMediaIds = [];
        session.totalReceiptAmount = 0;
        setSession(phone, session);
        await sendText(phone, "Please re-upload your payment receipt and we will re-analyse it.");
        return new NextResponse("OK", { status: 200 });
      }

      // ── Additional receipt buttons ──
      if (buttonId === "ADD_MORE_RECEIPT") {
        await sendText(phone, "Please upload the next receipt image.");
        return new NextResponse("OK", { status: 200 });
      }

      if (buttonId === "PROCEED_ANYWAY" && session.step === "awaiting_additional_receipt") {
        session.step = "awaiting_verification";
        setSession(phone, session);
        const { detectMismatches, sendVerificationCard } = await import("./expense-flow");
        const mismatch = detectMismatches(session);
        await sendVerificationCard(phone, session, mismatch);
        return new NextResponse("OK", { status: 200 });
      }

      // ── Mid-flow buttons ──
      if (session.step !== "idle") {
        await handleExpenseFlow(phone, session, buttonText ?? "", buttonId);
        return new NextResponse("OK", { status: 200 });
      }

      await sendWelcomeCard(phone, userName);
      return new NextResponse("OK", { status: 200 });
    }

    // ── TEXT ───────────────────────────────────────────────────────────────
    if (message.type === "text") {
      const text: string = message.text.body;
      const lower = text.toLowerCase().trim();

      // Greetings → welcome
      if (["hi", "hii", "hello", "hey", "start", "menu"].includes(lower)) {
        clearSession(phone);
        await sendCard(
          phone,
          "Welcome",
          "hello i am fristine infotech agent for the expense management",
          "Fristine Infotech · Expense Management",
          [
            { id: "ADD_EXPENSE",   label: "Add Expense"  },
            { id: "VIEW_EXPENSES", label: "View Expense" },
          ]
        );
        return new NextResponse("OK", { status: 200 });
      }

      // Report date range entry
      if (reportPending.has(phone)) {
        reportPending.delete(phone);
        const { refineUserInput } = await import("./agent");
        const refined = await refineUserInput(text, "date");
        const dateRange = refined.dateRange ?? refined.normalizedDate ?? text;

        // Parse the date range into start/end ISO timestamps
        const { fromIso, toIso } = parseDateRangeToIso(dateRange);
        const rows = await getExpensesInDateRange(phone, fromIso, toIso);

        if (rows.length === 0) {
          await sendCard(
            phone,
            "Expense Report",
            `No expenses found for *${dateRange}*.\n\nTry a different date range or submit new expenses.`,
            "Fristine Infotech · Expense Management",
            [
              { id: "ADD_EXPENSE",   label: "New Expense"  },
              { id: "VIEW_EXPENSES", label: "View History" },
            ]
          );
        } else {
          const totalClaimed = rows.reduce(
            (sum, r) => sum + parseFloat(r.claimed_amount.replace(/[^0-9.]/g, "") || "0"),
            0
          );
          const summary = formatExpenseRows(rows);
          await sendCard(
            phone,
            `Report: ${dateRange}`,
            `*Total Claimed: Rs. ${totalClaimed.toFixed(2)}* (${rows.length} expense${rows.length !== 1 ? "s" : ""})\n\n${summary}`,
            "Fristine Infotech · Expense Management",
            [
              { id: "ADD_EXPENSE",     label: "New Expense"    },
              { id: "GENERATE_REPORT", label: "Another Report" },
            ]
          );
        }
        return new NextResponse("OK", { status: 200 });
      }

      // Mid-expense flow
      if (session.step !== "idle") {
        await handleExpenseFlow(phone, session, text);
        return new NextResponse("OK", { status: 200 });
      }

      // General chat → ADK agent
      try {
        const reply = await getAgentReply(phone, text);
        if (reply) await sendText(phone, reply);
        else await sendWelcomeCard(phone, userName);
      } catch (err) {
        console.error("[WA] Agent error:", err);
        await sendText(phone, "We are experiencing a temporary issue. Please type *menu* to restart.");
      }
      return new NextResponse("OK", { status: 200 });
    }

    // ── Unsupported ────────────────────────────────────────────────────────
    await sendText(phone, "This message type is not supported. Type *hi* to get started.");
    return new NextResponse("OK", { status: 200 });

  } catch (err) {
    console.error("[WA] Unhandled error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}