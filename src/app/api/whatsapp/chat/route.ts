// ─────────────────────────────────────────────────────────────────────────────
// /api/whatsapp/chat — Web-chat bridge
//
// Accepts messages from the web chat UI, runs them through the same bot logic
// as the real WhatsApp webhook (route.ts), and returns the bot's responses
// as JSON instead of sending to WhatsApp.
//
// Uses the capture-mode hooks added to whatsapp.ts so that all sendText /
// sendCard / sendList calls are intercepted and returned to the browser.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { getSession, setSession, clearSession } from "../session";
import { startCapture, popCapture } from "../whatsapp";
import { createClient } from "@/utils/supabase/server";
import {
  handleExpenseFlow,
  sendWelcomeCard,
} from "../expense-flow";
import { getRecentExpenses, getExpensesInDateRange, saveChatMessage } from "../db";
import type { ExpenseRow } from "../db";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WebChatRequest {
  phone: string;                              // User's phone number (identity)
  type: "text" | "button_reply" | "list_reply" | "image";
  text?: string;                              // For type="text"
  buttonId?: string;                          // For type="button_reply" | "list_reply"
  buttonTitle?: string;                       // Human-readable label of the button
  userName?: string;
  mediaBase64?: string;                       // Base64 encoded image data
  mediaMimeType?: string;                     // MIME type of the image
}

// ── Helpers (copied from route.ts) ───────────────────────────────────────────

function formatExpenseRows(rows: ExpenseRow[]): string {
  return rows
    .map((r, i) => {
      const cat = r.sub_category ? `${r.expense_type} (${r.sub_category})` : r.expense_type;
      const date = r.date_range || new Date(r.created_at).toLocaleDateString("en-IN");
      const verified = r.verified ? "✅" : "⏳";
      return `*${i + 1}.* ${verified} ${date}\n   ${cat} — *${r.claimed_amount}*`;
    })
    .join("\n\n");
}

function parseDateRangeToIso(dateRange: string): { fromIso: string; toIso: string } {
  const now   = new Date();
  const lower = dateRange.toLowerCase().trim();
  const startOf = (d: Date) => { d.setHours(0, 0, 0, 0); return d; };
  const endOf   = (d: Date) => { d.setHours(23, 59, 59, 999); return d; };

  if (lower === "today")
    return { fromIso: startOf(new Date()).toISOString(), toIso: endOf(new Date()).toISOString() };
  if (lower === "yesterday") {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { fromIso: startOf(y).toISOString(), toIso: endOf(new Date(y)).toISOString() };
  }
  if (lower.includes("this week")) {
    const s = new Date(now); s.setDate(now.getDate() - now.getDay());
    return { fromIso: startOf(s).toISOString(), toIso: endOf(new Date()).toISOString() };
  }
  if (lower.includes("this month")) {
    const s = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromIso: startOf(s).toISOString(), toIso: endOf(new Date()).toISOString() };
  }
  if (lower.includes("last month")) {
    const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const e = new Date(now.getFullYear(), now.getMonth(), 0);
    return { fromIso: startOf(s).toISOString(), toIso: endOf(e).toISOString() };
  }
  const parts = dateRange.split(/\s*[-–]\s*/);
  if (parts.length >= 2) {
    const from = new Date(parts[0].trim()), to = new Date(parts[parts.length - 1].trim());
    if (!isNaN(from.getTime()) && !isNaN(to.getTime()))
      return { fromIso: startOf(from).toISOString(), toIso: endOf(to).toISOString() };
  }
  const day = new Date(dateRange);
  if (!isNaN(day.getTime()))
    return { fromIso: startOf(day).toISOString(), toIso: endOf(new Date(day)).toISOString() };
  const ago = new Date(now); ago.setDate(now.getDate() - 30);
  return { fromIso: startOf(ago).toISOString(), toIso: endOf(new Date()).toISOString() };
}

// Per-user state for report date awaiting
const reportPending = new Set<string>();

