"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Car, Hotel, Receipt,
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2",
        value
          ? "bg-indigo-600 focus:ring-indigo-500"
          : "bg-zinc-200 focus:ring-zinc-400"
      )}
    >
      <span className={cn(
        "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300",
        value ? "left-[26px]" : "left-0.5"
      )} />
    </button>
  );
}

function AmountInput({
  value, onChange, disabled,
}: {
  value: number | null; onChange: (v: number | null) => void; disabled?: boolean;
}) {
  return (
    <div className="relative w-40">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium pointer-events-none">₹</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
        placeholder="No cap"
        className={cn(
          "w-full pl-8 pr-3 py-2 rounded-lg border text-sm font-semibold text-right outline-none transition-all",
          disabled
            ? "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed"
            : "bg-white border-zinc-200 hover:border-indigo-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-zinc-800"
        )}
      />
    </div>
  );
}

type TierRowProps = {
  tier: string;
  cities: string;
  value: number;
  onChange: (v: number) => void;
  accent: string;
};

function TierRow({ tier, cities, value, onChange, accent }: TierRowProps) {
  return (
    <div className="flex items-center gap-4 py-4 border-b border-zinc-100 last:border-0">
      <div className={cn("w-2 h-10 rounded-full shrink-0", accent)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-800">{tier}</p>
        <p className="text-xs text-zinc-400 truncate">{cities}</p>
      </div>
      <AmountInput value={value} onChange={v => onChange(v ?? 0)} />
    </div>
  );
}

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
      <div className="min-h-screen bg-zinc-50 p-6 lg:p-10">
        <div className="max-w-5xl mx-auto space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-zinc-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/80">
      <div className="max-w-5xl mx-auto px-6 lg:px-10 py-8 lg:py-10">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Admin · Policy</p>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-zinc-900 tracking-tight">
              Global Expense Policy
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Default rules applied to every employee across all teams.
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl self-start sm:self-auto">
            <Users size={14} className="text-indigo-500 shrink-0" />
            <span className="text-xs font-bold text-indigo-700 whitespace-nowrap">Applies to all employees</span>
          </div>
        </div>

        {/* ── Toast ── */}
        {toast && (
          <div className={cn(
            "flex items-center gap-3 px-5 py-3.5 rounded-xl mb-6 border text-sm font-semibold",
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          )}>
            {toast.type === "success"
              ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              : <AlertCircle size={16} className="text-red-500 shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* ── Two-column grid on large screens ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT COLUMN — spans 2 cols */}
          <div className="lg:col-span-2 space-y-5">

            {/* Meal Allowances */}
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
                <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg">
                  <UtensilsCrossed size={15} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-800">Meal Allowances</h3>
                  <p className="text-xs text-zinc-400">Daily per-person limit by city tier</p>
                </div>
              </div>
              <div className="px-6 pb-2">
                <TierRow
                  tier="Tier I — Metro Cities"
                  cities="Mumbai, Delhi, Bengaluru, Chennai, Hyderabad, Kolkata"
                  value={form.meal_tier1_limit}
                  onChange={v => set("meal_tier1_limit", v)}
                  accent="bg-indigo-500"
                />
                <TierRow
                  tier="Tier II — Major Cities"
                  cities="Pune, Ahmedabad, Jaipur, Surat, Lucknow, Chandigarh…"
                  value={form.meal_tier2_limit}
                  onChange={v => set("meal_tier2_limit", v)}
                  accent="bg-violet-400"
                />
                <TierRow
                  tier="Tier III — All Other Locations"
                  cities="Smaller towns, rural areas, and unclassified cities"
                  value={form.meal_tier3_limit}
                  onChange={v => set("meal_tier3_limit", v)}
                  accent="bg-zinc-300"
                />
              </div>
            </div>

            {/* Travel + Hotel — side by side on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Travel */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
                  <div className="p-2 bg-blue-50 border border-blue-100 rounded-lg">
                    <Car size={15} className="text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">Travel</h3>
                    <p className="text-xs text-zinc-400">Transport & commute expenses</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-700">Allow Travel Claims</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Employees can file transport expenses</p>
                    </div>
                    <Toggle value={form.travel_allowed} onChange={v => set("travel_allowed", v)} />
                  </div>
                  <div className="h-px bg-zinc-100" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={cn("text-sm font-semibold", !form.travel_allowed ? "text-zinc-300" : "text-zinc-700")}>
                        Daily Limit
                      </p>
                      <p className={cn("text-xs mt-0.5", !form.travel_allowed ? "text-zinc-200" : "text-zinc-400")}>
                        Blank = no cap
                      </p>
                    </div>
                    <AmountInput
                      value={form.travel_daily_limit}
                      onChange={v => set("travel_daily_limit", v)}
                      disabled={!form.travel_allowed}
                    />
                  </div>
                </div>
              </div>

              {/* Hotel */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
                  <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                    <Hotel size={15} className="text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-800">Accommodation</h3>
                    <p className="text-xs text-zinc-400">Hotel & lodging expenses</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-700">Allow Hotel Claims</p>
                      <p className="text-xs text-zinc-400 mt-0.5">Employees can file accommodation expenses</p>
                    </div>
                    <Toggle value={form.hotel_allowed} onChange={v => set("hotel_allowed", v)} />
                  </div>
                  <div className="h-px bg-zinc-100" />
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={cn("text-sm font-semibold", !form.hotel_allowed ? "text-zinc-300" : "text-zinc-700")}>
                        Daily Limit
                      </p>
                      <p className={cn("text-xs mt-0.5", !form.hotel_allowed ? "text-zinc-200" : "text-zinc-400")}>
                        Blank = no cap
                      </p>
                    </div>
                    <AmountInput
                      value={form.hotel_daily_limit}
                      onChange={v => set("hotel_daily_limit", v)}
                      disabled={!form.hotel_allowed}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Admin Notes */}
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
                <div className="p-2 bg-zinc-100 border border-zinc-200 rounded-lg">
                  <FileText size={15} className="text-zinc-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-800">Admin Notes</h3>
                  <p className="text-xs text-zinc-400">Visible to all employees on their Policy page</p>
                </div>
              </div>
              <div className="px-6 py-5">
                <textarea
                  rows={4}
                  value={form.custom_notes ?? ""}
                  onChange={e => set("custom_notes", e.target.value)}
                  placeholder="Add any freeform guidance, reminders, or policy notes here…"
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none bg-zinc-50/50 hover:border-zinc-300 transition-all leading-relaxed placeholder:text-zinc-300"
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-5">

            {/* General Rules */}
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-100">
                <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg">
                  <Receipt size={15} className="text-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-800">General Rules</h3>
                  <p className="text-xs text-zinc-400">Compliance & process settings</p>
                </div>
              </div>
              <div className="px-5 py-4 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-700">Require Receipt</p>
                    <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      Original receipt mandatory for every claim
                    </p>
                  </div>
                  <Toggle value={form.requires_receipt} onChange={v => set("requires_receipt", v)} />
                </div>
                <div className="h-px bg-zinc-100" />
                <div>
                  <p className="text-sm font-semibold text-zinc-700 mb-2">Reimbursement Cycle</p>
                  <input
                    type="text"
                    value={form.reimbursement_cycle}
                    onChange={e => set("reimbursement_cycle", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-sm font-semibold text-zinc-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-zinc-50/50 hover:border-zinc-300 transition-all"
                    placeholder="e.g. 15–25 of month"
                  />
                  <p className="text-xs text-zinc-400 mt-1.5">When payments are processed each month</p>
                </div>
              </div>
            </div>

            {/* Quick Summary */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-indigo-100">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-widest">Policy Summary</p>
              </div>
              <div className="px-5 py-4 space-y-3">
                {[
                  { label: "Tier I Meals", value: `₹${form.meal_tier1_limit}/day` },
                  { label: "Tier II Meals", value: `₹${form.meal_tier2_limit}/day` },
                  { label: "Tier III Meals", value: `₹${form.meal_tier3_limit}/day` },
                  {
                    label: "Travel",
                    value: form.travel_allowed
                      ? form.travel_daily_limit ? `₹${form.travel_daily_limit}/day` : "Allowed (no cap)"
                      : "Not allowed",
                  },
                  {
                    label: "Hotel",
                    value: form.hotel_allowed
                      ? form.hotel_daily_limit ? `₹${form.hotel_daily_limit}/day` : "Allowed (no cap)"
                      : "Not allowed",
                  },
                  { label: "Receipt", value: form.requires_receipt ? "Required" : "Optional" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-indigo-500 font-medium">{item.label}</span>
                    <span className="text-xs font-bold text-indigo-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm p-5">
              <p className="text-sm font-bold text-zinc-800 mb-1">Save & Apply</p>
              <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
                Updates the base policy for every user immediately.
              </p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.98] disabled:opacity-60 shadow-lg shadow-indigo-500/20"
              >
                {saving
                  ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
                  : <><Save size={15} /> Save Policy</>
                }
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}