"use client";

export interface ExpenseRow {
  id: string;
  created_at: string;
  user_name?: string;
  user_phone?: string;
  date_range?: string;
  expense_type?: string;
  sub_category?: string;
  claimed_amount?: string;
  claimed_amount_numeric?: number;
  participant_type?: string;
  participant_count?: number;
  participant_names?: string[];
  verified?: boolean;
  mismatches?: string[];
  total_receipt_amount?: number;
  amount_match?: boolean;
  date_match?: boolean;
  audit_explanation?: string;
  audit_timeline?: string[];
  city?: string;
  city_tier?: string;
}

interface ExpensesTableProps {
  data: ExpenseRow[];
  loading?: boolean;
}

const COLUMNS = [
  { key: "created_at",           label: "Submitted",        width: "120px" },
  { key: "user_name",            label: "Employee",         width: "130px" },
  { key: "expense_type",         label: "Category",         width: "110px" },
  { key: "sub_category",         label: "Sub-category",     width: "120px" },
  { key: "date_range",           label: "Date Range",       width: "130px" },
  { key: "claimed_amount",       label: "Claimed",          width: "100px" },
  { key: "total_receipt_amount", label: "Receipt Amt",      width: "100px" },
  { key: "participant_type",     label: "Participants",     width: "110px" },
  { key: "verified",             label: "Verified",         width: "90px"  },
  { key: "amount_match",         label: "Amt Match",        width: "90px"  },
  { key: "mismatches",           label: "Mismatches",       width: "160px" },
];

export function ExpensesTable({ data, loading }: ExpensesTableProps) {
  if (loading) {
    return (
      <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="shimmer" style={{ height: "52px", borderRadius: "var(--radius-md)", animationDelay: `${i * 0.1}s` }} />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className="animate-fade-in premium-card"
        style={{
          margin: "40px auto",
          maxWidth: "500px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
          padding: "80px 40px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "64px", filter: "grayscale(1) opacity(0.5)" }}>🧾</div>
        <div>
          <h3 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>No Records Found</h3>
          <p style={{ margin: "10px 0 0", fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Adjust your filters or check back later once new claims are submitted via WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="animate-fade-in"
      style={{ flex: 1, overflowX: "auto", overflowY: "auto", padding: "0 32px 32px" }}
    >
      <div className="premium-card" style={{ overflow: "hidden", border: "1px solid var(--border)" }}>
        <table
          id="expenses-table"
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: "13px",
            minWidth: "1100px",
          }}
        >
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  style={{
                    width: col.width,
                    padding: "16px 20px",
                    textAlign: "left",
                    fontSize: "11px",
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    background: "var(--bg-tertiary)",
                    borderBottom: "1px solid var(--border)",
                    position: "sticky",
                    top: 0,
                    whiteSpace: "nowrap",
                    zIndex: 2,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={row.id}
                style={{
                  background: "transparent",
                  transition: "var(--transition)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {/* Submitted */}
                <td style={cellStyle}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {new Date(row.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                      {new Date(row.created_at).getFullYear()}
                    </span>
                  </div>
                </td>
                {/* Employee */}
                <td style={cellStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "var(--radius-sm)",
                      background: stringToGradient(row.user_name || "?"),
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "12px", fontWeight: 700, color: "#fff", flexShrink: 0,
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}>
                      {(row.user_name || "?")[0].toUpperCase()}
                    </div>
                    <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                      {row.user_name || row.user_phone?.slice(-4) || "—"}
                    </span>
                  </div>
                </td>
                {/* Category */}
                <td style={cellStyle}>
                  {row.expense_type ? (
                    <span className="badge" style={{
                      background: categoryColor(row.expense_type).bg,
                      color: categoryColor(row.expense_type).text,
                      border: `1px solid ${categoryColor(row.expense_type).text}20`,
                    }}>
                      {row.expense_type}
                    </span>
                  ) : "—"}
                </td>
                {/* Sub-category */}
                <td style={{ ...cellStyle, color: "var(--text-secondary)" }}>{row.sub_category || "—"}</td>
                {/* Date Range */}
                <td style={{ ...cellStyle, color: "var(--text-secondary)", fontSize: "12px" }}>{row.date_range || "—"}</td>
                {/* Claimed */}
                <td style={cellStyle}>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700, fontSize: "14px", fontVariantNumeric: "tabular-nums" }}>
                    {row.claimed_amount || (row.claimed_amount_numeric != null ? `₹${row.claimed_amount_numeric.toLocaleString("en-IN")}` : "—")}
                  </span>
                </td>
                {/* Receipt Amt */}
                <td style={cellStyle}>
                  <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--success)", fontWeight: 500 }}>
                    {row.total_receipt_amount != null ? `₹${row.total_receipt_amount.toLocaleString("en-IN")}` : "—"}
                  </span>
                </td>
                {/* Participants */}
                <td style={{ ...cellStyle, color: "var(--text-secondary)" }}>
                  {row.participant_type ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ opacity: 0.6 }}>👥</span>
                      <span>{row.participant_count || 1}</span>
                    </div>
                  ) : "—"}
                </td>
                {/* Verified */}
                <td style={cellStyle}>
                  <Badge ok={!!row.verified} trueLabel="Verified" falseLabel="Pending" />
                </td>
                {/* Amount Match */}
                <td style={cellStyle}>
                  <Badge ok={!!row.amount_match} trueLabel="Match" falseLabel="Mismatch" />
                </td>
                {/* Mismatches */}
                <td style={cellStyle}>
                  {row.mismatches && row.mismatches.length > 0 ? (
                    <span style={{ color: "var(--danger)", fontSize: "11px", fontWeight: 500 }}>
                      ⚠️ {row.mismatches[0]}
                    </span>
                  ) : (
                    <span style={{ color: "var(--success)", fontSize: "11px" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badge({ ok, trueLabel, falseLabel }: { ok: boolean; trueLabel: string; falseLabel: string }) {
  return (
    <span className="badge" style={{
      background: ok ? "var(--success-bg)" : "var(--warning-bg)",
      color: ok ? "var(--success)" : "var(--warning)",
      border: `1px solid ${ok ? "var(--success)" : "var(--warning)"}20`,
    }}>
      <span style={{ marginRight: "4px", fontSize: "8px" }}>{ok ? "●" : "○"}</span>
      {ok ? trueLabel : falseLabel}
    </span>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
  color: "var(--text-secondary)",
};

function stringToGradient(str: string): string {
  const colors = [
    "linear-gradient(135deg, #3b82f6, #6366f1)",
    "linear-gradient(135deg, #10b981, #059669)",
    "linear-gradient(135deg, #f59e0b, #d97706)",
    "linear-gradient(135deg, #ef4444, #dc2626)",
    "linear-gradient(135deg, #8b5cf6, #7c3aed)",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function categoryColor(cat: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    food:       { bg: "rgba(245,158,11,0.1)", text: "#f59e0b" },
    travel:     { bg: "rgba(59,130,246,0.1)", text: "#60a5fa" },
    hotel:      { bg: "rgba(139,92,246,0.1)", text: "#a78bfa" },
    medical:    { bg: "rgba(16,185,129,0.1)", text: "#34d399" },
    client:     { bg: "rgba(236,72,153,0.1)", text: "#f472b6" },
    office:     { bg: "rgba(99,102,241,0.1)", text: "#818cf8" },
  };
  const key = cat.toLowerCase().split(" ")[0];
  return map[key] ?? { bg: "var(--bg-tertiary)", text: "var(--text-secondary)" };
}
