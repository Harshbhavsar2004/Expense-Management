"use client";

import { useEffect, useRef, useState } from "react";
import {
  useCopilotChat,
  useCopilotReadable,
  useCopilotAction,
} from "@copilotkit/react-core";
import { CopilotChat } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import {
  X,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Mic,
  MicOff,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Download,
  GripHorizontal,
  Maximize2,
  Terminal,
} from "lucide-react";
import {
  motion,
  AnimatePresence,
  useDragControls,
  useMotionValue,
} from "framer-motion";
import { ExpenseRow } from "./ExpensesTable";

/* ─────────────────────────────────────
   Types
───────────────────────────────────── */
interface AuditAgentProps {
  selectedRecord: ExpenseRow | null;
  onClose: () => void;
  application?: any;
  expenses?: ExpenseRow[];
  onSubmitForApproval?: () => Promise<void>;
}

/* ─────────────────────────────────────
   Helpers
───────────────────────────────────── */
function stripEmbeddings<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripEmbeddings) as unknown as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "embedding")
        .map(([key, val]) => [key, stripEmbeddings(val)])
    ) as unknown as T;
  }
  return value;
}

function downloadExcel(application: any, expenses: ExpenseRow[]) {
  const headers = [
    "Expense ID","Date","Type","Sub Category",
    "Claimed Amount","Receipt Amount","Amount Match",
    "Date Match","Mismatches","Audit Explanation",
    "City","City Tier","Participant Count","Verified",
  ];
  const rows = expenses.map((e) => [
    e.id ?? "",
    e.date_range ?? "",
    e.expense_type ?? "",
    e.sub_category ?? "",
    e.claimed_amount ?? "",
    e.total_receipt_amount ?? "",
    e.amount_match ? "Yes" : "No",
    e.date_match ? "Yes" : "No",
    Array.isArray(e.mismatches) ? e.mismatches.join("; ") : "",
    (e.audit_explanation ?? "").replace(/,/g, " ").replace(/\n/g, " "),
    e.city ?? "",
    e.city_tier ?? "",
    e.participant_count ?? "",
    e.verified ? "Yes" : "No",
  ]);
  const appInfo = [
    ["Application Report"],[""],
    ["Application ID", application?.application_id ?? ""],
    ["Client", application?.client_name ?? ""],
    ["City", application?.city ?? ""],
    ["City Tier", application?.city_tier ?? ""],
    ["Visit Duration", application?.visit_duration ?? ""],
    ["Participant Count", application?.participant_count ?? ""],
    [""],["Expense Details"],[""],
  ];
  const csv =
    appInfo.map((r) => r.join(",")).join("\n") +
    "\n" +
    [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Expense_Report_${application?.application_id ?? "export"}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ─────────────────────────────────────
   Chat options
───────────────────────────────────── */
interface ChatOptionsProps { onSelect: (msg: string) => void }
function ChatOptions({ onSelect }: ChatOptionsProps) {
  const options = [
    { icon: <AlertCircle size={14} />, label: "Mismatches",    msg: "Explain all the mismatches found in this application" },
    { icon: <Clock size={14} />,        label: "Audit Timeline", msg: "Show me the full audit timeline for all expenses" },
    { icon: <DollarSign size={14} />,   label: "Reimbursable",  msg: "What are the reimbursable amounts for each expense based on policy?" },
    { icon: <FileText size={14} />,     label: "Summary",       msg: "Give me a full summary report of this expense application" },
    { icon: <ShieldCheck size={14} />,  label: "Submit Now",    msg: "Submit this application for approval" },
  ];
  return (
    <div className="ea-chat-options">
      <span className="ea-chat-options-label">CHOOSE AN OPTION</span>
      <div className="ea-chat-options-grid">
        {options.map((o) => (
          <button key={o.label} className="ea-chat-option-btn" onClick={() => onSelect(o.msg)}>
            <span className="ea-chat-option-icon">{o.icon}</span>
            <span className="ea-chat-option-text">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   Result cards
───────────────────────────────────── */
function MismatchCard({ data }: { data: any }) {
  const sources: Record<string, string> = data.sources ?? {};
  return (
    <div className="ea-card">
      <div className="ea-card-header" style={{ background: "#FEF3C7", borderColor: "#FDE68A" }}>
        <AlertCircle size={13} color="#D97706" />
        <span style={{ color: "#92400E", fontWeight: 600, fontSize: 12 }}>Mismatch — {data.expense_type}</span>
      </div>
      <div className="ea-card-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(data.mismatches ?? []).map((m: string) => (
            <div key={m} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="ea-badge ea-badge-amber" style={{ alignSelf: "flex-start" }}>{m.replace(/_/g, " ")}</span>
              {sources[m] && (
                <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 6, padding: "5px 8px", display: "flex", alignItems: "flex-start", gap: 5 }}>
                  <span style={{ fontSize: 10, color: "#B45309", flexShrink: 0, marginTop: 1 }}>⊙</span>
                  <span style={{ fontSize: 11, color: "#78350F", lineHeight: 1.4 }}>{sources[m]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineCard({ data }: { data: any }) {
  return (
    <div className="ea-card">
      <div className="ea-card-header" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
        <Clock size={13} color="#2563EB" />
        <span style={{ color: "#1E40AF", fontWeight: 600, fontSize: 12 }}>Audit Timeline — {data.expense_type}</span>
      </div>
      <div className="ea-card-body">
        {(data.steps ?? []).map((step: string, i: number) => (
          <div key={i} className="ea-timeline-step">
            <span className="ea-timeline-dot">{i + 1}</span>
            <span className="ea-card-text">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReimbursableCard({ data }: { data: any }) {
  const isOver = (data.reimbursable ?? 0) < (data.claimed ?? 0);
  return (
    <div className="ea-card">
      <div className="ea-card-header" style={{ background: "#ECFDF5", borderColor: "#A7F3D0" }}>
        <DollarSign size={13} color="#059669" />
        <span style={{ color: "#065F46", fontWeight: 600, fontSize: 12 }}>Reimbursable — {data.expense_type}</span>
      </div>
      <div className="ea-card-body">
        <div className="ea-amount-row">
          <div className="ea-amount-item">
            <span className="ea-amount-label">Claimed</span>
            <span className="ea-amount-value">₹{data.claimed}</span>
          </div>
          <span className="ea-amount-sep">→</span>
          <div className="ea-amount-item">
            <span className="ea-amount-label">Reimbursable</span>
            <span className="ea-amount-value" style={{ color: isOver ? "#DC2626" : "#059669" }}>₹{data.reimbursable}</span>
          </div>
        </div>
        {isOver && <p className="ea-card-text" style={{ color: "#991B1B", marginTop: 6 }}>Exceeds policy cap by ₹{data.claimed - data.reimbursable}</p>}
        {data.policy_note && <p className="ea-card-text" style={{ marginTop: 4 }}>{data.policy_note}</p>}
      </div>
    </div>
  );
}

function SummaryCard({ data, onDownload }: { data: any; onDownload: () => void }) {
  return (
    <div className="ea-card">
      <div className="ea-card-header" style={{ background: "#EFF6FF", borderColor: "#BFDBFE" }}>
        <FileText size={13} color="#2563EB" />
        <span style={{ color: "#1E40AF", fontWeight: 600, fontSize: 12 }}>Application Summary</span>
      </div>
      <div className="ea-card-body">
        <div className="ea-summary-grid">
          {[
            { label: "Total Claimed",      value: `₹${data.total_claimed}`,      color: "#0F172A" },
            { label: "Total Reimbursable", value: `₹${data.total_reimbursable}`, color: "#059669" },
            { label: "Flagged Expenses",   value: data.flagged_count,             color: "#DC2626" },
            { label: "Clean Expenses",     value: data.clean_count,               color: "#059669" },
          ].map((item) => (
            <div key={item.label} className="ea-summary-item">
              <span className="ea-summary-label">{item.label}</span>
              <span className="ea-summary-value" style={{ color: item.color }}>{item.value}</span>
            </div>
          ))}
        </div>
        {data.flag_types && (
          <div style={{ marginTop: 8 }}>
            {Object.entries(data.flag_types).map(([k, v]) => (
              <span key={k} className="ea-badge ea-badge-red">{k}: {String(v)}</span>
            ))}
          </div>
        )}
        <button className="ea-download-btn" onClick={onDownload}>
          <Download size={13} /> Download Excel Report
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   Size / resize constants
───────────────────────────────────── */
const DEFAULT_W = 750;
const DEFAULT_H = 580;
const MIN_W = 360;
const MAX_W = 1100;
const MIN_H = 300;
const MAX_H = 860;

/* Terminal mode */
const TERMINAL_DEFAULT_H = 300;
const TERMINAL_MIN_H = 140;
const TERMINAL_MAX_H = 620;
const SNAP_ZONE_PX = 110; // px from bottom edge to trigger snap preview

/* ─────────────────────────────────────
   Main component
───────────────────────────────────── */
export function AuditAgent({
  selectedRecord,
  onClose,
  application,
  expenses,
  onSubmitForApproval,
}: AuditAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const [size, setSize] = useState({ w: DEFAULT_W, h: DEFAULT_H });
  const [terminalMode, setTerminalMode] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(TERMINAL_DEFAULT_H);
  const [snapPreview, setSnapPreview] = useState(false);
  const [sidebarLeft, setSidebarLeft] = useState(236);
  const recognitionRef = useRef<any>(null);

  /* ── Framer Motion drag ── */
  const dragControls = useDragControls();
  const motionX = useMotionValue(0);
  const motionY = useMotionValue(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    motionX.set(window.innerWidth - 28 - DEFAULT_W);
    motionY.set(window.innerHeight - 92 - DEFAULT_H);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Resize ── */
  const handleResize = (e: React.PointerEvent, dir: "se" | "s" | "e") => {
    // Block both React synthetic and native DOM listeners (including framer-motion internals)
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    // Capture pointer so moves are tracked even when cursor leaves the handle
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.w;
    const startH = size.h;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      setSize({
        w: dir !== "s" ? Math.min(MAX_W, Math.max(MIN_W, startW + dx)) : startW,
        h: dir !== "e" ? Math.min(MAX_H, Math.max(MIN_H, startH + dy)) : startH,
      });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ── Terminal resize (drags top edge upward) ── */
  const handleTerminalResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    const startY = e.clientY;
    const startH = terminalHeight;

    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY; // negative when dragging up
      setTerminalHeight(Math.min(TERMINAL_MAX_H, Math.max(TERMINAL_MIN_H, startH - dy)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ── Pop terminal back out to floating ── */
  const popOutFromTerminal = () => {
    setTerminalMode(false);
    if (typeof window !== "undefined") {
      motionX.set(Math.max(20, (window.innerWidth - size.w) / 2));
      motionY.set(Math.max(20, (window.innerHeight - size.h) / 2));
    }
  };

  /* ── Snap-to-terminal detection while dragging ── */
  const onDragUpdate = () => {
    if (typeof window === "undefined") return;
    const bottom = motionY.get() + size.h;
    const nearBottom = bottom > window.innerHeight - SNAP_ZONE_PX;
    if (nearBottom) {
      const sidebar = document.getElementById("employee-sidebar");
      setSidebarLeft(sidebar ? sidebar.getBoundingClientRect().width : 236);
    }
    setSnapPreview(nearBottom);
  };

  const onDragEnd = () => {
    if (typeof window === "undefined") return;
    const bottom = motionY.get() + size.h;
    if (bottom > window.innerHeight - SNAP_ZONE_PX) {
      // Measure the actual sidebar width at snap time (handles collapsed/expanded)
      const sidebar = document.getElementById("employee-sidebar");
      setSidebarLeft(sidebar ? sidebar.getBoundingClientRect().width : 236);
      setTerminalMode(true);
    }
    setSnapPreview(false);
  };

  /* ── Readable context ── */
  useCopilotReadable({ description: "Current expense application", value: stripEmbeddings(application) });
  useCopilotReadable({ description: "All expenses in this application", value: stripEmbeddings(expenses) });
  useCopilotReadable({ description: "Currently selected expense record", value: stripEmbeddings(selectedRecord) });

  /* ── appendMessage must be declared BEFORE actions so render closures can use it ── */
  const { appendMessage } = useCopilotChat();

  /* ── Actions ── */
  useCopilotAction({
    name: "show_quick_options_tool",
    description: "Always call this tool immediately after your first greeting message to show the user their available quick options as interactive buttons inside the chat.",
    parameters: [],
    handler: async () => "Options displayed.",
    render: () => (
      <ChatOptions
        onSelect={(msg) => {
          (appendMessage as any)({
            id: Math.random().toString(36).substring(7),
            role: "user",
            content: msg,
            isResultMessage: () => false,
            isExecutionMessage: () => false,
            isTextMessage: () => true,
          });
        }}
      />
    ),
  });

  useCopilotAction({
    name: "submit_for_approval_tool",
    description: "Submits the current expense application for admin approval.",
    parameters: [{ name: "reason", type: "string", required: false }],
    handler: async () => {
      if (onSubmitForApproval) {
        await onSubmitForApproval();
        return "Application has been submitted for approval.";
      }
      return "Unable to submit at this time.";
    },
  });

  useCopilotAction({
    name: "explain_mismatch_tool",
    description: "Renders a formatted mismatch explanation card for a specific expense.",
    parameters: [
      { name: "expense_id",   type: "string", required: true },
      { name: "expense_type", type: "string", required: false },
      { name: "explanation",  type: "string", required: true },
      { name: "mismatches",   type: "object", required: false },
      { name: "sources",      type: "object", required: false },
    ],
    handler: async ({ expense_id }) => `Mismatch explained for expense ${expense_id}.`,
    render: ({ args }) => (
      <MismatchCard data={{ expense_type: args.expense_type ?? "Expense", explanation: args.explanation ?? "", mismatches: args.mismatches ?? [], sources: args.sources ?? {} }} />
    ),
  });

  useCopilotAction({
    name: "get_audit_timeline_tool",
    description: "Renders the step-by-step audit thought process timeline for an expense.",
    parameters: [
      { name: "expense_id",   type: "string", required: true },
      { name: "expense_type", type: "string", required: false },
      { name: "steps",        type: "object", required: true },
    ],
    handler: async ({ expense_id }) => `Audit timeline shown for expense ${expense_id}.`,
    render: ({ args }) => (
      <TimelineCard data={{ expense_type: args.expense_type ?? "Expense", steps: args.steps ?? [] }} />
    ),
  });

  useCopilotAction({
    name: "get_reimbursable_amount_tool",
    description: "Renders a policy-capped reimbursable amount card for an expense.",
    parameters: [
      { name: "expense_id",   type: "string", required: true },
      { name: "expense_type", type: "string", required: false },
      { name: "claimed",      type: "number", required: true },
      { name: "reimbursable", type: "number", required: true },
      { name: "policy_note",  type: "string", required: false },
    ],
    handler: async ({ expense_id }) => `Reimbursable amount shown for expense ${expense_id}.`,
    render: ({ args }) => (
      <ReimbursableCard data={{ expense_type: args.expense_type ?? "Expense", claimed: args.claimed ?? 0, reimbursable: args.reimbursable ?? 0, policy_note: args.policy_note ?? "" }} />
    ),
  });

  useCopilotAction({
    name: "get_summary_report_tool",
    description: "Renders a full summary card of the expense application with totals, flag counts, and a download button.",
    parameters: [
      { name: "total_claimed",      type: "number", required: true },
      { name: "total_reimbursable", type: "number", required: true },
      { name: "flagged_count",      type: "number", required: true },
      { name: "clean_count",        type: "number", required: true },
      { name: "flag_types",         type: "object", required: false },
    ],
    handler: async () => "Summary report generated.",
    render: ({ args }) => (
      <SummaryCard data={args} onDownload={() => downloadExcel(application, expenses ?? [])} />
    ),
  });

  /* ── Voice recognition ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      if (t) (appendMessage as any)({ role: "user", content: t });
      setIsRecording(false);
    };
    rec.onerror = () => setIsRecording(false);
    rec.onend   = () => setIsRecording(false);
    recognitionRef.current = rec;
  }, [appendMessage]);

  const toggleRecording = () => {
    if (isRecording) recognitionRef.current?.stop();
    else { recognitionRef.current?.start(); setIsRecording(true); }
  };

  useEffect(() => {
    if (!isOpen) setHasUnread(false);
  }, [isOpen]);

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Figtree:wght@400;500&display=swap');

        /* ── Trigger ── */
        .ea-trigger {
          position: fixed;
          top: 50%;
          right: -12px;
          transform: translateY(-50%);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 24px 10px 14px;
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          border: 1px solid rgba(255,255,255,0.1);
          border-right: none;
          border-radius: 20px 0 0 20px;
          cursor: pointer;
          box-shadow: -4px 0 24px rgba(0,0,0,0.25);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          font-family: 'Figtree', sans-serif;
        }
        .ea-trigger:hover {
          right: 0;
          padding-left: 18px;
          background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
          box-shadow: -6px 0 32px rgba(124,58,237,0.2);
        }
        .ea-trigger-icon {
          width: 38px; height: 38px;
          background: linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: transform 0.3s ease;
          box-shadow: 0 4px 12px rgba(124,58,237,0.3);
        }
        .ea-trigger:hover .ea-trigger-icon { transform: scale(1.1) rotate(5deg); }
        .ea-trigger-badge {
          position: absolute; top: -3px; right: -3px;
          width: 11px; height: 11px;
          background: #EF4444; border-radius: 50%; border: 2px solid white;
          display: ${hasUnread ? "block" : "none"};
          animation: ea-badge-pulse 1.5s ease-in-out infinite;
        }
        @keyframes ea-badge-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.25)} }

        /* ── Drag handle ── */
        .ea-drag-handle {
          cursor: grab;
          user-select: none;
          -webkit-user-select: none;
        }
        .ea-drag-handle:active { cursor: grabbing; }

        /* ── Header ── */
        .ea-header {
          background: #FFFFFF; padding: 10px 20px;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0; border-bottom: 1px solid #F1F5F9;
        }
        .ea-header-left { display: flex; align-items: center; gap: 12px; }
        .ea-avatar {
          width: 32px; height: 32px; border-radius: 8px; background: #2563EB;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .ea-header-name {
          font-size: 15px; font-weight: 700; color: #0F172A;
          font-family: 'DM Sans', sans-serif; letter-spacing: -.01em;
        }
        .ea-header-actions { display: flex; align-items: center; gap: 12px; }
        .ea-header-btn {
          color: #94A3B8; cursor: pointer; transition: color .2s;
          background: none; border: none; padding: 0; display: flex; align-items: center;
        }
        .ea-header-btn:hover { color: #475569; }

        /* ── Status bar ── */
        .ea-status-bar {
          padding: 8px 20px 6px;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0; border-bottom: 1px solid #F8FAFC;
        }
        .ea-online-dot {
          width: 7px; height: 7px; background: #10B981; border-radius: 50%;
          margin-right: 6px; animation: ea-pulse 2s ease-in-out infinite;
        }
        @keyframes ea-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .ea-online-text { font-size: 11px; color: #94A3B8; font-weight: 500; display: flex; align-items: center; }
        .ea-date-text { font-size: 11px; color: #94A3B8; font-weight: 500; }

        /* ── Size indicator ── */
        .ea-size-indicator {
          font-size: 10px; color: #CBD5E1; font-family: 'Figtree', monospace;
          font-weight: 500; letter-spacing: 0.02em;
        }

        /* ── Chat body ── */
        .ea-body {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          background: #FFFFFF; overflow: hidden;
        }
        /* Force CopilotKit root to fill and flex-column */
        .ea-body > div {
          flex: 1 !important;
          min-height: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          overflow: hidden !important;
        }

        /* ── Messages area scrolls ── */
        .ea-body [class*="Messages"],
        .ea-body [class*="messages"] {
          flex: 1 1 auto !important;
          overflow-y: auto !important;
          min-height: 0 !important;
        }

        /* ── Input pinned to bottom (works for all CopilotKit class name styles) ── */
        .ea-body [class*="InputContainer"],
        .ea-body [class*="input-container"],
        .ea-body [class*="inputContainer"],
        .ea-body .copilot-kit-input-container {
          flex-shrink: 0 !important;
          order: 999 !important;
          background: #FFFFFF !important;
          border-top: 1px solid #F1F5F9 !important;
          padding: 10px 20px 38px !important;
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
        }

        /* ── Bubbles ── */
        .ea-body [class*="AssistantMessage"],
        .ea-body [class*="assistant-message"],
        .ea-body .copilot-kit-assistant-message {
          background: #F8FAFC !important; color: #1E293B !important;
          border-radius: 12px 12px 12px 0 !important;
          border: none !important; box-shadow: none !important;
          font-size: 13.5px !important; line-height: 1.6 !important;
        }
        .ea-body [class*="UserMessage"],
        .ea-body [class*="user-message"],
        .ea-body .copilot-kit-user-message {
          background: #2563EB !important; color: #FFFFFF !important;
          border-radius: 12px 12px 0 12px !important;
          font-size: 13.5px !important; line-height: 1.6 !important;
        }

        /* ── Input field ── */
        .ea-body [class*="InputContainer"] input,
        .ea-body [class*="input-container"] input,
        .ea-body .copilot-kit-input {
          flex: 1 !important; background: #F1F5F9 !important;
          border: none !important; border-radius: 24px !important;
          padding: 10px 18px !important; font-size: 13.5px !important;
          box-shadow: none !important; transition: background .2s !important;
        }
        .ea-body [class*="InputContainer"] input:focus,
        .ea-body .copilot-kit-input:focus { background: #ECEFF1 !important; outline: none !important; }

        /* ── Send button ── */
        .ea-body [class*="SendButton"],
        .ea-body [class*="send-button"],
        .ea-body .copilot-kit-send-button {
          background: #2563EB !important; border-radius: 50% !important;
          width: 32px !important; height: 32px !important; min-width: 32px !important;
          color: white !important; display: flex !important;
          align-items: center !important; justify-content: center !important;
          transition: transform .2s !important;
        }
        .ea-body [class*="SendButton"]:hover,
        .ea-body .copilot-kit-send-button:hover { transform: scale(1.05); background: #1D4ED8 !important; }

        /* ── Mic ── */
        .ea-input-extras {
          display: flex; align-items: center; flex-shrink: 0;
        }
        .ea-extra-icon {
          color: #94A3B8; cursor: pointer; transition: color .15s;
          background: none; border: none; padding: 0; display: flex; align-items: center;
        }
        .ea-extra-icon:hover { color: #64748B; }
        .ea-extra-icon.recording { color: #EF4444; }

        /* ── Resize handles ── */
        .ea-resize-e {
          position: absolute; top: 12px; right: -3px; bottom: 12px; width: 10px;
          cursor: ew-resize; z-index: 200;
          touch-action: none;
        }
        .ea-resize-e:hover { background: rgba(37,99,235,0.15); border-radius: 0 4px 4px 0; }
        .ea-resize-s {
          position: absolute; left: 12px; right: 12px; bottom: -3px; height: 10px;
          cursor: ns-resize; z-index: 200;
          touch-action: none;
        }
        .ea-resize-s:hover { background: rgba(37,99,235,0.15); border-radius: 0 0 4px 4px; }
        .ea-resize-se {
          position: absolute; right: -2px; bottom: -2px; width: 22px; height: 22px;
          cursor: se-resize; z-index: 201;
          touch-action: none;
          display: flex; align-items: flex-end; justify-content: flex-end;
          padding: 4px;
        }
        .ea-resize-se::after {
          content: '';
          display: block;
          width: 10px; height: 10px;
          border-right: 2.5px solid #CBD5E1;
          border-bottom: 2.5px solid #CBD5E1;
          border-radius: 0 0 3px 0;
          transition: border-color .15s;
        }
        .ea-resize-se:hover::after { border-color: #2563EB; }

        /* ── Chat option buttons ── */
        .ea-chat-options { display: flex; flex-direction: column; gap: 6px; padding: 4px 0 2px; width: 100%; }
        .ea-chat-options-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 4px; }
        .ea-chat-options-grid :last-child:nth-child(odd) { grid-column: span 2; }
        .ea-chat-options-label {
          font-size: 10px; font-weight: 700; color: #64748B; letter-spacing: .05em;
          margin-bottom: 4px; font-family: 'DM Sans', sans-serif; display: block;
        }
        .ea-chat-option-btn {
          display: flex; align-items: center; gap: 8px; padding: 8px 12px;
          background: #FFFFFF; border: 1px solid #0F172A; border-radius: 8px;
          cursor: pointer; transition: all .2s ease;
          font-family: 'Figtree', sans-serif; text-align: left;
        }
        .ea-chat-option-btn:hover {
          background: #0F172A; color: #FFFFFF;
          transform: translateY(-1.5px); box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }
        .ea-chat-option-btn:hover .ea-chat-option-icon,
        .ea-chat-option-btn:hover .ea-chat-option-text { color: #FFFFFF; }
        .ea-chat-option-icon { color: #0F172A; display: flex; align-items: center; flex-shrink: 0; transition: color .2s; }
        .ea-chat-option-text { font-size: 11px; font-weight: 600; color: #0F172A; transition: color .2s; }

        /* ── Result cards ── */
        .ea-card { border-radius: 10px; border: 1px solid #E2E8F0; overflow: hidden; margin: 2px 0; font-family: 'Figtree', sans-serif; width: 100%; }
        .ea-card-header { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid; }
        .ea-card-body { padding: 10px 12px; }
        .ea-card-text { font-size: 12px; color: #475569; line-height: 1.55; margin: 0; }
        .ea-badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 20px; margin: 4px 4px 0 0; }
        .ea-badge-amber { background: #FEF3C7; color: #92400E; }
        .ea-badge-red   { background: #FEE2E2; color: #991B1B; }
        .ea-timeline-step { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
        .ea-timeline-dot { width: 18px; height: 18px; border-radius: 50%; background: #EFF6FF; color: #2563EB; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .ea-amount-row { display: flex; align-items: center; gap: 12px; }
        .ea-amount-item { display: flex; flex-direction: column; gap: 2px; }
        .ea-amount-label { font-size: 10px; color: #94A3B8; font-weight: 500; }
        .ea-amount-value { font-size: 16px; font-weight: 700; color: #0F172A; }
        .ea-amount-sep { font-size: 16px; color: #CBD5E1; }
        .ea-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ea-summary-item { background: #F8FAFC; border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
        .ea-summary-label { font-size: 10px; color: #94A3B8; font-weight: 500; }
        .ea-summary-value { font-size: 15px; font-weight: 700; }
        .ea-download-btn {
          display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 8px 14px;
          background: #0F172A; color: white; border: none; border-radius: 8px;
          font-size: 12px; font-weight: 600; cursor: pointer; width: 100%;
          justify-content: center; transition: background .15s; font-family: 'Figtree', sans-serif;
        }
        .ea-download-btn:hover { background: #1E293B; }

        /* ── Terminal mode ── */
        .ea-terminal-resize-handle {
          position: absolute;
          top: -4px; left: 0; right: 0; height: 8px;
          cursor: ns-resize;
          z-index: 10;
          display: flex; align-items: center; justify-content: center;
          touch-action: none;
        }
        .ea-terminal-resize-handle::before {
          content: '';
          display: block;
          width: 40px; height: 3px;
          border-radius: 2px;
          background: rgba(255,255,255,0.15);
          transition: background 0.15s;
        }
        .ea-terminal-resize-handle:hover::before { background: rgba(0,122,204,0.7); }

        .ea-terminal-tab-bar {
          display: flex;
          align-items: center;
          padding: 0 8px;
          height: 36px;
          background: #252526;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-shrink: 0;
          gap: 0;
          user-select: none;
        }
        .ea-terminal-tab {
          display: flex; align-items: center; gap: 7px;
          padding: 0 14px;
          height: 100%;
          border-top: 2px solid #007ACC;
          background: #1E1E1E;
          color: rgba(255,255,255,0.85);
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.01em;
          font-family: 'Figtree', sans-serif;
        }
        .ea-terminal-spacer { flex: 1; }
        .ea-terminal-action-btn {
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.45);
          display: flex; align-items: center; justify-content: center;
          width: 28px; height: 28px; border-radius: 4px;
          transition: background 0.15s, color 0.15s;
        }
        .ea-terminal-action-btn:hover {
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.85);
        }
        .ea-terminal-action-btn.close:hover { background: rgba(232,17,35,0.6); color: #fff; }

        /* Snap preview overlay */
        .ea-snap-preview {
          position: fixed; bottom: 0; right: 0;
          height: ${TERMINAL_DEFAULT_H}px;
          background: rgba(0,122,204,0.06);
          border-top: 2px dashed rgba(0,122,204,0.35);
          z-index: 9998;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
          font-family: 'Figtree', sans-serif;
        }
        .ea-snap-label {
          display: flex; align-items: center; gap: 8px;
          padding: 7px 16px;
          background: rgba(0,122,204,0.15);
          border: 1px solid rgba(0,122,204,0.3);
          border-radius: 20px;
          color: #4DA6FF;
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.02em;
        }
      `}</style>

      {/* ── Trigger — hidden while panel is open ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="ea-trigger"
            className="ea-trigger"
            onClick={() => setIsOpen(true)}
            aria-label="Open AI Audit Agent"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.2 }}
          >
            <div className="ea-trigger-icon">
              <Sparkles size={18} color="white" />
            </div>
            <div className="ea-trigger-badge" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Snap-to-terminal preview overlay ── */}
      <AnimatePresence>
        {snapPreview && (
          <motion.div
            key="snap-preview"
            className="ea-snap-preview"
            style={{ left: sidebarLeft }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className="ea-snap-label">
              <Terminal size={13} />
              Drop to dock as terminal
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── Floating mode ── */}
        {isOpen && !terminalMode && (
          <motion.div
            key="floating"
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            dragElastic={0}
            onDrag={onDragUpdate}
            onDragEnd={onDragEnd}
            style={{
              x: motionX,
              y: motionY,
              position: "fixed",
              top: 0,
              left: 0,
              width: size.w,
              height: size.h,
              zIndex: 10000,
            }}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.88, y: 40 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Inner visual container */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "#FFFFFF",
              borderRadius: 20,
              boxShadow: "0 24px 64px rgba(15,23,42,.18), 0 4px 16px rgba(15,23,42,.10)",
              border: "1px solid #E2E8F0",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}>
              {/* Header — drag handle */}
              <div
                className="ea-header ea-drag-handle"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="ea-header-left">
                  <div className="ea-avatar">
                    <ShieldCheck size={16} color="white" strokeWidth={2.5} />
                  </div>
                  <div className="ea-header-name">Expify Audit AI</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <GripHorizontal size={14} color="#CBD5E1" />
                  <span className="ea-size-indicator">{Math.round(size.w)}×{Math.round(size.h)}</span>
                </div>
                <div className="ea-header-actions">
                  <button className="ea-header-btn" title="Refresh"><RotateCcw size={16} /></button>
                  <button className="ea-header-btn" onClick={() => setIsOpen(false)} title="Close">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Status bar */}
              <div className="ea-status-bar">
                <span className="ea-online-text">
                  <span className="ea-online-dot" />
                  We're online
                </span>
                <span className="ea-date-text">Oct 15, 2024</span>
              </div>

              {/* Chat body */}
              <div className="ea-body">
                <CopilotChat
                  labels={{ initial: "", placeholder: "Type a message..." }}
                  className="ea-copilot-chat"
                />
              </div>
            </div>

            {/* Resize handles */}
            <div className="ea-resize-e" onPointerDown={(e) => handleResize(e, "e")} />
            <div className="ea-resize-s" onPointerDown={(e) => handleResize(e, "s")} />
            <div className="ea-resize-se" onPointerDown={(e) => handleResize(e, "se")} />
          </motion.div>
        )}

        {/* ── Terminal mode ── */}
        {isOpen && terminalMode && (
          <motion.div
            key="terminal"
            style={{
              position: "fixed",
              bottom: 0,
              left: sidebarLeft,
              right: 0,
              height: terminalHeight,
              zIndex: 10000,
              background: "#1E1E1E",
              borderTop: "1px solid rgba(255,255,255,0.08)",
              display: "flex",
              flexDirection: "column",
            }}
            initial={{ y: terminalHeight, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: terminalHeight, opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
          >
            {/* Top resize handle */}
            <div
              className="ea-terminal-resize-handle"
              onPointerDown={handleTerminalResize}
            />

            {/* VS Code-style tab bar */}
            <div className="ea-terminal-tab-bar">
              <div className="ea-terminal-tab">
                <ShieldCheck size={13} color="#007ACC" strokeWidth={2.5} />
                EXPIFY AUDIT AI
              </div>
              <div className="ea-terminal-spacer" />
              <button
                className="ea-terminal-action-btn"
                title="Pop out to window"
                onClick={popOutFromTerminal}
              >
                <Maximize2 size={13} />
              </button>
              <button
                className="ea-terminal-action-btn"
                title="Refresh"
              >
                <RotateCcw size={13} />
              </button>
              <button
                className="ea-terminal-action-btn close"
                title="Close"
                onClick={() => setIsOpen(false)}
              >
                <X size={13} />
              </button>
            </div>

            {/* Chat content — same component, terminal container */}
            <div className="ea-body" style={{ background: "#FFFFFF" }}>
              <CopilotChat
                labels={{ initial: "", placeholder: "Type a message..." }}
                className="ea-copilot-chat"
              />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </>
  );
}
