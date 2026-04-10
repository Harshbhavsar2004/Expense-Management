"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  Users,
  Mail,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  X,
  Send,
  Loader2,
  AtSign,
  User,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

/* ── Invite panel ─────────────────────────────────────────────────────────── */
function InvitePanel({ open, onClose, onInvited }: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail]         = useState("");
  const [fullName, setFullName]   = useState("");
  const [sending, setSending]     = useState(false);
  const [sent, setSent]           = useState(false);
  const [error, setError]         = useState("");
  const emailRef = useRef<HTMLInputElement>(null);

  // Reset state when panel opens
  useEffect(() => {
    if (open) {
      setEmail(""); setFullName(""); setSent(false); setError("");
      setTimeout(() => emailRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSend = async () => {
    const trimEmail = email.trim();
    const trimName  = fullName.trim();
    if (!trimEmail) { setError("Email is required."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) { setError("Enter a valid email address."); return; }
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimEmail, full_name: trimName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send invite."); return; }
      setSent(true);
      onInvited();
      toast.success(`Invite sent to ${trimEmail}`);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleSendAnother = () => {
    setEmail(""); setFullName(""); setSent(false); setError("");
    setTimeout(() => emailRef.current?.focus(), 50);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="invite-backdrop"
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Side panel */}
          <motion.aside
            key="invite-panel"
            className="fixed top-0 right-0 h-full w-full max-w-[420px] bg-white z-50 flex flex-col shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320, mass: 0.8 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <UserPlus size={18} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-[15px] font-extrabold text-zinc-900 tracking-tight">Invite Employee</h2>
                  <p className="text-[11px] font-medium text-zinc-400">Send a sign-up link via email</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AnimatePresence mode="wait">
                {sent ? (
                  /* ── Success state ── */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center text-center gap-4 pt-10"
                  >
                    <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
                      <CheckCircle2 size={32} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-zinc-900">Invite Sent!</p>
                      <p className="text-[13px] text-zinc-500 mt-1">
                        <span className="font-semibold text-zinc-700">{email}</span> will receive a sign-up link shortly.
                      </p>
                    </div>
                    <div className="w-full bg-zinc-50 rounded-2xl p-4 text-left border border-zinc-100 mt-2">
                      <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-2">What happens next</p>
                      {[
                        "They receive an email with a secure link",
                        "They click the link to set their password",
                        "They complete onboarding (phone, org, bank)",
                        "They appear in your Employee Directory",
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5 mb-2 last:mb-0">
                          <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </div>
                          <p className="text-[12px] text-zinc-600 font-medium">{step}</p>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={handleSendAnother}
                      className="w-full py-3 rounded-2xl border-2 border-zinc-200 text-[13px] font-bold text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 transition-all mt-2"
                    >
                      Send Another Invite
                    </button>
                  </motion.div>
                ) : (
                  /* ── Form ── */
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <p className="text-[13px] text-zinc-500 mb-6 leading-relaxed">
                      The employee will receive a secure email with a link to create their account and complete onboarding.
                    </p>

                    <div className="space-y-4">
                      {/* Email */}
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                          Work Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <AtSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                          <input
                            ref={emailRef}
                            type="email"
                            value={email}
                            onChange={e => { setEmail(e.target.value); setError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleSend()}
                            placeholder="employee@company.com"
                            className={cn(
                              "w-full pl-9 pr-4 py-3 rounded-xl border text-[14px] font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-300",
                              error ? "border-red-300 bg-red-50" : "border-zinc-200 bg-zinc-50 focus:border-blue-400 focus:bg-white"
                            )}
                          />
                        </div>
                      </div>

                      {/* Full Name (optional) */}
                      <div>
                        <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">
                          Full Name <span className="text-zinc-300">(optional)</span>
                        </label>
                        <div className="relative">
                          <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                          <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleSend()}
                            placeholder="e.g. Ravi Sharma"
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-[14px] font-medium text-zinc-900 outline-none transition-all placeholder:text-zinc-300 focus:border-blue-400 focus:bg-white"
                          />
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1.5 pl-1">
                          Pre-fills their display name after sign-up.
                        </p>
                      </div>

                      {error && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                          <AlertCircle size={13} className="flex-shrink-0" />
                          <p className="text-[12px] font-semibold">{error}</p>
                        </div>
                      )}
                    </div>

                    {/* Info box */}
                    <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                      <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-2">How it works</p>
                      <p className="text-[12px] text-blue-700 leading-relaxed">
                        Supabase sends a secure magic link to this email. The employee clicks it, sets a password, and is guided through onboarding — no manual account creation needed.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer — only shown in form state */}
            {!sent && (
              <div className="px-6 py-4 border-t border-zinc-100 bg-white">
                <button
                  onClick={handleSend}
                  disabled={sending || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-white text-[14px] transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
                >
                  {sending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <><Send size={15} /> Send Invitation</>
                  )}
                </button>
                <p className="text-[11px] text-zinc-400 text-center mt-2">
                  Invite link expires in 24 hours.
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ── Main page ────────────────────────────────────────────────────────────── */
export default function EmployeesPage() {
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchData = () => {
    setLoading(true);
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
  };

  useEffect(() => { fetchData(); }, []);

  const employees = useMemo(() => {
    const emps = users.filter(u => u.role !== "admin");
    return emps.map(u => {
      const userExpenses = expenses.filter(e => e.user_id === u.id);
      const total    = userExpenses.reduce((s, e) => s + (e.claimed_amount_numeric || 0), 0);
      const verified = userExpenses.filter(e => e.verified).length;
      return { ...u, count: userExpenses.length, total, verified };
    }).sort((a, b) => b.total - a.total);
  }, [users, expenses]);

  return (
    <>
      <InvitePanel
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={fetchData}
      />

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

          {/* Invite button */}
          <button
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-white text-[14px] shadow-md hover:shadow-lg transition-all active:scale-[0.97] flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
          >
            <UserPlus size={17} />
            Invite Employee
          </button>
        </div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Employees", value: employees.length, icon: Users, color: "blue" },
            { label: "Bank Verified",   value: employees.filter(e => e.bank_verified).length, icon: CheckCircle2, color: "emerald" },
            { label: "Total Claims",    value: employees.reduce((s, e) => s + e.count, 0), icon: TrendingUp, color: "violet" },
            { label: "Pending Bank",    value: employees.filter(e => !e.bank_verified).length, icon: AlertCircle, color: "amber" },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-zinc-200 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-sm">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                stat.color === "blue"    && "bg-blue-50",
                stat.color === "emerald" && "bg-emerald-50",
                stat.color === "violet"  && "bg-violet-50",
                stat.color === "amber"   && "bg-amber-50",
              )}>
                <stat.icon size={18} className={cn(
                  stat.color === "blue"    && "text-blue-600",
                  stat.color === "emerald" && "text-emerald-600",
                  stat.color === "violet"  && "text-violet-600",
                  stat.color === "amber"   && "text-amber-600",
                )} />
              </div>
              <div>
                <p className="text-xl font-extrabold text-zinc-900">{stat.value}</p>
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
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
                      <td colSpan={5} className="px-6 py-10">
                        <div className="h-4 bg-zinc-100 rounded-full w-3/4" />
                      </td>
                    </tr>
                  ))
                ) : employees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-20 text-center text-zinc-400">
                      <div className="flex flex-col items-center gap-4">
                        <Users size={48} className="opacity-10" />
                        <div>
                          <p className="font-bold text-zinc-500">No employees yet</p>
                          <p className="text-[13px] text-zinc-400 mt-1">Use the <strong>Invite Employee</strong> button to get started.</p>
                        </div>
                        <button
                          onClick={() => setInviteOpen(true)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-white text-[13px] mt-2"
                          style={{ background: "linear-gradient(135deg, #1d4ed8, #2563eb)" }}
                        >
                          <UserPlus size={14} /> Invite Employee
                        </button>
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
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0"
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
                                  <span className="text-[11px] font-bold text-zinc-700">Verified</span>
                                </>
                              ) : (
                                <>
                                  <AlertCircle size={12} className="text-amber-600" />
                                  <span className="text-[11px] font-bold text-zinc-700">Pending Bank</span>
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
    </>
  );
}
