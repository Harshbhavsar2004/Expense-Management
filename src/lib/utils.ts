import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ChatSession } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ───────────────────── Date grouping helper ─────────────────── */

export function groupSessionsByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const thisWeekStart = new Date(today); thisWeekStart.setDate(today.getDate() - 7);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const groups: Record<string, ChatSession[]> = {
    "Today": [], "Yesterday": [], "This Week": [], "This Month": [], "Older": [],
  };

  for (const s of sessions) {
    const d = new Date(s.createdAt);
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    if (day >= today)               groups["Today"].push(s);
    else if (day >= yesterday)      groups["Yesterday"].push(s);
    else if (day >= thisWeekStart)  groups["This Week"].push(s);
    else if (day >= thisMonthStart) groups["This Month"].push(s);
    else                            groups["Older"].push(s);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

/* ───────────────────── Initials helper ─────────────────── */

export function initials(name: string): string {
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}
