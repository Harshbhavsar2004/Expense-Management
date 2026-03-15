"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseCard } from "@/components/ExpenseCard";
import { ExpenseRow } from "@/components/ExpensesTable";
import { ArrowUpRight, TrendingUp, CheckCircle, Clock, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/all`);
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const stats = useMemo(() => {
    const total = expenses.reduce((sum, e) => sum + (e.claimed_amount_numeric || 0), 0);
    const verified = expenses.filter(e => e.verified).length;
    return {
      total,
      count: expenses.length,
      verified,
      pending: expenses.length - verified
    };
  }, [expenses]);

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "32px" }}>
      <div style={{ maxWidth: "1200px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 800, marginBottom: "8px" }}>Welcome back, Harshal</h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>Here's what's happening with your expenses today.</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px" }}>
        <StatsCard title="Total Volume" value={`₹${stats.total.toLocaleString("en-IN")}`} color="var(--accent)" icon={<TrendingUp size={20}/>} trend="+8.4%" />
        <StatsCard title="Claims Processed" value={stats.count.toString()} icon={<Clock size={20}/>} />
        <StatsCard title="Verified Claims" value={stats.verified.toString()} color="var(--success)" icon={<CheckCircle size={20}/>} />
        <StatsCard title="Audit Pending" value={stats.pending.toString()} color="var(--warning)" icon={<AlertCircle size={20}/>} />
      </div>

      {/* Recent Activity */}
      <div className="premium-card p-6">
        <div style={{ marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
           <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700 }}>Recent Submissions</h3>
           <Link href="/expenses" style={{ textDecoration: "none", color: "var(--accent)", fontWeight: 600, fontSize: "13px" }}>View All Items</Link>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
           {loading ? (
             [1,2,3].map(i => <div key={i} className="shimmer" style={{ height: "90px" }} />)
           ) : (
             expenses.slice(0, 3).map(e => <ExpenseCard key={e.id} record={e} />)
           )}
        </div>
      </div>
    </div>
  );
}

function StatsCard({ title, value, color, icon, trend }: { title: string, value: string, color?: string, icon: any, trend?: string }) {
  return (
    <div className="premium-card" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
        <div style={{ padding: "10px", background: color ? `${color}15` : "var(--bg-tertiary)", color: color || "var(--text-secondary)", borderRadius: "var(--radius-sm)" }}>
          {icon}
        </div>
        {trend && (
           <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--success)", display: "flex", alignItems: "center", gap: "2px" }}>
             <ArrowUpRight size={14} /> {trend}
           </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</div>
        <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>{value}</div>
      </div>
    </div>
  );
}
