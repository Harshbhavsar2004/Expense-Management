"use client";

import { useEffect, useState, useMemo } from "react";
import { FilterBar, Filters } from "@/components/FilterBar";
import { ExpenseCard } from "@/components/ExpenseCard";
import { ExpenseRow } from "@/components/ExpensesTable";
import { AuditAgent } from "@/components/AuditAgent";
import { useCopilotAction } from "@copilotkit/react-core";
import { CircularLoader } from "@/components/CircularLoader";

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState<ExpenseRow | null>(null);
  const [filters, setFilters] = useState<Filters>({
    from: "",
    to: "",
    category: "all",
  });

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      if (filters.category && filters.category !== "all") params.append("category", filters.category);

      const res = await fetch(`/api/expenses/all?${params.toString()}`);
      const data = await res.json();
      setExpenses(data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- COPILOT TOOLS ---
  useCopilotAction({
    name: "refreshExpenses",
    description: "Refreshes the list of all expense claims from the record dashboard.",
    handler: async () => {
      await fetchExpenses();
    },
  });

  useCopilotAction({
    name: "setExpenseFilter",
    description: "Filters the expense list based on category or date range.",
    parameters: [
      { name: "category", type: "string", description: "The category to filter by (e.g. 'Travel Expenses', 'Meals')", required: false },
      { name: "from", type: "string", description: "Start date (YYYY-MM-DD)", required: false },
      { name: "to", type: "string", description: "End date (YYYY-MM-DD)", required: false },
    ],
    handler: async ({ category, from, to }) => {
       setFilters(prev => ({
         category: category || prev.category,
         from: from || prev.from,
         to: to || prev.to
       }));
    },
  });

  useCopilotAction({
    name: "clearAllFilters",
    description: "Resets all filters to show every expense record.",
    handler: async () => {
      setFilters({ from: "", to: "", category: "all" });
    },
  });

  useEffect(() => {
    fetchExpenses();
  }, [filters]);

  const categories = useMemo(() => {
    if (!Array.isArray(expenses)) return [];
    const cats = new Set(expenses.map(e => e.expense_type).filter(Boolean));
    return Array.from(cats) as string[];
  }, [expenses]);

  return (
    <div style={{ height: "100%", display: "flex" }}>
       <div style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column" }}>
          <FilterBar 
            filters={filters} 
            categories={categories} 
            onChange={setFilters} 
            onClear={() => setFilters({ from: "", to: "", category: "all" })}
            total={expenses.length}
            loading={loading}
          />
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {loading ? (
              <CircularLoader message="Loading your expense records..." />
            ) : (
              Array.isArray(expenses) && expenses.map(e => (
                <ExpenseCard 
                  key={e.id} 
                  record={e} 
                  selected={selectedRecord?.id === e.id}
                  onClick={() => setSelectedRecord(e)} 
                />
              ))
            )}
          </div>
       </div>

       {/* Audit Agent Drawer (Right Side) */}
       <AuditAgent selectedRecord={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </div>
  );
}
