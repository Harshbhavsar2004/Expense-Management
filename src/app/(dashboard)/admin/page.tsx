"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseRow } from "@/components/ExpensesTable";
import {
  ArrowUpRight,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  CircleDollarSign,
  FileCheck,
  TrendingUp,
  ArrowRight,
  ChevronRight,
  ReceiptText,
  ShieldCheck,
  Ban,
  Hourglass,
} from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [data, setData] = useState<{ applications: any[], expenses: any[] }>({ applications: [], expenses: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const appsRes = await fetch("/api/admin/applications/submitted");
        const apps = await appsRes.json();
        
        // Fetch expenses but we should ideally filter them by application_id in the API
        // For now, let's assume /api/expenses/all returns all but we SHOULD filter them here
        // or update the API. Let's update the API later.
        const expsRes = await fetch("/api/expenses/all");
        const exps = await expsRes.json();
        
        // Filter expenses to only those belonging to submitted applications
        const submittedAppIds = new Set(apps.map((a: any) => a.application_id));
        const filteredExps = Array.isArray(exps) ? exps.filter((e: any) => submittedAppIds.has(e.application_id)) : [];

        setData({ applications: Array.isArray(apps) ? apps : [], expenses: filteredExps });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = useMemo(() => {
    const expenses = data.expenses;
    const applications = data.applications;
    
    if (!expenses.length) return { total: 0, count: 0, verified: 0, pending: applications.length, mismatches: 0, employees: 0, avgAmount: 0 };
    const total = expenses.reduce((s, e) => s + (e.claimed_amount_numeric || 0), 0);
    const verified = expenses.filter((e) => e.verified).length;
    const mismatches = expenses.filter((e) => e.amount_match === false).length;
    const uniqueUsers = new Set(expenses.map((e) => e.user_phone)).size;
    const avgAmount = total / expenses.length;
    return { total, count: expenses.length, verified, pending: applications.length, mismatches, employees: uniqueUsers, avgAmount };
  }, [data]);

  // Group by category
  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    data.expenses.forEach((e) => {
      const cat = e.expense_type || "Other";
      map[cat] = (map[cat] || 0) + (e.claimed_amount_numeric || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [data.expenses]);

  // Recent pending applications (not expenses)
  const pendingApps = data.applications.slice(0, 5);

  return (
    <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: "28px", maxWidth: "1400px" }}>

      {/* ── Header Banner ── */}
      <div
        className="animate-fade-in"
        style={{
          background: "linear-gradient(135deg, #1a1f36 0%, #2d1f5e 50%, #1a3a6b 100%)",
          borderRadius: "16px",
          padding: "28px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 4px 24px rgba(99,102,241,0.15)",
        }}
      >
        <div style={{ position: "absolute", right: "20px", top: "-30px", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(99,102,241,0.08)" }} />
        <div style={{ position: "absolute", right: "120px", bottom: "-50px", width: "130px", height: "130px", borderRadius: "50%", background: "rgba(249,115,22,0.07)" }} />

        <div style={{ zIndex: 1 }}>
          <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", fontFamily: "'Inter', sans-serif", marginBottom: "8px" }}>
            Admin Control Center
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: "22px", fontWeight: 700, color: "white", fontFamily: "'DM Sans', sans-serif" }}>
            Expense Administration
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "rgba(255,255,255,0.5)", fontFamily: "'Inter', sans-serif" }}>
            Monitor, audit and approve all organizational expenses
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", zIndex: 1 }}>
          <Link href="/admin/approvals" style={{ textDecoration: "none" }}>
            <button className="btn-primary typo-button" style={{ background: "#F97316", gap: "6px", padding: "10px 18px" }}>
              <CheckCircle size={15} />
              Approvals ({stats.pending})
            </button>
          </Link>
          <Link href="/admin/expenses" style={{ textDecoration: "none" }}>
            <button className="btn-secondary typo-button" style={{ background: "rgba(255,255,255,0.08)", color: "white", borderColor: "rgba(255,255,255,0.15)", gap: "6px", padding: "10px 18px" }}>
              <ReceiptText size={15} />
              All Expenses
            </button>
          </Link>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "16px" }}
        className="stagger-children"
      >
        <AdminStatCard label="Total Volume" value={`₹${(stats.total / 100000).toFixed(1)}L`} icon={<CircleDollarSign size={19} />} color="var(--accent)" bg="var(--accent-light)" trend="+12.3%" loading={loading} />
        <AdminStatCard label="Total Claims" value={stats.count.toString()} icon={<ReceiptText size={19} />} color="#6366F1" bg="rgba(99,102,241,0.09)" loading={loading} />
        <AdminStatCard label="Verified" value={stats.verified.toString()} icon={<ShieldCheck size={19} />} color="var(--success)" bg="var(--success-bg)" loading={loading} />
        <AdminStatCard label="Pending Review" value={stats.pending.toString()} icon={<Hourglass size={19} />} color="var(--warning)" bg="var(--warning-bg)" loading={loading} />
        <AdminStatCard label="Mismatches" value={stats.mismatches.toString()} icon={<AlertTriangle size={19} />} color="var(--danger)" bg="var(--danger-bg)" loading={loading} />
        <AdminStatCard label="Active Employees" value={stats.employees.toString()} icon={<Users size={19} />} color="var(--teal)" bg="var(--teal-light)" loading={loading} />
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px" }}>

        {/* Pending Approvals Table */}
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
              {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer" style={{ height: "58px", borderRadius: "10px" }} />)}
            </div>
          ) : pendingApps.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: "10px" }} />
              <p style={{ margin: 0, fontSize: "14px" }}>All caught up! No pending applications.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 100px 90px", gap: "12px", padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Inter', sans-serif", borderBottom: "1px solid var(--border)" }}>
                <span>Application / Employee</span>
                <span>Location</span>
                <span>Submitted At</span>
                <span>Action</span>
              </div>

              {pendingApps.map((app) => (
                <div
                  key={app.id}
                  onClick={() => window.location.href = `/applications/${app.application_id}`}
                  style={{ display: "grid", gridTemplateColumns: "1fr 140px 100px 90px", gap: "12px", padding: "10px 12px", borderRadius: "8px", alignItems: "center", transition: "background 0.15s", cursor: "pointer" }}
                  onMouseEnter={(ev) => (ev.currentTarget.style.background = "var(--bg-tertiary)")}
                  onMouseLeave={(ev) => (ev.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, color: "white", flexShrink: 0 }}>
                      {app.application_id.slice(-2)}
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{app.application_id}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{app.users?.full_name || "Employee"}</div>
                    </div>
                  </div>

                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif" }}>
                    {app.city || "—"}
                  </span>

                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString("en-IN") : "—"}
                  </span>

                  <div style={{ display: "flex", gap: "5px" }}>
                    <button style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid var(--accent)", background: "var(--accent-light)", color: "var(--accent)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
                      Review
                    </button>
                  </div>
                </div>
              ))}
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
                {[1, 2, 3].map((i) => <div key={i} className="shimmer" style={{ height: "36px" }} />)}
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
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'Inter', sans-serif", fontVariantNumeric: "tabular-nums" }}>
                          ₹{amt.toLocaleString("en-IN")}
                        </span>
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

          {/* Admin actions */}
          <div className="premium-card animate-fade-in" style={{ padding: "20px" }}>
            <h4 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 600, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
              Admin Actions
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {[
                { label: "Review Mismatches",   desc: `${stats.mismatches} flagged items`, href: "/admin/expenses", icon: "⚠️", urgent: stats.mismatches > 0 },
                { label: "Generate Report",      desc: "Monthly expense summary",          href: "/admin/reports",  icon: "📊", urgent: false },
                { label: "Manage Employees",     desc: `${stats.employees} active users`,  href: "/admin/employees", icon: "👥", urgent: false },
              ].map((action) => (
                <Link key={action.label} href={action.href} style={{ textDecoration: "none" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "10px 12px",
                      background: action.urgent ? "rgba(239,68,68,0.04)" : "var(--bg-tertiary)",
                      border: `1px solid ${action.urgent ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = action.urgent ? "rgba(239,68,68,0.04)" : "var(--bg-tertiary)"; e.currentTarget.style.borderColor = action.urgent ? "rgba(239,68,68,0.2)" : "var(--border)"; }}
                  >
                    <span style={{ fontSize: "18px" }}>{action.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: action.urgent ? "var(--danger)" : "var(--text-primary)", fontFamily: "'Inter', sans-serif" }}>{action.label}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>{action.desc}</div>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

const CATEGORY_COLORS: Record<string, string> = {
  food: "#10B981",
  travel: "#3B82F6",
  hotel: "#6366F1",
  accommodation: "#8B5CF6",
  entertainment: "#F59E0B",
  medical: "#EF4444",
  other: "#94A3B8",
};

function CategoryBadge({ cat }: { cat?: string }) {
  const key = (cat || "other").toLowerCase();
  const color = CATEGORY_COLORS[key] || "#94A3B8";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "2px 8px",
      borderRadius: "9999px",
      fontSize: "11px",
      fontWeight: 600,
      background: `${color}18`,
      color,
      fontFamily: "'Inter', sans-serif",
      textTransform: "capitalize",
    }}>
      {cat || "Other"}
    </span>
  );
}

function AdminStatCard({
  label, value, icon, color, bg, trend, loading,
}: {
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
      {loading ? (
        <div className="shimmer" style={{ height: "26px", width: "70px", marginTop: "5px" }} />
      ) : (
        <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--text-primary)", marginTop: "3px", fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.02em" }}>{value}</div>
      )}
    </div>
  );
}
