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
  ChevronDown,
  Sparkles,
  Mic,
  MicOff,
  AlertCircle,
  Clock,
  DollarSign,
  FileText,
  Download,
  CheckCircle,
} from "lucide-react";
import { ExpenseRow } from "./ExpensesTable";

interface AuditAgentProps {
  selectedRecord: ExpenseRow | null;
  onClose: () => void;
  application?: any;
  expenses?: ExpenseRow[];
  onSubmitForApproval?: () => Promise<void>;
}

/* ─────────────────────────────────────
   CSV / Excel download utility
───────────────────────────────────── */
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
   Inline chat option buttons
   (rendered by the agent after greeting)
───────────────────────────────────── */
interface ChatOptionsProps {
  onSelect: (msg: string) => void;
}
function ChatOptions({ onSelect }: ChatOptionsProps) {
  const options = [
    {
      icon: <AlertCircle size={14} />,
      label: "Mismatches",
      msg: "Explain all the mismatches found in this application",
    },
    {
      icon: <Clock size={14} />,
      label: "Audit Timeline",
      msg: "Show me the full audit timeline for all expenses",
    },
    {
      icon: <DollarSign size={14} />,
      label: "Reimbursable",
      msg: "What are the reimbursable amounts for each expense based on policy?",
    },
    {
      icon: <FileText size={14} />,
      label: "Summary",
      msg: "Give me a full summary report of this expense application",
    },
    {
      icon: <ShieldCheck size={14} />,
      label: "Submit Now",
      msg: "Submit this application for approval",
    },
  ];
  return (
    <div className="ea-chat-options">
      <span className="ea-chat-options-label">CHOOSE AN OPTION</span>
      <div className="ea-chat-options-grid">
        {options.map((o) => (
          <button
            key={o.label}
            className="ea-chat-option-btn"
            onClick={() => onSelect(o.msg)}
          >
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
        <span style={{ color: "#92400E", fontWeight: 600, fontSize: 12 }}>
          Mismatch — {data.expense_type}
        </span>
      </div>
      <div className="ea-card-body">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(data.mismatches ?? []).map((m: string) => (
            <div key={m} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="ea-badge ea-badge-amber" style={{ alignSelf: "flex-start" }}>{m.replace(/_/g, " ")}</span>
              {sources[m] && (
                <div style={{
                  background: "#FFFBEB",
                  border: "1px solid #FDE68A",
                  borderRadius: 6,
                  padding: "5px 8px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 5,
                }}>
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
        <span style={{ color: "#1E40AF", fontWeight: 600, fontSize: 12 }}>
          Audit Timeline — {data.expense_type}
        </span>
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
        <span style={{ color: "#065F46", fontWeight: 600, fontSize: 12 }}>
          Reimbursable — {data.expense_type}
        </span>
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
            <span className="ea-amount-value" style={{ color: isOver ? "#DC2626" : "#059669" }}>
              ₹{data.reimbursable}
            </span>
          </div>
        </div>
        {isOver && (
          <p className="ea-card-text" style={{ color: "#991B1B", marginTop: 6 }}>
            Exceeds policy cap by ₹{data.claimed - data.reimbursable}
          </p>
        )}
        {data.policy_note && (
          <p className="ea-card-text" style={{ marginTop: 4 }}>{data.policy_note}</p>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ data, onDownload }: { data: any; onDownload: () => void }) {
  return (
    <div className="ea-card">
      <div className="ea-card-header" style={{ background: "#F5F3FF", borderColor: "#DDD6FE" }}>
        <FileText size={13} color="#7C3AED" />
        <span style={{ color: "#4C1D95", fontWeight: 600, fontSize: 12 }}>Application Summary</span>
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
          <Download size={13} />
          Download Excel Report
        </button>
      </div>
    </div>
  );
}

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
  const recognitionRef = useRef<any>(null);

  /* ── Readable context ── */
  useCopilotReadable({ description: "Current expense application", value: application });
  useCopilotReadable({ description: "All expenses in this application", value: expenses });
  useCopilotReadable({ description: "Currently selected expense record", value: selectedRecord });

  /* ── Actions ── */

  /**
   * showQuickOptions — agent calls this after its greeting to render
   * the inline option buttons inside the chat bubble area.
   */
  useCopilotAction({
    name: "show_quick_options_tool",
    description:
      "Always call this tool immediately after your first greeting message to show the user their available quick options as interactive buttons inside the chat.",
    parameters: [],
    handler: async () => "Options displayed.",
    render: () => {
      const { appendMessage } = useCopilotChat();
      return (
        <ChatOptions
          onSelect={(msg) => {
            (appendMessage as any)({
              id: Math.random().toString(36).substring(7),
              role: "user",
              content: msg,
              // Mock methods that CopilotKit core/ui might call on message objects
              isResultMessage: () => false,
              isExecutionMessage: () => false,
              isTextMessage: () => true,
            });
          }}
        />
      );
    },
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
      <MismatchCard
        data={{
          expense_type: args.expense_type ?? "Expense",
          explanation:  args.explanation  ?? "",
          mismatches:   args.mismatches   ?? [],
          sources:      args.sources      ?? {},
        }}
      />
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
      <TimelineCard
        data={{
          expense_type: args.expense_type ?? "Expense",
          steps:        args.steps        ?? [],
        }}
      />
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
      <ReimbursableCard
        data={{
          expense_type: args.expense_type ?? "Expense",
          claimed:      args.claimed      ?? 0,
          reimbursable: args.reimbursable ?? 0,
          policy_note:  args.policy_note  ?? "",
        }}
      />
    ),
  });

  useCopilotAction({
    name: "get_summary_report_tool",
    description:
      "Renders a full summary card of the expense application with totals, flag counts, and a download button.",
    parameters: [
      { name: "total_claimed",      type: "number", required: true },
      { name: "total_reimbursable", type: "number", required: true },
      { name: "flagged_count",      type: "number", required: true },
      { name: "clean_count",        type: "number", required: true },
      { name: "flag_types",         type: "object", required: false },
    ],
    handler: async () => "Summary report generated.",
    render: ({ args }) => (
      <SummaryCard
        data={args}
        onDownload={() => downloadExcel(application, expenses ?? [])}
      />
    ),
  });

  const { appendMessage } = useCopilotChat();

  /* ── Voice recognition ── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR =
      (window as any).webkitSpeechRecognition ||
      (window as any).SpeechRecognition;
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
          position: fixed; bottom: 28px; right: 28px; z-index: 9999;
          display: flex; align-items: center; gap: 10px;
          padding: 0 20px 0 6px; height: 52px;
          background: #0F172A; border: none; border-radius: 999px;
          cursor: pointer;
          box-shadow: 0 8px 28px rgba(15,23,42,.28), 0 2px 8px rgba(15,23,42,.16);
          transition: transform .2s ease, box-shadow .2s ease;
          font-family: 'Figtree', sans-serif;
        }
        .ea-trigger:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 36px rgba(15,23,42,.32), 0 4px 12px rgba(15,23,42,.18);
        }
        .ea-trigger-icon {
          width: 40px; height: 40px; background: #7C3AED; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: background .2s;
        }
        .ea-trigger:hover .ea-trigger-icon { background: #6D28D9; }
        .ea-trigger-label {
          font-size: 13px; font-weight: 600; color: white;
          letter-spacing: .01em; white-space: nowrap;
        }
        .ea-trigger-badge {
          position: absolute; top: -3px; right: -3px;
          width: 11px; height: 11px;
          background: #EF4444; border-radius: 50%; border: 2px solid white;
          display: ${hasUnread ? "block" : "none"};
          animation: ea-badge-pulse 1.5s ease-in-out infinite;
        }
        @keyframes ea-badge-pulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.25); }
        }

        /* ── Window ── */
        .ea-window {
          position: fixed; bottom: 92px; right: 28px;
          width: 750px; height: 580px;
          background: #FFFFFF; border-radius: 20px;
          box-shadow: 0 24px 64px rgba(15,23,42,.16), 0 4px 16px rgba(15,23,42,.08);
          display: flex; flex-direction: column;
          overflow: hidden; z-index: 10000;
          border: 1px solid #E2E8F0;
          transform-origin: bottom right;
          transition: opacity .25s cubic-bezier(.4,0,.2,1), transform .25s cubic-bezier(.4,0,.2,1);
          opacity: ${isOpen ? 1 : 0};
          transform: ${isOpen ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)"};
          pointer-events: ${isOpen ? "all" : "none"};
        }

        /* ── Header ── */
        .ea-header {
          background: #FFFFFF; padding: 14px 20px;
          display: flex; align-items: center; justify-content: space-between;
          flex-shrink: 0; border-bottom: 1px solid #F1F5F9;
        }
        .ea-header-left { display: flex; align-items: center; gap: 12px; }
        .ea-avatar {
          width: 32px; height: 32px; border-radius: 8px; background: #7C3AED;
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
        .ea-online-text {
          font-size: 11px; color: #94A3B8; font-weight: 500;
          display: flex; align-items: center;
        }
        .ea-date-text { font-size: 11px; color: #94A3B8; font-weight: 500; }

        /* ── Chat body ── */
        .ea-body {
          flex: 1; min-height: 0;
          display: flex; flex-direction: column;
          background: #FFFFFF; position: relative; overflow: hidden;
        }
        .ea-body > div,
        .ea-body .copilotkit-chat,
        .ea-body [class*="copilot-kit-chat"] {
          height: 100% !important;
          display: flex !important;
          flex-direction: column !important;
          min-height: 0 !important;
        }

        /* ── Bubbles ── */
        .ea-body .copilot-kit-message-row--assistant .copilot-kit-assistant-message {
          background: #F8FAFC !important; color: #1E293B !important;
          border-radius: 12px 12px 12px 0 !important;
          border: none !important; box-shadow: none !important;
          font-size: 13.5px !important; line-height: 1.6 !important;
        }
        .ea-body .copilot-kit-message-row--user .copilot-kit-user-message {
          background: #7C3AED !important; color: #FFFFFF !important;
          border-radius: 12px 12px 0 12px !important;
          font-size: 13.5px !important; line-height: 1.6 !important;
        }

        /* ── Input ── */
        .ea-body .copilot-kit-input-container {
          background: #FFFFFF !important;
          border-top: 1px solid #F1F5F9 !important;
          padding: 10px 20px 38px !important;
          display: flex !important; align-items: center !important; gap: 12px !important;
          position: absolute !important; bottom: 0 !important; left: 0 !important; right: 0 !important;
          z-index: 20 !important;
        }
        .ea-body .copilot-kit-input {
          flex: 1 !important; background: #F1F5F9 !important;
          border: none !important; border-radius: 24px !important;
          padding: 10px 18px !important; font-size: 13.5px !important;
          box-shadow: none !important; transition: background .2s !important;
        }
        .ea-body .copilot-kit-input:focus { background: #ECEFF1 !important; outline: none !important; }
        .ea-body .copilot-kit-send-button {
          background: #7C3AED !important; border-radius: 50% !important;
          width: 32px !important; height: 32px !important; min-width: 32px !important;
          color: white !important; display: flex !important;
          align-items: center !important; justify-content: center !important;
          transition: transform .2s !important;
        }
        .ea-body .copilot-kit-send-button:hover { transform: scale(1.05); background: #6D28D9 !important; }

        /* ── Mic ── */
        .ea-input-extras {
          position: absolute; bottom: 13px; left: 24px;
          display: flex; align-items: center; z-index: 30;
        }
        .ea-extra-icon {
          color: #94A3B8; cursor: pointer; transition: color .15s;
          background: none; border: none; padding: 0; display: flex; align-items: center;
        }
        .ea-extra-icon:hover { color: #64748B; }
        .ea-extra-icon.recording { color: #EF4444; }

        /* ── Inline chat option buttons (WhatsApp-style) ── */
        .ea-chat-options {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 4px 0 2px;
          width: 100%;
        }
        .ea-chat-options-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-top: 4px;
        }
        /* If odd number of buttons, make the last one span full width */
        .ea-chat-options-grid :last-child:nth-child(odd) {
          grid-column: span 2;
        }
        .ea-chat-options-label {
          font-size: 10px;
          font-weight: 700;
          color: #64748B;
          letter-spacing: .05em;
          margin-bottom: 4px;
          font-family: 'DM Sans', sans-serif;
          display: block;
        }
        .ea-chat-option-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #FFFFFF;
          border: 1px solid #0F172A;
          border-radius: 8px;
          cursor: pointer;
          transition: all .2s ease;
          font-family: 'Figtree', sans-serif;
          text-align: left;
        }
        .ea-chat-option-btn:hover {
          background: #0F172A;
          color: #FFFFFF;
          transform: translateY(-1.5px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }
        .ea-chat-option-btn:hover .ea-chat-option-icon,
        .ea-chat-option-btn:hover .ea-chat-option-text {
          color: #FFFFFF;
        }
        .ea-chat-option-icon {
          color: #0F172A;
          display: flex; align-items: center; flex-shrink: 0;
          transition: color .2s;
        }
        .ea-chat-option-text {
          font-size: 11px;
          font-weight: 600;
          color: #0F172A;
          transition: color .2s;
        }

        /* ── Result cards ── */
        .ea-card {
          border-radius: 10px; border: 1px solid #E2E8F0;
          overflow: hidden; margin: 2px 0;
          font-family: 'Figtree', sans-serif; width: 100%;
        }
        .ea-card-header {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 12px; border-bottom: 1px solid;
        }
        .ea-card-body { padding: 10px 12px; }
        .ea-card-text { font-size: 12px; color: #475569; line-height: 1.55; margin: 0; }
        .ea-badge {
          display: inline-block; font-size: 10px; font-weight: 600;
          padding: 2px 7px; border-radius: 20px; margin: 4px 4px 0 0;
        }
        .ea-badge-amber { background: #FEF3C7; color: #92400E; }
        .ea-badge-red   { background: #FEE2E2; color: #991B1B; }
        .ea-timeline-step { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
        .ea-timeline-dot {
          width: 18px; height: 18px; border-radius: 50%;
          background: #EFF6FF; color: #2563EB;
          font-size: 10px; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; margin-top: 1px;
        }
        .ea-amount-row { display: flex; align-items: center; gap: 12px; }
        .ea-amount-item { display: flex; flex-direction: column; gap: 2px; }
        .ea-amount-label { font-size: 10px; color: #94A3B8; font-weight: 500; }
        .ea-amount-value { font-size: 16px; font-weight: 700; color: #0F172A; }
        .ea-amount-sep { font-size: 16px; color: #CBD5E1; }
        .ea-summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .ea-summary-item {
          background: #F8FAFC; border-radius: 8px; padding: 8px 10px;
          display: flex; flex-direction: column; gap: 2px;
        }
        .ea-summary-label { font-size: 10px; color: #94A3B8; font-weight: 500; }
        .ea-summary-value { font-size: 15px; font-weight: 700; }
        .ea-download-btn {
          display: flex; align-items: center; gap: 6px;
          margin-top: 10px; padding: 8px 14px;
          background: #0F172A; color: white;
          border: none; border-radius: 8px;
          font-size: 12px; font-weight: 600;
          cursor: pointer; width: 100%; justify-content: center;
          transition: background .15s; font-family: 'Figtree', sans-serif;
        }
        .ea-download-btn:hover { background: #1E293B; }
      `}</style>

      {/* ── Trigger ── */}
      <button
        className="ea-trigger"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Toggle AI Audit Agent"
      >
        <div className="ea-trigger-icon">
          {isOpen
            ? <ChevronDown size={18} color="white" />
            : <Sparkles size={18} color="white" />}
        </div>
        <span className="ea-trigger-label">
          {isOpen ? "Close Agent" : "Audit Agent"}
        </span>
        <div className="ea-trigger-badge" />
      </button>

      {/* ── Chat window ── */}
      <div className="ea-window">

        {/* Header */}
        <div className="ea-header">
          <div className="ea-header-left">
            <div className="ea-avatar">
              <ShieldCheck size={16} color="white" strokeWidth={2.5} />
            </div>
            <div className="ea-header-name">Expify Audit AI</div>
          </div>
          <div className="ea-header-actions">
            <button className="ea-header-btn" title="Refresh"><RotateCcw size={16} /></button>
            <button className="ea-header-btn" onClick={() => setIsOpen(false)} title="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="ea-status-bar">
          <span className="ea-online-text">
            <span className="ea-online-dot" />
            We're online
          </span>
          <span className="ea-date-text">Oct 15, 2024</span>
        </div>

        {/* Chat body — no fixed strip, buttons live inside the chat */}
        <div className="ea-body">
          <CopilotChat
            labels={{
              initial: "",
              placeholder: "Type a message...",
            }}
          />
          <div className="ea-input-extras">
            <button
              className={`ea-extra-icon ${isRecording ? "recording" : ""}`}
              onClick={toggleRecording}
              title="Voice Input"
            >
              {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}