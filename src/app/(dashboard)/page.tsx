"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseCard } from "@/components/ExpenseCard";
import { ExpenseRow } from "@/components/ExpensesTable";
import {
  ArrowUpRight,
  ArrowRight,
  ReceiptText,
  Wallet,
  FileCheck,
  Hourglass,
  CircleDollarSign,
  Sparkles,
  MessageCircle,
  BarChart2,
  Download,
} from "lucide-react";
import Link from "next/link";

export default function EmployeeDashboard() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/expenses/all")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!expenses.length)
      return { total: 0, count: 0, verified: 0, pending: 0, rejected: 0 };
    const total = expenses.reduce(
      (s, e) => s + (e.claimed_amount_numeric || 0),
      0
    );
    const verified = expenses.filter((e) => e.verified).length;
    const rejected = expenses.filter(
      (e) => e.amount_match === false && e.verified
    ).length;
    return {
      total,
      count: expenses.length,
      verified,
      pending: expenses.length - verified,
      rejected,
    };
  }, [expenses]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Figtree:wght@400;500;600&display=swap');

        .dash-root {
          padding: 32px 36px;
          display: flex;
          flex-direction: column;
          gap: 28px;
          max-width: 1400px;
          background: #F8FAFC;
          min-height: 100vh;
          font-family: 'Figtree', sans-serif;
        }

        /* ── Page header ── */
        .page-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
        }
        .greeting-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #2563EB;
          margin-bottom: 4px;
          font-family: 'Figtree', sans-serif;
        }
        .greeting-name {
          font-size: 28px;
          font-weight: 700;
          color: #0F172A;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.2;
        }
        .greeting-sub {
          font-size: 14px;
          color: #64748B;
          margin: 4px 0 0;
          font-family: 'Figtree', sans-serif;
        }
        .header-cta {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #2563EB;
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          font-family: 'Figtree', sans-serif;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s, transform 0.15s;
          letter-spacing: 0.01em;
        }
        .header-cta:hover {
          background: #1D4ED8;
          transform: translateY(-1px);
        }

        /* ── Stat cards ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 1100px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        .stat-card {
          background: white;
          border-radius: 14px;
          padding: 22px 22px 20px;
          border: 1px solid #E2E8F0;
          display: flex;
          flex-direction: column;
          gap: 14px;
          transition: box-shadow 0.2s, transform 0.2s;
          position: relative;
          overflow: hidden;
        }
        .stat-card:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.07);
          transform: translateY(-2px);
        }
        .stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          border-radius: 14px 14px 0 0;
          background: var(--card-accent, #E2E8F0);
        }
        .stat-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .stat-label {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #94A3B8;
          font-family: 'Figtree', sans-serif;
        }
        .stat-value {
          font-size: 28px;
          font-weight: 700;
          color: #0F172A;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: -0.02em;
          line-height: 1;
          margin-top: 2px;
        }
        .stat-trend {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          font-size: 11px;
          font-weight: 700;
          color: #16A34A;
          background: #F0FDF4;
          padding: 2px 8px;
          border-radius: 999px;
          margin-top: 4px;
          width: fit-content;
        }
        .shimmer {
          background: linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 8px;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Main grid ── */
        .main-grid {
          display: grid;
          grid-template-columns: 1fr 296px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 960px) {
          .main-grid { grid-template-columns: 1fr; }
        }

        /* ── Section cards ── */
        .section-card {
          background: white;
          border-radius: 14px;
          border: 1px solid #E2E8F0;
          padding: 22px 24px;
        }
        .section-title {
          font-size: 15px;
          font-weight: 600;
          color: #0F172A;
          font-family: 'DM Sans', sans-serif;
          margin: 0;
        }
        .section-sub {
          font-size: 12px;
          color: #94A3B8;
          margin: 3px 0 0;
          font-family: 'Figtree', sans-serif;
        }
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .view-all-link {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #2563EB;
          text-decoration: none;
          font-family: 'Figtree', sans-serif;
          transition: gap 0.15s;
        }
        .view-all-link:hover { gap: 7px; }

        /* ── Status rows ── */
        .status-row-label {
          font-size: 12px;
          color: #475569;
          font-family: 'Figtree', sans-serif;
        }
        .status-row-count {
          font-size: 12px;
          font-weight: 600;
          color: #0F172A;
          font-family: 'Figtree', sans-serif;
        }
        .status-row-pct {
          font-weight: 400;
          color: #94A3B8;
        }
        .progress-track {
          height: 5px;
          background: #F1F5F9;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 5px;
        }
        .progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.7s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* ── Quick actions ── */
        .quick-action-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 14px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: all 0.15s;
          font-family: 'Figtree', sans-serif;
        }
        .quick-action-btn:hover {
          background: white;
          border-color: #CBD5E1;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transform: translateX(2px);
        }
        .quick-action-icon {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .quick-action-title {
          font-size: 13px;
          font-weight: 500;
          color: #0F172A;
        }
        .quick-action-desc {
          font-size: 11px;
          color: #94A3B8;
          margin-top: 1px;
        }

        /* ── Divider ── */
        .divider {
          height: 1px;
          background: #F1F5F9;
          margin: 16px 0;
        }

        /* ── Empty state ── */
        .empty-state {
          text-align: center;
          padding: 48px 0;
          color: #94A3B8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .empty-state p {
          font-size: 14px;
          margin: 0;
          font-family: 'Figtree', sans-serif;
        }

        /* ── Fade in ── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.4s ease forwards;
        }
        .fade-up-1 { animation-delay: 0.05s; opacity: 0; }
        .fade-up-2 { animation-delay: 0.10s; opacity: 0; }
        .fade-up-3 { animation-delay: 0.15s; opacity: 0; }
        .fade-up-4 { animation-delay: 0.20s; opacity: 0; }
        .fade-up-5 { animation-delay: 0.25s; opacity: 0; }
      `}</style>

      <div className="dash-root">

        {/* ── Page Header ── */}
        <div className="page-header fade-up fade-up-1">
          <div>
            <div className="greeting-eyebrow">Good morning</div>
            <h1 className="greeting-name">Harshal Bhavsar</h1>
            <p className="greeting-sub">Here's a summary of your expense activity.</p>
          </div>
          <Link href="/expenses" className="header-cta">
            <ReceiptText size={15} />
            View My Claims
          </Link>
        </div>

        {/* ── Stats Grid ── */}
        <div className="stats-grid fade-up fade-up-2">
          <StatCard
            label="Total Claimed"
            value={`₹${stats.total.toLocaleString("en-IN")}`}
            icon={<CircleDollarSign size={19} color="#2563EB" />}
            iconBg="#EFF6FF"
            accent="#2563EB"
            trend="+8.4%"
            loading={loading}
          />
          <StatCard
            label="Submissions"
            value={stats.count.toString()}
            icon={<Wallet size={19} color="#7C3AED" />}
            iconBg="#F5F3FF"
            accent="#7C3AED"
            loading={loading}
          />
          <StatCard
            label="Verified"
            value={stats.verified.toString()}
            icon={<FileCheck size={19} color="#16A34A" />}
            iconBg="#F0FDF4"
            accent="#16A34A"
            loading={loading}
          />
          <StatCard
            label="Pending Audit"
            value={stats.pending.toString()}
            icon={<Hourglass size={19} color="#D97706" />}
            iconBg="#FFFBEB"
            accent="#D97706"
            loading={loading}
          />
        </div>

        {/* ── Main Content Grid ── */}
        <div className="main-grid">

          {/* Recent Submissions */}
          <div className="section-card fade-up fade-up-3">
            <div className="section-header">
              <div>
                <h3 className="section-title">Recent Submissions</h3>
                <p className="section-sub">Your latest expense claims</p>
              </div>
              <Link href="/expenses" className="view-all-link">
                View all <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {loading
                ? [1, 2, 3].map((i) => (
                    <div key={i} className="shimmer" style={{ height: "88px", borderRadius: "10px" }} />
                  ))
                : expenses.length === 0
                ? (
                    <div className="empty-state">
                      <ReceiptText size={32} style={{ opacity: 0.25 }} />
                      <p>No expenses found</p>
                    </div>
                  )
                : expenses.slice(0, 4).map((e) => (
                    <ExpenseCard key={e.id} record={e} />
                  ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── StatCard ── */
function StatCard({
  label, value, icon, iconBg, accent, trend, loading,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  accent: string;
  trend?: string;
  loading?: boolean;
}) {
  return (
    <div className="stat-card" style={{ "--card-accent": accent } as React.CSSProperties}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="stat-icon-wrap" style={{ background: iconBg }}>
          {icon}
        </div>
        {trend && (
          <span className="stat-trend">
            <ArrowUpRight size={11} />
            {trend}
          </span>
        )}
      </div>
      <div>
        <div className="stat-label">{label}</div>
        {loading ? (
          <div className="shimmer" style={{ height: "28px", width: "90px", marginTop: "6px" }} />
        ) : (
          <div className="stat-value">{value}</div>
        )}
      </div>
    </div>
  );
}

/* ── StatusRow ── */
function StatusRow({
  label, count, total, color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
        <span className="status-row-label">{label}</span>
        <span className="status-row-count">
          {count} <span className="status-row-pct">({pct}%)</span>
        </span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}