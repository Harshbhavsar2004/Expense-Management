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
import { CircularLoader } from "@/components/CircularLoader";
import { motion } from "framer-motion";
import { 
  CheckCircle2, 
  AlertCircle, 
  XCircle,
  Calendar as IconCalendar,
  Layers,
} from "lucide-react";

export default function EmployeeDashboard() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((d) => setFirstName(d?.full_name?.split(" ")[0] || "there"))
      .catch(() => setFirstName("there"));

    fetch("/api/expenses/all?mine=true")
      .then((r) => r.json())
      .then((d) => setExpenses(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!expenses.length)
      return { total: 0, count: 0, verified: 0, pending: 0, flagged: 0 };

    const total = expenses.reduce(
      (s, e) => s + (e.claimed_amount_numeric || 0),
      0
    );

    const hasMismatch = (e: ExpenseRow) => 
      e.audit_result?.mismatch === true || 
      (Array.isArray(e.mismatches) && e.mismatches.length > 0);

    const flagged  = expenses.filter((e) => hasMismatch(e)).length;
    const verified = expenses.filter((e) => e.verified && !hasMismatch(e)).length;
    const pending  = expenses.filter((e) => !e.verified && !hasMismatch(e)).length;

    return { total, count: expenses.length, verified, pending, flagged };
  }, [expenses]);

  return (
    <div className="flex flex-col gap-8 p-8 w-full animate-in fade-in duration-700">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-zinc-900">
            Welcome back, <span className="text-blue-900">{firstName}</span>
          </h1>
        </div>
      </div>

      {/* ── Stats Highlights ── */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4"
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: {
              staggerChildren: 0.1
            }
          }
        }}
      >
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
        <StatCard 
          label="Flagged Items" 
          value={stats.flagged.toString()}
          description="Requires your attention"
          icon={<ReceiptText size={22} />}
          variant="rose"
          loading={loading}
        />
      </motion.div>

      {/* ── Recent Submissions ── */}
      <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3>Recent Submissions</h3>
              <p className="text-zinc-500 font-medium">Detailed log of your latest expense activities</p>
            </div>
            <Link href="/applications" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
              View Analytics 
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <CircularLoader message="Fetching your latest submissions..." />
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-200">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-400">
                  <ReceiptText size={32} strokeWidth={1.5} />
                </div>
                <h4 className="text-lg font-bold text-zinc-900">No expenses yet</h4>
                <p className="text-zinc-500 text-sm">Submit your first expense via the AI Bot or WhatsApp.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50/50 border-bottom border-zinc-100">
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Date</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Category</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">Claimed</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">Approved</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">Status</th>
                        <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {expenses.slice(0, 5).map((e, index) => {
                        const hasMismatch = e.audit_result?.mismatch === true || (Array.isArray(e.mismatches) && e.mismatches.length > 0);
                        const isVerified = e.verified;

                        return (
                          <motion.tr 
                            key={e.id} 
                            className="hover:bg-zinc-50/50 transition-colors group"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.2 + (index * 0.05) }}
                          >
                            <td className="px-6 py-4 transition-all group-hover:pl-8">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-zinc-100 text-zinc-500 rounded-lg group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                  <IconCalendar size={14} />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-zinc-900">
                                    {e.date_range || e.receipts?.[0]?.transaction_date || 
                                      new Date(e.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-medium">
                                    Submitted: {new Date(e.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span className="text-sm font-semibold text-zinc-700">{e.expense_type}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-zinc-900">
                              ₹{e.claimed_amount_numeric?.toLocaleString("en-IN") || "0"}
                            </td>
                            <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">
                              ₹{e.total_receipt_amount?.toLocaleString("en-IN") || "0"}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                {isVerified ? (
                                  <div className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold flex items-center gap-1 border border-emerald-100 shadow-sm">
                                    <CheckCircle2 size={12} />
                                    Audit Cleared
                                  </div>
                                ) : hasMismatch ? (
                                  <div className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold flex items-center gap-1 border border-rose-100 shadow-sm">
                                    <XCircle size={12} />
                                    Action Required
                                  </div>
                                ) : (
                                  <div className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold flex items-center gap-1 border border-amber-100 shadow-sm">
                                    <AlertCircle size={12} />
                                    Awaiting Audit
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Link 
                                href={`/applications/${e.application_id}`}
                                className="p-2 text-zinc-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              >
                                <ArrowRight size={16} />
                              </Link>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
    </div>
  );
}

function StatCard({ label, value, description, icon, variant, loading }: any) {
  const iconColors = {
    primary: "bg-blue-50 text-blue-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    rose:    "bg-rose-50 text-rose-600",
    zinc:    "bg-zinc-100 text-zinc-600",
  };

  return (
    <motion.div 
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
      }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="p-6 rounded-2xl border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:shadow-lg transition-all duration-300"
    >
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
    </motion.div>
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