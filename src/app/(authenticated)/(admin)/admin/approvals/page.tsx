"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  ArrowLeft,
  CheckCircle2, 
  RefreshCw, 
  ExternalLink, 
  IndianRupee,
  Search,
  Users,
  Calendar as IconCalendar,
  AlertCircle,
  Hourglass,
  ArrowRight,
  Filter,
  CircleDollarSign
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Application {
  id: string;
  application_id: string;
  client_name: string;
  city: string;
  submitted_at: string;
  status: string;
  reimbursable_amount: number | null;
  flagged_count: number | null;
  payout_status: string | null;
  users: { full_name: string; email: string } | null;
}

interface PayoutConfig {
  auto_payout_enabled: boolean;
  fixed_amount: number;
}

// ── Components ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, variant, loading }: any) {
  const variants = {
    primary: "bg-blue-50 text-blue-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-600",
    danger:  "bg-rose-50 text-rose-600",
    zinc:    "bg-zinc-100 text-zinc-600",
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="p-6 rounded-2xl border border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:shadow-lg transition-all duration-300 flex-1"
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [config, setConfig]             = useState<PayoutConfig | null>(null);
  const [actionState, setActionState]   = useState<Record<string, string | null>>({});
  const [searchQuery, setSearchQuery]   = useState("");

  const fetchApps = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/applications/submitted");
      const d = await res.json();
      setApplications(Array.isArray(d) ? d : []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchApps();
    fetch("/api/admin/payout-config")
      .then((r) => r.json())
      .then((d) => setConfig(d))
      .catch(() => {});
  }, [fetchApps]);

  const stats = useMemo(() => ({
    pending:  applications.length,
    flagged:  applications.reduce((s, a) => s + (a.flagged_count ?? 0), 0),
    totalVal: applications.reduce((s, a) => s + (a.reimbursable_amount ?? 0), 0),
  }), [applications]);

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      const searchStr = (app.application_id + " " + (app.users?.full_name || "") + " " + (app.client_name || "")).toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
  }, [applications, searchQuery]);

  const handleAction = async (app: Application, newStatus: "approved" | "rejected") => {
    setActionState((prev) => ({ ...prev, [app.application_id]: newStatus === "approved" ? "approving" : "rejecting" }));
    try {
      const res = await fetch(`/api/applications/${app.application_id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Status update failed");

      if (newStatus === "approved") {
        toast.success(`${app.application_id} approved.`);
      } else {
        toast.success(`${app.application_id} rejected.`);
      }

      setApplications((prev) => prev.filter((a) => a.application_id !== app.application_id));
    } catch (err: any) {
      toast.error(err.message ?? "Action failed.");
    }
    setActionState((prev) => ({ ...prev, [app.application_id]: null }));
  };

  return (
    <div className="flex flex-col gap-8 p-8 max-w-7xl mx-auto animate-in fade-in duration-700">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
              Pending <span className="text-blue-900">Approvals</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-zinc-500 font-medium">Review and verify employee expense claims</p>
              {config?.auto_payout_enabled && (
                <div className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold flex items-center gap-1 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Auto-payout ON · ₹{config.fixed_amount.toLocaleString("en-IN")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Awaiting Review" 
          value={stats.pending.toString()} 
          icon={<Clock size={22} />} 
          variant="warning" 
          loading={loading} 
        />
        <StatCard 
          label="Flagged Items" 
          value={stats.flagged.toString()} 
          icon={<AlertTriangle size={22} />} 
          variant="danger" 
          loading={loading} 
        />
        <StatCard 
          label="Total Reimbursable" 
          value={`₹${stats.totalVal.toLocaleString("en-IN")}`} 
          icon={<CircleDollarSign size={22} />} 
          variant="success" 
          loading={loading} 
        />
      </div>

      {/* ── Table Controls ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative group flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by ID, User, or Client..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Applications Table ── */}
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50/80 border-b border-zinc-100">
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Application / Employee</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Location</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-right">Reimbursable</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">Status</th>
                <th className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-zinc-400 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`skeleton-${i}`}>
                      <td colSpan={5} className="px-6 py-4">
                        <div className="h-16 w-full bg-zinc-100 animate-pulse rounded-xl" />
                      </td>
                    </tr>
                  ))
                ) : filteredApps.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center text-zinc-300">
                          <CheckCircle size={32} />
                        </div>
                        <div>
                          <h4 className="text-zinc-900 font-bold">No applications found</h4>
                          <p className="text-zinc-500 text-xs font-medium">All caught up or try a different search</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredApps.map((app, index) => {
                    const state = actionState[app.application_id];
                    const isActing = !!state;

                    return (
                      <motion.tr 
                        key={app.id} 
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ delay: index * 0.03 }}
                        className={cn(
                          "group hover:bg-zinc-50/50 transition-colors",
                          isActing && "opacity-50 pointer-events-none"
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-sm group-hover:scale-105 transition-transform">
                              {app.application_id.slice(-2)}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-bold text-zinc-900">{app.application_id}</span>
                                  <div className="text-[10px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-500 font-bold">
                                    {app.submitted_at ? new Date(app.submitted_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                                  </div>
                                </div>
                                <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1 mt-0.5">
                                  <Users size={10} />
                                  {app.users?.full_name ?? "Unknown Employee"}
                                </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-zinc-700">{app.client_name || "—"}</span>
                            <span className="text-[11px] text-zinc-500 font-medium">{app.city || "—"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-emerald-600">₹{(app.reimbursable_amount ?? 0).toLocaleString("en-IN")}</span>
                            {(app.flagged_count ?? 0) > 0 && (
                              <div className="flex items-center justify-end gap-1 text-[10px] text-rose-500 font-bold uppercase tracking-tight">
                                <AlertCircle size={10} />
                                {app.flagged_count} Flagged
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col items-center gap-1">
                              <PayoutBadge status={app.payout_status} />
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleAction(app, "approved")}
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm border border-emerald-100"
                            >
                              {state === "approving" ? <RefreshCw size={12} className="animate-spin" /> : "Approve"}
                            </button>
                            <button
                              onClick={() => handleAction(app, "rejected")}
                              className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg text-xs font-bold transition-all shadow-sm border border-rose-100"
                            >
                              {state === "rejecting" ? <RefreshCw size={12} className="animate-spin" /> : "Reject"}
                            </button>
                            <button
                              onClick={() => router.push(`/applications/${app.application_id}`)}
                              className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            >
                              <ExternalLink size={16} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
