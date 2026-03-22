"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Car, Hotel, Receipt, Calendar,
  FileText, Save, Users, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type GlobalPolicy = {
  meal_tier1_limit: number;
  meal_tier2_limit: number;
  meal_tier3_limit: number;
  travel_allowed: boolean;
  travel_daily_limit: number | null;
  hotel_allowed: boolean;
  hotel_daily_limit: number | null;
  requires_receipt: boolean;
  reimbursement_cycle: string;
  custom_notes: string | null;
};

// ── small reusable pieces ──────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100 bg-zinc-50/60">
        <div className="p-2 bg-white border border-zinc-200 rounded-lg text-zinc-500 shadow-sm">{icon}</div>
        <h3 className="text-[13px] font-bold text-zinc-800 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function FieldRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div>
        <p className="text-[13px] font-semibold text-zinc-800">{label}</p>
        {sub && <p className="text-[11px] text-zinc-400 mt-0.5">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function NumberInput({ value, onChange, disabled }: { value: number | null; onChange: (v: number | null) => void; disabled?: boolean }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-[13px] font-semibold">₹</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
        placeholder="No cap"
        className={cn(
          "w-36 pl-7 pr-3 py-2.5 rounded-xl border text-[13px] font-semibold text-zinc-900 outline-none transition-all",
          disabled
            ? "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed"
            : "bg-white border-zinc-200 hover:border-zinc-300 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        )}
      />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-all duration-200",
        value ? "bg-indigo-600" : "bg-zinc-200"
      )}
    >
      <span className={cn(
        "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200",
        value ? "left-5" : "left-0.5"
      )} />
    </button>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function AdminPolicyPage() {
  const [form, setForm] = useState<GlobalPolicy>({
    meal_tier1_limit: 900,
    meal_tier2_limit: 700,
    meal_tier3_limit: 450,
    travel_allowed: true,
    travel_daily_limit: null,
    hotel_allowed: true,
    hotel_daily_limit: null,
    requires_receipt: true,
    reimbursement_cycle: "15-25 of month",
    custom_notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/policy/global")
      .then(r => r.json())
      .then(d => setForm(f => ({ ...f, ...d, custom_notes: d.custom_notes || "" })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof GlobalPolicy>(key: K, val: GlobalPolicy[K]) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      const res = await fetch("/api/admin/policy/global", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setToast({ type: "success", msg: "Policy saved and applied to all employees." });
    } catch (e: any) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-40 rounded-2xl bg-zinc-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-[0.2em] mb-1">Admin</p>
          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Global Expense Policy</h1>
          <p className="text-zinc-500 text-[14px] mt-1">
            Set the default policy applied to every employee.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
          <Users size={15} className="text-indigo-500" />
          <span className="text-[12px] font-bold text-indigo-700">Applies to all employees</span>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          "flex items-center gap-3 px-5 py-3.5 rounded-xl mb-6 border text-[13px] font-semibold",
          toast.type === "success"
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-red-50 border-red-200 text-red-700"
        )}>
          {toast.type === "success"
            ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
            : <AlertCircle size={16} className="text-red-500 shrink-0" />
          }
          {toast.msg}
        </div>
      )}

      <div className="space-y-5">

        {/* Meal Limits */}
        <SectionCard title="Meal Allowances" icon={<UtensilsCrossed size={16} />}>
          <FieldRow label="Tier I Cities" sub="Metro — Mumbai, Delhi, Bangalore, etc.">
            <NumberInput value={form.meal_tier1_limit} onChange={v => set("meal_tier1_limit", v ?? 0)} />
          </FieldRow>
          <div className="h-px bg-zinc-100" />
          <FieldRow label="Tier II Cities" sub="Pune, Ahmedabad, Jaipur, etc.">
            <NumberInput value={form.meal_tier2_limit} onChange={v => set("meal_tier2_limit", v ?? 0)} />
          </FieldRow>
          <div className="h-px bg-zinc-100" />
          <FieldRow label="Tier III Cities" sub="All other locations">
            <NumberInput value={form.meal_tier3_limit} onChange={v => set("meal_tier3_limit", v ?? 0)} />
          </FieldRow>
        </SectionCard>

        {/* Travel */}
        <SectionCard title="Travel" icon={<Car size={16} />}>
          <FieldRow label="Allow Travel Expenses" sub="Employees can claim travel costs">
            <Toggle value={form.travel_allowed} onChange={v => set("travel_allowed", v)} />
          </FieldRow>
          <div className="h-px bg-zinc-100" />
          <FieldRow label="Daily Travel Limit" sub="Leave blank for no cap">
            <NumberInput
              value={form.travel_daily_limit}
              onChange={v => set("travel_daily_limit", v)}
              disabled={!form.travel_allowed}
            />
          </FieldRow>
        </SectionCard>

        {/* Hotel */}
        <SectionCard title="Accommodation" icon={<Hotel size={16} />}>
          <FieldRow label="Allow Hotel Expenses" sub="Employees can claim accommodation">
            <Toggle value={form.hotel_allowed} onChange={v => set("hotel_allowed", v)} />
          </FieldRow>
          <div className="h-px bg-zinc-100" />
          <FieldRow label="Hotel Daily Limit" sub="Leave blank for no cap">
            <NumberInput
              value={form.hotel_daily_limit}
              onChange={v => set("hotel_daily_limit", v)}
              disabled={!form.hotel_allowed}
            />
          </FieldRow>
        </SectionCard>

        {/* General */}
        <SectionCard title="General Rules" icon={<Receipt size={16} />}>
          <FieldRow label="Require Receipt" sub="Original receipt mandatory for every claim">
            <Toggle value={form.requires_receipt} onChange={v => set("requires_receipt", v)} />
          </FieldRow>
          <div className="h-px bg-zinc-100" />
          <FieldRow label="Reimbursement Cycle" sub="When payments are processed">
            <input
              type="text"
              value={form.reimbursement_cycle}
              onChange={e => set("reimbursement_cycle", e.target.value)}
              className="w-44 px-3 py-2.5 rounded-xl border border-zinc-200 text-[13px] font-semibold text-zinc-900 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white hover:border-zinc-300 transition-all"
              placeholder="e.g. 15-25 of month"
            />
          </FieldRow>
        </SectionCard>

        {/* Notes */}
        <SectionCard title="Admin Notes" icon={<FileText size={16} />}>
          <textarea
            rows={4}
            value={form.custom_notes ?? ""}
            onChange={e => set("custom_notes", e.target.value)}
            placeholder="Optional freeform notes visible to all employees on their Policy page..."
            className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-[13px] text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none bg-white hover:border-zinc-300 transition-all leading-relaxed placeholder:text-zinc-300"
          />
        </SectionCard>

      </div>

      {/* Save bar */}
      <div className="sticky bottom-6 mt-8">
        <div className="flex items-center justify-between px-6 py-4 bg-white border border-zinc-200 rounded-2xl shadow-xl shadow-zinc-200/60">
          <div>
            <p className="text-[13px] font-bold text-zinc-800">Save & Apply to All Employees</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">This will update the base policy for every user.</p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[13px] font-bold rounded-xl transition-all active:scale-95 disabled:opacity-60 shadow-lg shadow-indigo-500/25"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving…" : "Save Policy"}
          </button>
        </div>
      </div>

    </div>
  );
}
