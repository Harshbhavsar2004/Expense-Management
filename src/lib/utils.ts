import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ChatSession } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function groupSessionsByDate(
  sessions: ChatSession[]
): { label: string; items: ChatSession[] }[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOf7DaysAgo = new Date(startOfToday.getTime() - 7 * 86_400_000);
  const startOf30DaysAgo = new Date(startOfToday.getTime() - 30 * 86_400_000);

  const buckets: Record<string, ChatSession[]> = {
    Today: [],
    Yesterday: [],
    "Previous 7 days": [],
    "Previous 30 days": [],
    Older: [],
  };

  for (const session of sessions) {
    const d = new Date(session.createdAt);
    if (d >= startOfToday) buckets["Today"].push(session);
    else if (d >= startOfYesterday) buckets["Yesterday"].push(session);
    else if (d >= startOf7DaysAgo) buckets["Previous 7 days"].push(session);
    else if (d >= startOf30DaysAgo) buckets["Previous 30 days"].push(session);
    else buckets["Older"].push(session);
  }

  return Object.entries(buckets)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}
