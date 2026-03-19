"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck, Clock, RefreshCw, Send, CheckCircle2 } from "lucide-react";
import { ExpenseCard } from "@/components/ExpenseCard";
import { FilterBar, Filters } from "@/components/FilterBar";
import { AuditAgent } from "@/components/AuditAgent";
import { ExpenseRow } from "@/components/ExpensesTable";

export default function ApplicationDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const applicationId = params.id as string;

  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<ExpenseRow | null>(null);
  const [filters, setFilters] = useState<Filters>({
    from: "",
    to: "",
    category: "all",
  });
  const [auditingIds, setAuditingIds] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    setFadeOut(false);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 800));
    try {
      const queryParams = new URLSearchParams();
      if (filters.from) queryParams.append("from", filters.from);
      if (filters.to) queryParams.append("to", filters.to);
      if (filters.category && filters.category !== "all") queryParams.append("category", filters.category);

      const [appRes, userRes, expRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}`),
        fetch("/api/user/profile"),
        fetch(`/api/expenses/by-application/${applicationId}?${queryParams.toString()}`),
        minDelay,
      ]);

      const [appData, userData, expData] = await Promise.all([
        appRes.json(),
        userRes.json(),
        expRes.json(),
      ]);

      // Fade out skeleton before swapping content
      setFadeOut(true);
      setTimeout(() => {
        setApplication(appData);
        setUser(userData);
        setExpenses(expData);
        setLoading(false);
        setFadeOut(false);
      }, 350);
    } catch (err) {
      console.error("Fetch error:", err);
      setFadeOut(true);
      setTimeout(() => {
        setLoading(false);
        setFadeOut(false);
      }, 350);
    }
  };

  useEffect(() => {
    if (applicationId) fetchData();
  }, [applicationId, filters]);

  const runAudit = async (expenseId: string) => {
    setAuditingIds((prev) => new Set(prev).add(expenseId));
    try {
      const res = await fetch(`/api/audit/expense/${expenseId}`, { method: "POST" });
      if (res.ok) {
        const expRes = await fetch(`/api/expenses/by-application/${applicationId}`);
        const expData = await expRes.json();
        setExpenses(expData);
      }
    } catch (err) {
      console.error("Audit error:", err);
    } finally {
      setAuditingIds((prev) => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const submitForApproval = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "submitted" }),
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error("Submission error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const categories = useMemo(() => {
    if (!Array.isArray(expenses)) return [];
    const cats = new Set(expenses.map(e => e.expense_type).filter(Boolean));
    return Array.from(cats) as string[];
  }, [expenses]);

  const isEmployee = user?.role === "employee";
  const status = application?.status || "draft";

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Page Header */}
      <div className="px-8 py-6 border-b border-slate-200 bg-white shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex flex-col gap-1">
          <button
            onClick={() => router.push("/applications")}
            className="group flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-xs font-bold uppercase tracking-wider">Back to Reports</span>
          </button>

          {loading ? (
            <div
              className="flex flex-col gap-2 transition-opacity duration-300 ease-in-out"
              style={{ opacity: fadeOut ? 0 : 1 }}
            >
              <div className="h-5 w-24 rounded-full bg-slate-200 animate-pulse" />
              <div className="h-4 w-48 rounded-full bg-slate-100 animate-pulse" style={{ animationDelay: "80ms" }} />
            </div>
          ) : (
            <div className="flex flex-col gap-1 animate-fade-in">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                  status === 'draft' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                  status === 'submitted' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                  status === 'approved' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                  'bg-rose-100 text-rose-600 border-rose-200'
                }`}>
                  {status}
                </span>
              </div>
              {application?.client_name && (
                <p className="text-slate-500 text-sm font-medium">
                  Client: {application.client_name} • {application.city}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          {!loading && isEmployee && status === 'draft' && (
            <button
              onClick={submitForApproval}
              disabled={submitting || expenses.length === 0}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-95 animate-fade-in"
            >
              {submitting ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
              Submit for Approval
            </button>
          )}
          {!loading && status === 'submitted' && isEmployee && (
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 animate-fade-in">
              <Clock size={18} /> Awaiting Admin Approval
            </div>
          )}
          {!loading && status === 'approved' && (
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 animate-fade-in">
              <CheckCircle2 size={18} /> Approved
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <FilterBar
            filters={filters}
            categories={categories}
            onChange={setFilters}
            onClear={() => setFilters({ from: "", to: "", category: "all" })}
            total={expenses.length}
            loading={loading}
          />

          <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-4 custom-scrollbar">
            {loading ? (
              <div
                className="flex flex-col gap-4 transition-opacity duration-300 ease-in-out"
                style={{ opacity: fadeOut ? 0 : 1 }}
              >
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-3xl bg-white border border-slate-100 shadow-sm overflow-hidden"
                    style={{ opacity: 1 - i * 0.15 }}
                  >
                    {/* Card skeleton mimics ExpenseCard layout */}
                    <div className="p-5 flex items-center gap-5">
                      {/* Icon placeholder */}
                      <div
                        className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse shrink-0"
                        style={{ animationDelay: `${i * 60}ms`, animationDuration: "1.6s" }}
                      />
                      <div className="flex-1 flex flex-col gap-2">
                        <div
                          className="h-3.5 rounded-full bg-slate-200 animate-pulse"
                          style={{ width: "40%", animationDelay: `${i * 60 + 40}ms`, animationDuration: "1.6s" }}
                        />
                        <div
                          className="h-3 rounded-full bg-slate-100 animate-pulse"
                          style={{ width: "60%", animationDelay: `${i * 60 + 80}ms`, animationDuration: "1.6s" }}
                        />
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div
                          className="h-4 w-20 rounded-full bg-slate-200 animate-pulse"
                          style={{ animationDelay: `${i * 60 + 120}ms`, animationDuration: "1.6s" }}
                        />
                        <div
                          className="h-3 w-14 rounded-full bg-slate-100 animate-pulse"
                          style={{ animationDelay: `${i * 60 + 160}ms`, animationDuration: "1.6s" }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : expenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-70 animate-fade-in">
                <Clock size={48} className="mb-4" />
                <p className="typo-body-default font-semibold text-slate-600">No expenses found for this report.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 animate-fade-in">
                {expenses.map((expense) => (
                  <div key={expense.id} className="relative group">
                    <ExpenseCard
                      record={expense}
                      selected={selectedRecord?.id === expense.id}
                      onClick={() => setSelectedRecord(expense)}
                    />
                    {expense.verified && (
                      <div className="absolute top-1/2 -translate-y-1/2 right-6">
                        <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl flex items-center gap-2 font-semibold border border-emerald-100">
                          <CheckCircle2 size={14} /> Verified
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="h-12 shrink-0" />
          </div>
        </div>

        {/* Audit Agent Chatbot */}
        <AuditAgent
          selectedRecord={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          application={application}
          expenses={expenses}
          onSubmitForApproval={submitForApproval}
        />
      </div>
    </div>
  );
}