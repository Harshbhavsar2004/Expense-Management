// ─────────────────────────────────────────────────────────────────────────────
// session.ts — In-memory session store (swap for Redis/DB in production)
// ─────────────────────────────────────────────────────────────────────────────

import type { ExpenseSession } from "./types";

const sessions = new Map<string, ExpenseSession>();

export function getSession(phone: string): ExpenseSession {
  if (!sessions.has(phone)) sessions.set(phone, { step: "idle" });
  return sessions.get(phone)!;
}

export function setSession(phone: string, s: ExpenseSession): void {
  sessions.set(phone, s);
}

export function clearSession(phone: string): void {
  sessions.set(phone, { step: "idle" });
}
