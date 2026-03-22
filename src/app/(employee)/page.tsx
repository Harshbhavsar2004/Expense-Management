"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseCard } from "@/components/ExpenseCard";
import { ExpenseRow } from "@/components/ExpensesTable";
import {
  ArrowRight,
  ReceiptText,
  Wallet,
  FileCheck,
  Hourglass,
  CircleDollarSign,
  MessageCircle,
  BarChart2,
  Download,
  Users,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function EmployeeDashboard() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => setFirstName(d?.full_name?.split(" ")[0] || "there"))
      .catch(() => setFirstName("there"));

    fetch("/api/expenses/all")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!expenses.length)
      return { total: 0, count: 0, verified: 0, pending: 0 };
    const total = expenses.reduce(
      (s, e) => s + (e.claimed_amount_numeric || 0),
      0
    );
    const verified = expenses.filter((e) => e.verified).length;
    return {
      total,
      count: expenses.length,
      verified,
      pending: expenses.length - verified,
    };
  }, [expenses]);

  return (
    <div className="flex flex-col gap-8 p-8 w-full animate-in fade-in duration-700">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight font-outfit">
            Welcome back, <span className="text-zinc-500 font-medium">{firstName}</span>
          </h1>
          <p className="text-zinc-500 font-medium text-[15px]">
            You have <span className="text-zinc-900 font-bold">{stats.pending}</span> expenses awaiting audit.
          </p>
        </div>
      </div>

      {/* ── Stats Highlights ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          label="Total Reimbursement" 
          value={`₹${stats.total.toLocaleString("en-IN")}`}
          description="Approved for current cycle"
          icon={<CircleDollarSign size={22} />}
          variant="primary"
          loading={loading}
        />
        <StatCard 
          label="Total Submissions" 
          value={stats.count.toString()}
          description="Claims processed this month"
          icon={<Wallet size={22} />}
          variant="zinc"
          loading={loading}
        />
        <StatCard 
          label="Audit Cleared" 
          value={stats.verified.toString()}
          description="Successfully verified claims"
          icon={<FileCheck size={22} />}
          variant="success"
          loading={loading}
        />
        <StatCard 
          label="Pending Review" 
          value={stats.pending.toString()}
          description="Awaiting AI verification"
          icon={<Hourglass size={22} />}
          variant="warning"
          loading={loading}
        />
      </div>

      {/* ── Recent Submissions ── */}
      <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 font-outfit">Recent Submissions</h3>
              <p className="text-sm text-zinc-500 font-medium">Detailed log of your latest expense activities</p>
            </div>
            <Link href="/applications" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
              View Analytics 
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="h-24 w-full bg-zinc-100 animate-pulse rounded-xl border border-zinc-200" />
              ))
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-200">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                  <ReceiptText size={32} strokeWidth={1.5} />
                </div>
                <h4 className="text-lg font-bold text-zinc-900">No expenses yet</h4>
                <p className="text-zinc-500 text-sm">Submit your first expense via the AI Bot or WhatsApp.</p>
              </div>
            ) : (
              expenses.slice(0, 3).map((e) => (
                <ExpenseCard key={e.id} record={e} />
              ))
            )}
          </div>
        </div>
    </div>
  );
}

function StatCard({ label, value, description, icon, variant, loading }: any) {
  const iconColors = {
    primary: "bg-violet-50 text-violet-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    zinc: "bg-zinc-100 text-zinc-600",
  };

  return (
    <div className="p-6 rounded-2xl border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:shadow-md transition-all duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-2.5 rounded-xl", iconColors[variant as keyof typeof iconColors])}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[12px] font-bold uppercase tracking-widest mb-1 opacity-60 text-zinc-500">
          {label}
        </p>
        {loading ? (
          <div className="h-8 w-24 bg-zinc-200/50 animate-pulse rounded-lg mt-2" />
        ) : (
          <h2 className="text-3xl font-extrabold tracking-tight text-zinc-900">{value}</h2>
        )}
        <p className="text-[11px] font-medium mt-2 text-zinc-400">
          {description}
        </p>
      </div>
    </div>
  );
}

function ResourceLink({ icon, title, desc }: any) {
  return (
    <button className="flex items-center gap-3 w-full p-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left group">
      <div className="p-2 bg-zinc-100 text-zinc-500 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
        {icon}
      </div>
      <div>
        <div className="text-sm font-bold text-zinc-900">{title}</div>
        <div className="text-[11px] text-zinc-400 font-medium">{desc}</div>
      </div>
    </button>
  );
}