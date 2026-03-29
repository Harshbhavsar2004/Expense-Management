"use client";

import { useEffect, useState, useMemo } from "react";
import { Users } from "lucide-react";

interface UserRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  organization: string | null;
  team: string | null;
  bank_verified: boolean | null;
  cashfree_bene_id: string | null;
}

interface ExpenseRow {
  user_id: string;
  claimed_amount_numeric: number | null;
  verified: boolean | null;
}

export default function EmployeesPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(r => r.json()),
      fetch("/api/admin/expenses/all").then(r => r.json()),
    ])
      .then(([u, e]) => {
        setUsers(Array.isArray(u) ? u : []);
        setExpenses(Array.isArray(e) ? e : []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const employees = useMemo(() => {
    const employees = users.filter(u => u.role !== "admin");
    return employees.map(u => {
      const userExpenses = expenses.filter(e => e.user_id === u.id);
      const total = userExpenses.reduce((s, e) => s + (e.claimed_amount_numeric || 0), 0);
      const verified = userExpenses.filter(e => e.verified).length;
      return { ...u, count: userExpenses.length, total, verified };
    }).sort((a, b) => b.total - a.total);
  }, [users, expenses]);

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1200px" }}>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
          Employees
        </h2>
        <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
          {loading ? "Loading…" : `${employees.length} employee${employees.length !== 1 ? "s" : ""} registered`}
        </p>
      </div>

      <div className="premium-card" style={{ overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 110px 100px 110px", gap: "16px", padding: "12px 20px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter', sans-serif" }}>
          <span>Employee</span>
          <span>Claims</span>
          <span>Total Claimed</span>
          <span>Verified</span>
          <span>Compliance</span>
          <span>Bank</span>
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
          employees.map(emp => {
            const compliancePct = emp.count > 0 ? Math.round((emp.verified / emp.count) * 100) : 0;
            const hue = (emp.full_name.charCodeAt(0) * 7) % 360;
            return (
              <div
                key={emp.id}
                style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 110px 100px 110px", gap: "16px", padding: "14px 20px", borderBottom: "1px solid var(--border)", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: `hsl(${hue}, 60%, 52%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                    {emp.full_name[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{emp.full_name}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{emp.email || emp.phone || "—"}</div>
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

                <div>
                  {emp.bank_verified ? (
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
                      Verified
                    </span>
                  ) : (
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "3px 8px", borderRadius: "20px", background: "rgba(245,158,11,0.1)", color: "#D97706", border: "1px solid rgba(245,158,11,0.2)" }}>
                      Not Added
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
