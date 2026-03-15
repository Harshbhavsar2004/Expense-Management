"use client";

import { useEffect, useState, useMemo } from "react";
import { ExpenseCard } from "@/components/ExpenseCard";
import { ExpenseRow } from "@/components/ExpensesTable";
import { FilterBar, Filters } from "@/components/FilterBar";

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ from: "", to: "", category: "all" });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.category && filters.category !== "all") params.append("category", filters.category);
      const res = await fetch(`/api/expenses/all?${params}`);
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(); }, [filters]);

  const categories = useMemo(() => {
    const cats = new Set(expenses.map((e) => e.expense_type).filter(Boolean));
    return Array.from(cats) as string[];
  }, [expenses]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "24px 32px 0" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'DM Sans', sans-serif" }}>
          All Expenses
        </h2>
        <p style={{ margin: "0 0 16px", fontSize: "14px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
          Complete view of all employee expense submissions
        </p>
      </div>

      <FilterBar
        filters={filters}
        categories={categories}
        onChange={setFilters}
        onClear={() => setFilters({ from: "", to: "", category: "all" })}
        total={expenses.length}
        loading={loading}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 32px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading
          ? [1, 2, 3, 4].map((i) => <div key={i} className="shimmer" style={{ height: "88px", borderRadius: "10px" }} />)
          : expenses.map((e) => <ExpenseCard key={e.id} record={e} />)
        }
      </div>
    </div>
  );
}