// ── POST /api/whatsapp/chat ───────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body: WebChatRequest = await req.json();
    const { phone, type, text, buttonId, buttonTitle, userName, mediaBase64, mediaMimeType } = body;

    if (!phone) return NextResponse.json({ error: "phone required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;

    // Start capturing all bot sends for this phone
    startCapture(phone);

    // Save incoming user message to DB
    if (type === "text" && text) {
      await saveChatMessage({ userId, phone, role: "user", content: text }, supabase);
    } else if (buttonTitle) {
      await saveChatMessage({ userId, phone, role: "user", content: `Clicked: ${buttonTitle}` }, supabase);
    } else if (type === "image") {
      await saveChatMessage({ userId, phone, role: "user", content: "Sent an image", messageType: "image" }, supabase);
    }

    const session = getSession(phone);

    // Persist userId in session so expense-flow can find it
    if (userId) {
      session.userId = userId;
    }

    // Persist userName in session
    if (userName && !session.userName) {
      session.userName = userName;
      setSession(phone, session);
    }

    // ── BUTTON / LIST REPLY ──────────────────────────────────────────────────
    if (type === "button_reply" || type === "list_reply") {
      const id    = buttonId ?? "";
      const title = buttonTitle ?? "";

      if (id === "CREATE_EXP_REPORT") {
        clearSession(phone);
        const fresh = getSession(phone);
        fresh.userName = userName;
        fresh.step = "awaiting_app_client";
        setSession(phone, fresh);
        // sendText captured:
        const { sendText } = await import("../whatsapp");
        await sendText(phone, "*Step 1: Client Name*\n\nPlease enter the name of the client for this expense report.");
      } else if (id === "ADD_EXPENSE") {
        const { sendAppList } = await import("../expense-flow");
        await sendAppList(phone, "awaiting_app_selection_add", supabase);
      } else if (id === "VIEW_HISTORY") {
        const { sendAppList } = await import("../expense-flow");
        await sendAppList(phone, "awaiting_app_selection_view", supabase);
      } else if (id === "MAIN_MENU") {
        clearSession(phone);
        await sendWelcomeCard(phone, userName);
      } else if (id === "VERIFY_YES" && (session.step === "awaiting_verification" || session.step === "awaiting_manual_category")) {
        const { finalizeExpense } = await import("../expense-flow");
        await finalizeExpense(phone, session, supabase);
      } else if (id === "ADD_MANUAL_CAT" && session.step === "awaiting_verification") {
        session.step = "awaiting_manual_category";
        setSession(phone, session);
        const { sendText } = await import("../whatsapp");
        await sendText(phone, "Please enter the merchant category manually (e.g., Food, Travel, etc.).");
      } else if (session.step === "awaiting_app_selection_add" || session.step === "awaiting_app_selection_view") {
        await handleExpenseFlow(phone, session, title, id, undefined, undefined, undefined, supabase);
      } else if (session.step !== "idle") {
        await handleExpenseFlow(phone, session, title, id, undefined, undefined, undefined, supabase);
      }

      const botMessages = popCapture(phone);
      // Save outgoing bot messages to DB
      for (const m of botMessages) {
        let content = "";
        if (m.type === "text") content = m.body;
        else if (m.type === "card" || m.type === "image_card") content = `[Card] ${m.body}`;
        else if (m.type === "list") content = `[List] ${m.body}`;
        
        await saveChatMessage({ userId, phone, role: "assistant", content, messageType: m.type }, supabase);
      }

      return NextResponse.json({ messages: botMessages });
    }

    // ── IMAGE ─────────────────────────────────────────────────────────────────
    if (type === "image" && mediaBase64) {
      const mime = mediaMimeType || "image/jpeg";
      // Generate a reproducible fake media ID for web uploads
      const fakeMediaId = `web-${phone}-${Date.now()}`;
      
      await handleExpenseFlow(
        phone,
        session,
        "",
        undefined,
        fakeMediaId,
        mime,
        mediaBase64,
        supabase
      );

      const botMessages = popCapture(phone);
      for (const m of botMessages) {
        let content = "";
        if (m.type === "text") content = m.body;
        else if (m.type === "card" || m.type === "image_card") content = `[Card] ${m.body}`;
        else if (m.type === "list") content = `[List] ${m.body}`;
        
        await saveChatMessage({ userId, phone, role: "assistant", content, messageType: m.type }, supabase);
      }
      return NextResponse.json({ messages: botMessages });
    }

    // ── TEXT ──────────────────────────────────────────────────────────────────
    if (type === "text" && text) {
      const lower = text.toLowerCase().trim();

      // Greeting → welcome card
      if (["hi", "hii", "hello", "hey", "start", "menu"].includes(lower)) {
        clearSession(phone);
        await sendWelcomeCard(phone, userName);
        
        const botMessages = popCapture(phone);
        for (const m of botMessages) {
          await saveChatMessage({ userId, phone, role: "assistant", content: (m as any).body || "[Media/Interactive]", messageType: m.type }, supabase);
        }
        return NextResponse.json({ messages: botMessages });
      }

      // Report date entry
      if (reportPending.has(phone)) {
        reportPending.delete(phone);
        const { refineUserInput } = await import("../agent");
        const refined   = await refineUserInput(text, "date");
        const dateRange = refined.dateRange ?? refined.normalizedDate ?? text;
        const { fromIso, toIso } = parseDateRangeToIso(dateRange);
        const rows = await getExpensesInDateRange(phone, fromIso, toIso, userId, supabase);
        const { sendCard } = await import("../whatsapp");

        if (rows.length === 0) {
          await sendCard(phone, "Expense Report",
            `No expenses found for *${dateRange}*.\n\nTry a different date range or submit new expenses.`,
            "Expify Agent",
            [{ id: "ADD_EXPENSE", label: "New Expense" }, { id: "VIEW_HISTORY", label: "View History" }]);
        } else {
          const total = rows.reduce((s, r) => s + parseFloat(r.claimed_amount.replace(/[^0-9.]/g, "") || "0"), 0);
          await sendCard(phone, `Report: ${dateRange}`,
            `*Total Claimed: Rs. ${total.toFixed(2)}* (${rows.length} expense${rows.length !== 1 ? "s" : ""})\n\n${formatExpenseRows(rows)}`,
            "Expify Agent",
            [{ id: "ADD_EXPENSE", label: "New Expense" }, { id: "GENERATE_REPORT", label: "Another Report" }]);
        }

        const botMessages = popCapture(phone);
        for (const m of botMessages) {
          await saveChatMessage({ userId, phone, role: "assistant", content: (m as any).body || "[Media/Interactive]", messageType: m.type }, supabase);
        }
        return NextResponse.json({ messages: botMessages });
      }

      // Mid-flow text
      if (session.step !== "idle") {
        await handleExpenseFlow(phone, session, text, undefined, undefined, undefined, undefined, supabase);
        
        const botMessages = popCapture(phone);
        for (const m of botMessages) {
          await saveChatMessage({ userId, phone, role: "assistant", content: (m as any).body || "[Media/Interactive]", messageType: m.type }, supabase);
        }
        return NextResponse.json({ messages: botMessages });
      }

      // General chat — agent reply
      try {
        const { getAgentReply } = await import("../agent");
        const reply = await getAgentReply(phone, text);
        if (reply) {
          const { sendText } = await import("../whatsapp");
          await sendText(phone, reply);
        } else {
          await sendWelcomeCard(phone, userName);
        }
      } catch {
        const { sendText } = await import("../whatsapp");
        await sendText(phone, "We're experiencing a temporary issue. Type *menu* to restart.");
      }
      const botMessages = popCapture(phone);
      for (const m of botMessages) {
        await saveChatMessage({ userId, phone, role: "assistant", content: (m as any).body || "[Media/Interactive]", messageType: m.type }, supabase);
      }
      return NextResponse.json({ messages: botMessages });
    }

    return NextResponse.json({ messages: [] });

  } catch (err) {
    console.error("[WebChat] Error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
