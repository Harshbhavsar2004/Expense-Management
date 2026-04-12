// ─────────────────────────────────────────────────────────────────────────────
// session.ts — Supabase-backed session store
// Replaces the in-memory Map so sessions survive across serverless invocations.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExpenseSession } from "./types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export async function getSession(phone: string): Promise<ExpenseSession> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/whatsapp_sessions?phone=eq.${encodeURIComponent(phone)}&select=session`,
      { headers }
    );
    if (res.ok) {
      const rows: { session: ExpenseSession }[] = await res.json();
      if (rows.length > 0) return rows[0].session;
    }
  } catch (e) {
    console.error("[Session] getSession error:", e);
  }
  return { step: "idle" };
}

export async function setSession(phone: string, s: ExpenseSession): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_sessions`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ phone, session: s, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    console.error("[Session] setSession error:", e);
  }
}

export async function clearSession(phone: string): Promise<void> {
  await setSession(phone, { step: "idle" });
}
