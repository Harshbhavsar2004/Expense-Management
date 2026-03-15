"use client";

import { Calendar, User, Tag, IndianRupee, Users, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { ExpenseRow } from "./ExpensesTable";

interface ExpenseCardProps {
  record: ExpenseRow;
  selected?: boolean;
  onClick?: () => void;
}

export function ExpenseCard({ record, selected, onClick }: ExpenseCardProps) {
  const isVerified = record.verified;
  const hasMismatches = record.mismatches && record.mismatches.length > 0;
  
  return (
    <div
      onClick={onClick}
      className="premium-card"
      style={{
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        borderLeft: selected ? "4px solid var(--accent)" : "1.5px solid var(--border)",
        borderTop: "1.5px solid var(--border)",
        borderRight: "1.5px solid var(--border)",
        borderBottom: "1.5px solid var(--border)",
        background: selected ? "var(--accent-light)" : "var(--bg-card)",
        transform: selected ? "translateX(4px)" : "none",
        transition: "all var(--transition)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px", flex: 1 }}>
        {/* Date & User */}
        <div style={{ minWidth: "120px" }}>
          <div className="typo-overline mb-1 flex items-center gap-[6px] text-slate-500!">
            <Calendar size={12} />
            <span>{new Date(record.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
            {record.receipts?.[0]?.transaction_time && (
              <span className="typo-caption opacity-80">· {record.receipts[0].transaction_time}</span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="typo-overline" style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)" }}>
              {record.user_name?.[0] || 'U'}
            </div>
            <span className="typo-label truncate max-w-[80px] inline-block align-bottom">{record.user_name || record.user_phone?.slice(-4)}</span>
          </div>
        </div>

        {/* Category & App ID */}
        <div style={{ width: "160px" }}>
          <div className="typo-overline mb-1 flex items-center gap-[6px] text-slate-500!">
            <Tag size={12} />
            <span>Category</span>
          </div>
          <div className="typo-body-default font-medium! truncate">
            {record.expense_type} <span className="typo-caption text-slate-500!">— {record.sub_category}</span>
          </div>
          {record.application_id && (
            <div className="typo-caption font-mono! font-semibold!" style={{ marginTop: "4px", color: "var(--accent)", padding: "2px 6px", background: "var(--accent-glow)", borderRadius: "4px", display: "inline-block" }}>
              {record.application_id}
            </div>
          )}
        </div>

        {/* City */}
        <div style={{ width: "130px" }}>
          <div className="typo-overline mb-1 flex items-center gap-[6px] text-slate-500!">
            <Tag size={12} />
            <span>City / Tier</span>
          </div>
          <div className="typo-body-default font-medium!">
            {record.city || "—"} <span className="typo-caption text-slate-500!">({record.city_tier || "—"})</span>
          </div>
        </div>

        {/* Amount */}
        <div style={{ width: "140px" }}>
          <div className="typo-overline mb-1 flex items-center gap-[6px] text-slate-500!">
            <IndianRupee size={12} />
            <span>Claimed Amount</span>
          </div>
          <div className="typo-body-default font-bold!" style={{ color: "var(--text-primary)" }}>
            ₹{record.claimed_amount_numeric?.toLocaleString("en-IN") || record.claimed_amount}
          </div>
        </div>

        {/* Receipt Amount */}
        <div style={{ width: "140px" }}>
          <div className="typo-overline mb-1 flex items-center gap-[6px] text-slate-500!">
             <ReceiptText size={12} />
            <span>Receipt Total</span>
          </div>
          <div className="typo-body-default font-bold!" style={{ color: "var(--success)" }}>
            ₹{record.total_receipt_amount?.toLocaleString("en-IN") || '—'}
          </div>
        </div>

        {/* Participants */}
        <div style={{ width: "80px" }}>
          <div className="typo-overline mb-1 flex items-center gap-[6px] text-slate-500!">
             <Users size={12} />
            <span>Pax</span>
          </div>
          <div className="typo-body-default font-medium!">
            {record.participant_count || 1}
          </div>
        </div>
      </div>

      {/* Status Badges */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {!record.amount_match ? (
          <div className="badge" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
            <XCircle size={12} style={{ marginRight: "4px" }} />
            Mismatch
          </div>
        ) : (
          <div className="badge" style={{ 
            background: isVerified ? "var(--success-bg)" : "var(--warning-bg)", 
            color: isVerified ? "var(--success)" : "var(--warning)" 
          }}>
            {isVerified ? <CheckCircle2 size={12} style={{ marginRight: "4px" }} /> : <AlertCircle size={12} style={{ marginRight: "4px" }} />}
            {isVerified ? "Verified" : "Pending"}
          </div>
        )}
      </div>
    </div>
  );
}

function ReceiptText({ size, style }: { size: number, style?: React.CSSProperties }) {
    return <ReceiptTextLucide size={size} style={style} />;
}
import { ReceiptText as ReceiptTextLucide } from "lucide-react";
