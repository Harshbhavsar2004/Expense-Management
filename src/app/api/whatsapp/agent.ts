// ─────────────────────────────────────────────────────────────────────────────
// agent.ts — Calls ADK agents on port 8000
//   1. getAgentReply()   → ProverbsAgent (general chat)
//   2. refineUserInput() → InputRefinerAgent (normalises dates, amounts)
// ─────────────────────────────────────────────────────────────────────────────

import type { RefinedInput, ExpenseSession } from "./types";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

// ── Generic SSE stream reader — returns text AND state snapshot ───────────────
// The InputRefinerAgent writes its output via a tool into state["refined_output"].
// We read STATE_SNAPSHOT events to get that structured data reliably,
// instead of parsing the agent's trailing plain-text confirmation message
// (which caused "Unexpected token 'D', 'Date normalized.' is not valid JSON").
async function readAgentStream(
  res: Response
): Promise<{ text: string; state: Record<string, unknown> }> {
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let buffer = "";
  let state: Record<string, unknown> = {};

  if (!reader) return { text, state };

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
        if (event.type === "TEXT_MESSAGE_CONTENT" && event.delta) {
          text += event.delta;
        } else if (event.type === "STATE_SNAPSHOT" && event.snapshot) {
          state = event.snapshot as Record<string, unknown>;
        } else if (event.type === "RUN_ERROR") {
          throw new Error(event.message);
        }
      } catch {}
    }
  }
  return { text, state };
}

// ── Build AG-UI RunAgentInput ─────────────────────────────────────────────────
function buildRunInput(agentName: string, threadId: string, userText: string) {
  return {
    thread_id: threadId,
    run_id: crypto.randomUUID(),
    agent_name: agentName,
    messages: [{
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
      created_at: Math.floor(Date.now() / 1000),
    }],
    actions: [],
    state: null,
    context: [],
    tools: [],
    forwarded_props: {},
  };
}

// ── Agent 1: General chat ─────────────────────────────────────────────────────
export async function getAgentReply(phone: string, text: string): Promise<string> {
  const res = await fetch(`${AGENT_URL}/chatbot_agent/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(buildRunInput("ChatbotAgent", phone, text)),
  });
  if (!res.ok) throw new Error(`Agent status ${res.status}`);
  const { text: reply } = await readAgentStream(res);
  return reply;
}

// ── Agent 4: Audit Agent ──────────────────────────────────────────────────────
export async function triggerAudit(expenseId: string, session: ExpenseSession, phone?: string): Promise<any> {
  const receipt = session.extractedReceipts?.[0];
  const prompt = [
    `Perform a full 9-rule audit on this expense claim.`,
    ``,
    `Expense ID: ${expenseId}`,
    `User ID: ${session.userId || ""}`,
    `User Phone: ${phone || ""}`,
    `Employee: ${session.userName || "Unknown"}`,
    `Category: ${receipt?.merchantCategory || session.expenseType || "Miscellaneous"}`,
    `City: ${session.city || "Not specified"}`,
    `City Tier: ${session.cityTier || "Tier - III"}`,
    `Visit Duration: ${session.visitDuration || ""}`,
    `Participants: ${session.appParticipantCount || 1}`,
    `Claimed Amount: ${session.amountNumeric || 0}`,
    `Receipt Total: ${session.totalReceiptAmount || 0}`,
    `Receipt Date: ${receipt?.date || ""}`,
    `Receipt Status: ${receipt?.status || "UNKNOWN"}`,
    `UTR Number: ${receipt?.utrNumber || "not provided"}`,
    ``,
    `Apply all 9 mismatch rules using the pre-computed facts. Call set_audit_result exactly once with your verdict.`,
  ].join("\n");

  const res = await fetch(`${AGENT_URL}/audit/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(buildRunInput("AuditAgent", `audit-${expenseId}`, prompt)),
  });

  if (!res.ok) throw new Error(`Audit agent status ${res.status}`);
  const { state } = await readAgentStream(res);
  return state?.audit_output;
}

// ── Agent 3: Input Refiner ────────────────────────────────────────────────────
// The Python InputRefinerAgent calls output_normalized_date / output_normalized_amount
// which write structured JSON into tool_context.state["refined_output"].
// We read that via STATE_SNAPSHOT — NOT by JSON.parsing the text reply.
export async function refineUserInput(
  rawInput: string,
  fieldType: "date" | "amount"
): Promise<RefinedInput> {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });

  const prompt =
    fieldType === "date"
      ? `Today's date is ${today}. The user entered this date: "${rawInput}". Call output_normalized_date with the correct normalized values.`
      : `The user entered this expense amount: "${rawInput}". Call output_normalized_amount with the correctly formatted values.`;

  try {
    const res = await fetch(`${AGENT_URL}/refine/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(buildRunInput("InputRefinerAgent", `refine-${Date.now()}`, prompt)),
    });

    if (!res.ok) {
      console.error(`[Refiner] HTTP ${res.status}`);
      return { originalInput: rawInput, refinedAt: new Date().toISOString() };
    }

    const { state } = await readAgentStream(res);

    // The tool writes to state["refined_output"] — this is the reliable path
    const refined = state?.refined_output as Record<string, unknown> | undefined;

    if (refined) {
      console.log("[Refiner] Got structured output from state:", JSON.stringify(refined));
      return {
        normalizedDate:  refined.normalizedDate  as string | undefined,
        dateRange:       refined.dateRange        as string | undefined,
        amount:          refined.amount           as string | undefined,
        amountNumeric:   refined.amountNumeric    as number | undefined,
        originalInput:   rawInput,
        refinedAt:       new Date().toISOString(),
      };
    }

    // Fallback: no state snapshot received — return raw input unchanged
    console.warn("[Refiner] No state snapshot received, using raw input.");
    return { originalInput: rawInput, refinedAt: new Date().toISOString() };

  } catch (e) {
    console.error("[Refiner] Error:", e);
    return { originalInput: rawInput, refinedAt: new Date().toISOString() };
  }
}