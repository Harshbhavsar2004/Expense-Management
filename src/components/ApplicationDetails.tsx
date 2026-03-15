"use client";

import { useState, useEffect } from "react";
import { X, ReceiptText, ShieldCheck, AlertCircle, RefreshCw, Clock } from "lucide-react";
import { ExpenseCard } from "./ExpenseCard";

interface ExpenseRow {
  id: string;
  created_at: string;
  expense_type: string;
  claimed_amount: string;
  claimed_amount_numeric: number;
  verified: boolean;
  audit_explanation: string;
  merchant: string;
}

interface ApplicationDetailsProps {
  applicationId: string;
  onClose: () => void;
}

export function ApplicationDetails({ applicationId, onClose }: ApplicationDetailsProps) {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditingIds, setAuditingIds] = useState<Set<string>>(new Set());

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/by-application/${applicationId}`);
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) fetchExpenses();
  }, [applicationId]);

  const runAudit = async (expenseId: string) => {
    setAuditingIds(prev => new Set(prev).add(expenseId));
    try {
      const res = await fetch(`/api/audit/expense/${expenseId}`, { method: "POST" });
      if (res.ok) {
        // Refresh local state for this expense
        await fetchExpenses();
      }
    } catch (err) {
      console.error("Audit error:", err);
    } finally {
      setAuditingIds(prev => {
        const next = new Set(prev);
        next.delete(expenseId);
        return next;
      });
    }
  };

  const runBulkAudit = async () => {
    const unverified = expenses.filter(e => !e.verified);
    for (const exp of unverified) {
      await runAudit(exp.id);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-[500px] premium-card m-4 border-l border-white/10 z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="typo-overline text-blue-400!">Detail View</span>
            <span className="text-gray-600">•</span>
            <span className="typo-label font-bold! text-gray-500!">{applicationId}</span>
          </div>
          <h2 className="typo-h3 text-white!">Expenses Submissions</h2>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="shimmer h-32 w-full" />)
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 opacity-50">
            <ReceiptText size={48} className="mb-4" />
            <p className="typo-body-default font-semibold!">No expenses found for this application.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
               <h3 className="typo-overline text-gray-400! tracking-tighter!">Items Found ({expenses.length})</h3>
               <button 
                onClick={runBulkAudit}
                className="btn-accent px-4 py-2 rounded-full flex items-center gap-2 typo-button shadow-xl shadow-blue-500/10"
               >
                 <ShieldCheck size={14} /> Run Bulk Audit
               </button>
            </div>

            <div className="flex flex-col gap-4">
              {expenses.map((expense) => (
                <div key={expense.id} className="relative group">
                  <ExpenseCard record={expense as any} />
                  
                  <div className="absolute top-4 right-4 flex gap-2">
                    {!expense.verified ? (
                      <button 
                        disabled={auditingIds.has(expense.id)}
                        onClick={(e) => { e.stopPropagation(); runAudit(expense.id); }}
                        className="bg-warning/20 text-warning hover:bg-warning/30 px-3 py-1.5 rounded-lg flex items-center gap-2 typo-button transition-all"
                      >
                        {auditingIds.has(expense.id) ? <RefreshCw size={12} className="animate-spin" /> : <Clock size={12} />}
                        {auditingIds.has(expense.id) ? "Auditing..." : "Run Audit"}
                      </button>
                    ) : (
                      <div className="bg-success/20 text-success px-3 py-1.5 rounded-lg flex items-center gap-2 typo-button">
                        <ShieldCheck size={12} /> Verified
                      </div>
                    )}
                  </div>

                  {expense.audit_explanation && (
                    <div className="mt-2 p-3 bg-white/5 rounded-xl typo-body-small text-gray-400! italic border-l-2 border-blue-500/30">
                       "{expense.audit_explanation}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
