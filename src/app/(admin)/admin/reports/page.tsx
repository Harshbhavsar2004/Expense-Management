"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseRow } from "@/components/ExpensesTable";
import { BarChart3, Download, TrendingUp, Calendar } from "lucide-react";

export default function AdminReportsPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/expenses/all")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + (e.claimed_amount_numeric || 0), 0);
    const byCategory = Object.entries(
      expenses.reduce((acc, e) => {
        const k = e.expense_type || "Other";
        acc[k] = (acc[k] || 0) + (e.claimed_amount_numeric || 0);
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]);

    return { total, byCategory };
  }, [expenses]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1200px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
            Expense Reports
          </h2>
          <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
            Comprehensive analytics and spending breakdown
          </p>
        </div>
        <button className="btn-primary typo-button" style={{ gap: "7px" }}>
          <Download size={15} /> Export Report
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        {/* Spend by category */}
        <div className="premium-card" style={{ padding: "22px 24px" }}>
          <h4 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
            Spend by Category
          </h4>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3, 4].map(i => <div key={i} className="shimmer" style={{ height: "44px" }} />)}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {summary.byCategory.map(([cat, amt]) => {
                const pct = summary.total > 0 ? Math.round((amt / summary.total) * 100) : 0;
                return (
                  <div key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", textTransform: "capitalize", fontWeight: 500 }}>{cat}</span>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{pct}%</span>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>₹{amt.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                    <div style={{ height: "6px", background: "var(--bg-tertiary)", borderRadius: "9999px" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: "var(--accent)", borderRadius: "9999px", transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[
            { label: "Total Spend", value: loading ? "—" : `₹${summary.total.toLocaleString("en-IN")}`, icon: <TrendingUp size={18} />, color: "var(--accent)" },
            { label: "Total Claims", value: loading ? "—" : expenses.length.toString(), icon: <BarChart3 size={18} />, color: "#6366F1" },
            { label: "Unique Categories", value: loading ? "—" : summary.byCategory.length.toString(), icon: <Calendar size={18} />, color: "var(--teal)" },
          ].map((item) => (
            <div key={item.label} className="premium-card" style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ padding: "10px", background: `${item.color}15`, color: item.color, borderRadius: "10px" }}>{item.icon}</div>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter', sans-serif" }}>{item.label}</div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em" }}>{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
