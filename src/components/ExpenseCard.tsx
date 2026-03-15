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
        borderLeft: selected ? "4px solid var(--accent)" : "1px solid var(--border)",
        background: selected ? "var(--bg-tertiary)" : "var(--bg-card)",
        transition: "all var(--transition)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "24px", flex: 1 }}>
        {/* Date & User */}
        <div style={{ minWidth: "120px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
            <Calendar size={12} />
            <span>{new Date(record.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--bg-tertiary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, color: "var(--accent)" }}>
              {record.user_name?.[0] || 'U'}
            </div>
            <span style={{ fontWeight: 600 }}>{record.user_name || record.user_phone?.slice(-4)}</span>
          </div>
        </div>

        {/* Category */}
        <div style={{ width: "160px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
            <Tag size={12} />
            <span>Category</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 500 }}>
            {record.expense_type} <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>— {record.sub_category}</span>
          </div>
        </div>

        {/* City */}
        <div style={{ width: "130px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
            <Tag size={12} />
            <span>City / Tier</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 500 }}>
            {record.city || "—"} <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>({record.city_tier || "—"})</span>
          </div>
        </div>

        {/* Amount */}
        <div style={{ width: "140px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
            <IndianRupee size={12} />
            <span>Claimed Amount</span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)" }}>
            ₹{record.claimed_amount_numeric?.toLocaleString("en-IN") || record.claimed_amount}
          </div>
        </div>

        {/* Receipt Amount */}
        <div style={{ width: "140px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
             <ReceiptText size={12} />
            <span>Receipt Total</span>
          </div>
          <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--success)" }}>
            ₹{record.total_receipt_amount?.toLocaleString("en-IN") || '—'}
          </div>
        </div>

        {/* Participants */}
        <div style={{ width: "80px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", marginBottom: "4px" }}>
             <Users size={12} />
            <span>Pax</span>
          </div>
          <div style={{ fontSize: "14px", fontWeight: 500 }}>
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
