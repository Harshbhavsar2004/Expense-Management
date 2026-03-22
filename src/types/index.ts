"use client";

/* ─────────────────────────── Shared Types ─────────────────────────── */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; type: string; url?: string }[];
  timestamp: string;
  isVoice?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
}

export interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "pdf" | "other";
}

export interface MentionUser {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
  email: string | null;
}

export interface AppliedMention {
  display: string;
  withId: string;
}

/* ─────────────────────────── Dashboard Types ─────────────────────────── */

export interface DashboardChartItem {
  label: string;
  value: number;
  color: string;
}

export interface DashboardTableRow {
  [key: string]: string | number;
}

export interface DashboardChart {
  type: "bar" | "donut" | "line" | "table";
  title: string;
  data: any[];
  unit?: string;
  /** For Donut: mapping keys */
  value_key?: string;
  category_key?: string;
  /** For Bar/Line: mapping keys */
  x_key?: string;
  y_key?: string;
  series_key?: string;
  x_title?: string;
  y_title?: string;
  colors?: string[];
  /** For table charts */
  columns?: any[];
  rows?: DashboardTableRow[];
}

export interface DashboardSpec {
  type: "dashboard";
  title: string;
  charts: DashboardChart[];
}
