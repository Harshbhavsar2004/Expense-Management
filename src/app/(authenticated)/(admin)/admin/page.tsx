"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  CheckCircle, 
  AlertTriangle,
  CircleDollarSign, 
  ReceiptText, 
  ArrowRight,
  ShieldCheck, 
  Hourglass,
  Calendar as IconCalendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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

  const pendingApps = data.applications.filter(a => a.status === "submitted").slice(0, 8);

  return (
    <div className="flex flex-col gap-8 p-8 w-full animate-in fade-in duration-700">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-zinc-900 font-extrabold tracking-tight">
            Admin <span className="text-blue-900">Overview</span>
          </h1>
          <p className="text-zinc-500 font-medium">Global expense monitoring and application management</p>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4"
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
        <StatCard label="Total Volume"      value={`₹${(stats.total / 100000).toFixed(1)}L`} icon={<CircleDollarSign size={22} />} variant="primary" loading={loading} />
        <StatCard label="Total Claims"      value={stats.count.toString()}                    icon={<ReceiptText size={22} />}      variant="zinc"    loading={loading} />
        <StatCard label="Verified"          value={stats.verified.toString()}                 icon={<ShieldCheck size={22} />}     variant="success" loading={loading} />
        <StatCard label="Pending"           value={stats.pending.toString()}                  icon={<Hourglass size={22} />}       variant="warning" loading={loading} />
        <StatCard label="Mismatches"        value={stats.mismatches.toString()}               icon={<AlertTriangle size={22} />}   variant="rose"    loading={loading} />
        <StatCard label="Employees"         value={stats.employees.toString()}                icon={<Users size={22} />}           variant="zinc"    loading={loading} />
      </motion.div>

      {/* ── Main Content Area ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-zinc-900 font-bold tracking-tight">Pending Applications</h3>
          </div>
          <Link href="/admin/approvals" className="text-sm font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 group transition-colors">
            View all Applications 
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
             {[1,2,3,4].map(i => <div key={i} className="h-[72px] bg-zinc-100 animate-pulse rounded-2xl" />)}
          </div>
        ) : pendingApps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-50/50 rounded-2xl border-2 border-dashed border-zinc-200">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4 text-zinc-400">
              <CheckCircle size={32} strokeWidth={1.5} />
            </div>
            <h4 className="text-lg font-bold text-zinc-900">All cleared</h4>
            <p className="text-zinc-500 text-sm">No pending applications requiring review.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50/50 border-b border-zinc-100">
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Application / Employee</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Location</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">Reimbursable</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">Submitted At</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">Status</th>
                    <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {pendingApps.map((app, index) => (
                    <motion.tr 
                      key={app.id} 
                      className="hover:bg-zinc-50/50 transition-colors group cursor-pointer"
                      onClick={() => window.location.href = `/applications/${app.application_id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-sm transition-all group-hover:scale-110",
                            "bg-blue-600 text-white"
                          )}>
                            {app.application_id.slice(-2)}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-zinc-900">{app.application_id}</div>
                            <div className="text-[11px] text-zinc-500 font-medium">{app.users?.full_name || "Employee"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-zinc-300" />
                           <span className="text-sm font-semibold text-zinc-700">{app.city || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-emerald-600">₹{(app.reimbursable_amount ?? 0).toLocaleString("en-IN")}</span>
                          {app.flagged_count > 0 && (
                            <span className="text-[10px] text-rose-500 font-bold">{app.flagged_count} flagged items</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                         <div className="flex items-center justify-center gap-2">
                            <IconCalendar size={14} className="text-zinc-400" />
                            <span className="text-[12px] font-medium text-zinc-600">
                              {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                            </span>
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <PayoutBadge status={app.payout_status} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <div className="p-2 text-zinc-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all">
                            <ArrowRight size={16} />
                         </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, variant, loading }: any) {
  const variants = {
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
        <div className={cn("p-2.5 rounded-xl", variants[variant as keyof typeof variants])}>
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
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-900">{value}</h2>
        )}
      </div>
    </motion.div>
  );
}

function PayoutBadge({ status }: { status: string | null }) {
  if (!status) return (
    <div className="px-2.5 py-1 bg-zinc-50 text-zinc-600 rounded-full text-[10px] font-bold flex items-center gap-1 border border-zinc-100 shadow-sm">
      <AlertCircle size={12} />
      Review Needed
    </div>
  );

  const map: Record<string, { bg: string; color: string; border: string; icon: any }> = {
    PENDING:  { bg: "bg-amber-50", color: "text-amber-600", border: "border-amber-100", icon: Hourglass },
    SUCCESS:  { bg: "bg-emerald-50", color: "text-emerald-600", border: "border-emerald-100", icon: CheckCircle2 },
    FAILURE:  { bg: "bg-rose-50", color: "text-rose-600", border: "border-rose-100", icon: XCircle },
    REVERSED: { bg: "bg-purple-50", color: "text-purple-600", border: "border-purple-100", icon: AlertTriangle },
  };

  const s = map[status] ?? { bg: "bg-zinc-50", color: "text-zinc-600", border: "border-zinc-100", icon: AlertCircle };
  const Icon = s.icon;

  return (
    <div className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border shadow-sm", s.bg, s.color, s.border)}>
       <Icon size={12} />
       {status}
    </div>
  );
}
