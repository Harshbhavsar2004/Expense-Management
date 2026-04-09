import { NextRequest } from "next/server";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export const runtime = "nodejs";

import { createClient } from "@/utils/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { message, threadId, history } = await req.json() as {
    message: string;
    threadId: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  // Prepend admin_id in the message (for multi-turn context)
  const finalMessage = user ? `[admin_id:${user.id}] ${message}` : message;

  const now = Math.floor(Date.now() / 1000);
  const messages = [
    ...(history ?? []).map((m, i) => ({
      id: `hist-${i}`,
      role: m.role,
      content: m.content,
      created_at: now - (history!.length - i),
    })),
    {
      id: `msg-${Date.now()}`,
      role: "user",
      content: finalMessage,
      created_at: now,
    },
  ];

  const agentRes = await fetch(`${AGENT_URL}/enterprise_agent/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      thread_id:    threadId,
      run_id:       crypto.randomUUID(),
      agent_name:   "EnterpriseAgent",
      messages,
      actions:      [],
      // ── KEY FIX: pass admin_user_id in state ──────────────────
      // AG UI passes this into callback_context.state
      // enterprise_before_model reads it from here
      state: user ? { admin_user_id: user.id } : null,
      // ──────────────────────────────────────────────────────────
      context:      [],
      tools:        [],
      forwarded_props: {},
    }),
  });

  if (!agentRes.ok || !agentRes.body) {
    return new Response(
      JSON.stringify({ error: "Enterprise agent unreachable" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    const reader = agentRes.body!.getReader();
    let buffer = "";
    const dashboardCallIds = new Set<string>();

    try {
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

            const toolCallName = event.toolCallName ?? event.tool_call_name;
            const toolCallId   = event.toolCallId   ?? event.tool_call_id;

            if (event.type === "TOOL_CALL_START" && toolCallName === "generate_dashboard") {
              dashboardCallIds.add(toolCallId);
            }

            if (event.type === "TEXT_MESSAGE_CONTENT" || event.type === "RUN_STEP_DELTA") {
              const delta: string = event.delta ?? event.content ?? event.text ?? "";
              if (delta) {
                await writer.write(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
              }
            }

            if (event.type === "TOOL_CALL_RESULT" && dashboardCallIds.has(toolCallId)) {
              try {
                let val: any = event.content;
                for (let i = 0; i < 5; i++) {
                  if (typeof val !== "string") break;
                  try { val = JSON.parse(val); } catch { break; }
                }

                let rawResult = "";
                if (val && typeof val === "object" && val.result) {
                  rawResult = String(val.result);
                } else if (typeof val === "string") {
                  rawResult = val;
                }

                if (rawResult.startsWith("[dashboard_id:")) {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ delta: "\n\n" + rawResult })}\n\n`));
                } else if (val && typeof val === "object" && val.type === "dashboard") {
                  await writer.write(encoder.encode(`data: ${JSON.stringify({ dashboard: val })}\n\n`));
                }
              } catch (err) {
                console.error("[API] Error processing dashboard tool result:", err);
              }
            }
          } catch {
            // non-JSON line — ignore
          }
        }
      }
    } finally {
      await writer.write(encoder.encode("data: [DONE]\n\n"));
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  });
}