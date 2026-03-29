"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseRow } from "@/components/ExpensesTable";
import {
  ArrowUpRight, Users, CheckCircle, Clock, AlertTriangle,
  CircleDollarSign, ReceiptText, TrendingUp, ArrowRight,
  ChevronRight, ShieldCheck, Hourglass, Ban,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [data, setData] = useState<{ applications: any[]; expenses: any[] }>({ applications: [], expenses: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [appsRes, expsRes] = await Promise.all([
          fetch("/api/admin/applications/all"),
          fetch("/api/admin/expenses/all"),
        ]);
        const apps = await appsRes.json();
        const exps = await expsRes.json();
        setData({ applications: Array.isArray(apps) ? apps : [], expenses: Array.isArray(exps) ? exps : [] });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const { expenses, applications } = data;
    if (!expenses.length) return { total: 0, count: 0, verified: 0, pending: applications.length, mismatches: 0, employees: 0 };
    const total      = expenses.reduce((s, e) => s + (e.claimed_amount_numeric || 0), 0);
    const verified   = expenses.filter(e => e.verified).length;
    const mismatches = expenses.filter(e => e.amount_match === false).length;
    const employees  = new Set(expenses.map(e => e.user_phone)).size;
    return { total, count: expenses.length, verified, pending: applications.length, mismatches, employees };
  }, [data]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    data.expenses.forEach(e => { const k = e.expense_type || "Other"; map[k] = (map[k] || 0) + (e.claimed_amount_numeric || 0); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.expenses]);

  const pendingApps = data.applications.filter(a => a.status === "submitted").slice(0, 8);

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "28px", maxWidth: "1400px" }}>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px" }} className="stagger-children">
        <StatCard label="Total Volume"      value={`₹${(stats.total / 100000).toFixed(1)}L`} icon={<CircleDollarSign size={19} />} color="var(--accent)"   bg="var(--accent-light)"  trend="+12.3%" loading={loading} />
        <StatCard label="Total Claims"      value={stats.count.toString()}                    icon={<ReceiptText size={19} />}      color="#6366F1"          bg="rgba(99,102,241,0.09)" loading={loading} />
        <StatCard label="Verified"          value={stats.verified.toString()}                 icon={<ShieldCheck size={19} />}     color="var(--success)"   bg="var(--success-bg)"    loading={loading} />
        <StatCard label="Pending Review"    value={stats.pending.toString()}                  icon={<Hourglass size={19} />}       color="var(--warning)"   bg="var(--warning-bg)"    loading={loading} />
        <StatCard label="Mismatches"        value={stats.mismatches.toString()}               icon={<AlertTriangle size={19} />}   color="var(--danger)"    bg="var(--danger-bg)"     loading={loading} />
        <StatCard label="Active Employees"  value={stats.employees.toString()}                icon={<Users size={19} />}           color="var(--teal)"      bg="var(--teal-light)"    loading={loading} />
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>

        {/* Pending approvals table */}
        <div className="premium-card animate-fade-in" style={{ padding: "22px 24px" }}>
          <div className="section-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
                Pending Application Approvals
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
                Submitted reports awaiting your review
              </p>
            </div>
            <Link href="/admin/approvals" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", fontWeight: 500, color: "var(--accent)", textDecoration: "none", fontFamily: "'Inter', sans-serif" }}>
              View all <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[1,2,3,4].map(i => <div key={i} className="shimmer" style={{ height: "58px", borderRadius: "10px" }} />)}
            </div>
          ) : pendingApps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: "10px" }} />
              <p style={{ margin: 0, fontSize: "14px" }}>All caught up! No pending applications.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 140px 100px 80px", gap: "12px", padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", borderBottom: "1px solid var(--border)" }}>
                <span>Application / Employee</span><span>Location</span><span>Reimbursable</span><span>Submitted</span><span>Action</span>
              </div>
              {pendingApps.map(app => {
                const reimbursable = app.reimbursable_amount ?? 0;
                const total        = app.total_claimed ?? 0;
                const flagged      = app.flagged_count ?? 0;
                return (
                <div
                  key={app.id}
                  onClick={() => window.location.href = `/applications/${app.application_id}`}
                  style={{ display: "grid", gridTemplateColumns: "1fr 130px 140px 100px 80px", gap: "12px", padding: "10px 12px", borderRadius: "8px", alignItems: "center", transition: "background 0.15s", cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-tertiary)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {app.application_id.slice(-2)}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{app.application_id}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{app.users?.full_name || "Employee"}</div>
                      <PayoutBadge status={app.payout_status} />
                    </div>
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>{app.city || "—"}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#059669", fontFamily: "'Inter', sans-serif" }}>
                      ₹{reimbursable.toLocaleString("en-IN")}
                    </span>
                    {flagged > 0 ? (
                      <span style={{ fontSize: "10px", color: "#DC2626", fontFamily: "'Inter', sans-serif" }}>
                        {flagged} flagged · ₹{total.toLocaleString("en-IN")} claimed
                      </span>
                    ) : (
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
                        All clean · ₹{total.toLocaleString("en-IN")} claimed
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString("en-IN") : "—"}
                  </span>
                  <button style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--accent)", background: "var(--accent-light)", color: "var(--accent)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                    Review
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Spend by category */}
          <div className="premium-card animate-fade-in" style={{ padding: "20px" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
              Spend by Category
            </h4>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {[1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "36px" }} />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {byCategory.map(([cat, amt]) => {
                  const max = byCategory[0]?.[1] || 1;
                  const pct = Math.round((amt / max) * 100);
                  return (
                    <div key={cat}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", textTransform: "capitalize" }}>{cat}</span>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>₹{amt.toLocaleString("en-IN")}</span>
                      </div>
                      <div style={{ height: "5px", background: "var(--bg-tertiary)", borderRadius: "9999px" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: CATEGORY_COLORS[cat.toLowerCase()] || "var(--accent)", borderRadius: "9999px", transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function PayoutBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const map: Record<string, { bg: string; color: string }> = {
    PENDING:  { bg: "#fef9c3", color: "#a16207" },
    SUCCESS:  { bg: "#dcfce7", color: "#15803d" },
    FAILURE:  { bg: "#fee2e2", color: "#b91c1c" },
    REVERSED: { bg: "#f3e8ff", color: "#7e22ce" },
  };
  const s = map[status] ?? { bg: "var(--bg-tertiary)", color: "var(--text-muted)" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "1px 6px", borderRadius: "999px", fontSize: "9px", fontWeight: 700, background: s.bg, color: s.color, marginTop: "2px" }}>
      {status}
    </span>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  food: "#10B981", travel: "#3B82F6", hotel: "#6366F1",
  accommodation: "#8B5CF6", entertainment: "#F59E0B",
  medical: "#EF4444", other: "#94A3B8",
};

function StatCard({ label, value, icon, color, bg, trend, loading }: {
  label: string; value: string; icon: React.ReactNode;
  color: string; bg: string; trend?: string; loading?: boolean;
}) {
  return (
    <div className="stat-card animate-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div style={{ padding: "8px", background: bg, color, borderRadius: "9px" }}>{icon}</div>
        {trend && (
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--success)", display: "flex", alignItems: "center", gap: "2px", background: "var(--success-bg)", padding: "2px 7px", borderRadius: "9999px" }}>
            <ArrowUpRight size={11} /> {trend}
          </span>
        )}
      </div>
      <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter', sans-serif" }}>{label}</div>
      {loading
        ? <div className="shimmer" style={{ height: "26px", width: "70px", marginTop: "5px" }} />
        : <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginTop: "3px", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em" }}>{value}</div>
      }
    </div>
  );
}
