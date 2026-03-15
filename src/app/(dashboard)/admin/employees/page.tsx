"use client";

import { useEffect, useState } from "react";
import { ExpenseRow } from "@/components/ExpensesTable";
import { Users, TrendingUp, CheckCircle, Clock } from "lucide-react";

export default function EmployeesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expenses/all")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Group by employee
  const employees = Object.entries(
    expenses.reduce((acc, e) => {
      const key = e.user_phone || e.user_name || "unknown";
      if (!acc[key]) acc[key] = { name: e.user_name || "Unknown", phone: e.user_phone, count: 0, total: 0, verified: 0 };
      acc[key].count++;
      acc[key].total += e.claimed_amount_numeric || 0;
      if (e.verified) acc[key].verified++;
      return acc;
    }, {} as Record<string, { name: string; phone?: string; count: number; total: number; verified: number }>)
  ).sort((a, b) => b[1].total - a[1].total);

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1200px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
          Employees
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
          {employees.length} active employees tracked via WhatsApp expense bot
        </p>
      </div>

      <div className="premium-card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 110px 100px", gap: "16px", padding: "12px 20px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter', sans-serif" }}>
          <span>Employee</span>
          <span>Claims</span>
          <span>Total Claimed</span>
          <span>Verified</span>
          <span>Compliance</span>
        </div>

        {loading ? (
          <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3, 4].map(i => <div key={i} className="shimmer" style={{ height: "60px", borderRadius: "8px" }} />)}
          </div>
        ) : employees.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px", color: "var(--text-muted)" }}>
            <Users size={36} style={{ opacity: 0.3, marginBottom: "12px" }} />
            <p style={{ margin: 0 }}>No employees found</p>
          </div>
        ) : (
          employees.map(([key, emp]) => {
            const compliancePct = emp.count > 0 ? Math.round((emp.verified / emp.count) * 100) : 0;
            const hue = (emp.name.charCodeAt(0) * 7) % 360;
            return (
              <div
                key={key}
                style={{ display: "grid", gridTemplateColumns: "1fr 90px 130px 110px 100px", gap: "16px", padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `hsl(${hue}, 60%, 52%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {emp.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{emp.name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{emp.phone || "—"}</div>
                  </div>
                </div>

                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{emp.count}</span>

                <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums", fontFamily: "'Inter', sans-serif" }}>
                  ₹{emp.total.toLocaleString("en-IN")}
                </span>

                <span style={{ fontSize: "13px", color: "var(--success)", fontWeight: 500, fontFamily: "'Inter', sans-serif" }}>
                  {emp.verified} / {emp.count}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ flex: 1, height: "5px", background: "var(--bg-tertiary)", borderRadius: "9999px" }}>
                    <div style={{ height: "100%", width: `${compliancePct}%`, background: compliancePct > 70 ? "var(--success)" : compliancePct > 40 ? "var(--warning)" : "var(--danger)", borderRadius: "9999px" }} />
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{compliancePct}%</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
