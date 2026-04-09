"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  UserCheck, 
  CreditCard, 
  ShieldCheck,
  TrendingUp,
  Mail,
  Phone,
  ChevronRight,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

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
    const emps = users.filter(u => u.role !== "admin");
    return emps.map(u => {
      const userExpenses = expenses.filter(e => e.user_id === u.id);
      const total = userExpenses.reduce((s, e) => s + (e.claimed_amount_numeric || 0), 0);
      const verified = userExpenses.filter(e => e.verified).length;
      return { ...u, count: userExpenses.length, total, verified };
    }).sort((a, b) => b.total - a.total);
  }, [users, expenses]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Employee <span className="text-blue-900">Directory</span>
          </h1>
          <p className="text-zinc-500 font-medium max-w-md">
            Manage your workforce, track spending patterns, and monitor audit compliance across the organization.
          </p>
        </div>
      </div>

      {/* ── Employees Table ── */}
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/50 border-b border-zinc-200">
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Employee</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-center">Claims</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Total Claimed</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest">Audit Score</th>
                <th className="px-6 py-4 text-[11px] font-bold text-zinc-500 uppercase tracking-widest text-right">Banking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={5} className="px-6 py-10" />
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-zinc-400">
                    <div className="flex flex-col items-center gap-3">
                      <Users size={48} className="opacity-10" />
                      <p className="font-bold">No employees found</p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {employees.map((emp, i) => {
                    const compliancePct = emp.count > 0 ? Math.round((emp.verified / emp.count) * 100) : 0;
                    const hue = (emp.full_name.charCodeAt(0) * 7) % 360;
                    
                    return (
                      <motion.tr 
                        key={emp.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ delay: i * 0.05 }}
                        className="group hover:bg-zinc-50/80 transition-all duration-200 cursor-pointer"
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div 
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm"
                              style={{ background: `hsl(${hue}, 60%, 52%)` }}
                            >
                              {emp.full_name[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-zinc-900 truncate flex items-center gap-2">
                                {emp.full_name}
                                {emp.bank_verified && <CheckCircle2 size={14} className="text-emerald-500" />}
                              </p>
                              <div className="flex items-center gap-3 text-[11px] text-zinc-500 font-bold mt-0.5">
                                <span className="flex items-center gap-1"><Mail size={12} /> {emp.email || "—"}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-extrabold text-zinc-900">{emp.count}</span>
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Total Claims</span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-sm font-extrabold text-zinc-900">₹{emp.total.toLocaleString("en-IN")}</span>
                            <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 uppercase tracking-tighter">
                              <TrendingUp size={10} /> {emp.verified} Verified
                            </span>
                          </div>
                        </td>

                        <td className="px-6 py-5">
                          <div className="flex flex-col gap-2 w-32">
                            <div className="flex justify-between items-center text-[10px] font-bold uppercase text-zinc-500">
                              <span>Compliance</span>
                              <span className={cn(
                                compliancePct > 70 ? "text-emerald-600" : compliancePct > 40 ? "text-amber-600" : "text-rose-600"
                              )}>
                                {compliancePct}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${compliancePct}%` }}
                                className={cn(
                                  "h-full rounded-full transition-all duration-1000",
                                  compliancePct > 70 ? "bg-emerald-500" : compliancePct > 40 ? "bg-amber-500" : "bg-rose-500"
                                )}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-5 text-right">
                          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-zinc-200 bg-white group-hover:border-zinc-300 transition-colors shadow-sm">
                            {emp.bank_verified ? (
                              <>
                                <CheckCircle2 size={12} className="text-emerald-600" />
                                <span className="text-[11px] font-bold text-zinc-700 capitalize">Verified</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={12} className="text-amber-600" />
                                <span className="text-[11px] font-bold text-zinc-700 capitalize">Pending Bank</span>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}