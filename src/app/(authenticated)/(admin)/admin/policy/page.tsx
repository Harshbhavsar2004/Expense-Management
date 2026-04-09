"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Car, Hotel, Receipt,
  FileText, Save, CheckCircle2, AlertCircle, Loader2,
  ShieldCheck, Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

/* ── Toggle ── */
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "relative w-11 h-6 rounded-full transition-colors duration-200",
        value ? "bg-zinc-900" : "bg-zinc-200"
      )}
    >
      <motion.span
        animate={{ x: value ? 22 : 3 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
      />
    </button>
  );
}

/* ── Amount Input ── */
function AmountInput({ value, onChange, disabled }: {
  value: number | null; onChange: (v: number | null) => void; disabled?: boolean;
}) {
  return (
    <div className="relative w-32">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm pointer-events-none">₹</span>
      <input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
        placeholder="No cap"
        className={cn(
          "w-full pl-7 pr-3 py-2 rounded-lg border text-sm font-medium text-right outline-none transition-all",
          disabled
            ? "bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed"
            : "bg-white border-zinc-200 focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 text-zinc-900"
        )}
      />
    </div>
  );
}

/* ── Row ── */
function SettingRow({ label, description, children }: {
  label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-4 gap-4">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-zinc-900">{label}</p>
        {description && <p className="text-[12px] text-zinc-400 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

/* ── Main ── */
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
      setToast({ type: "success", msg: "Policy saved successfully." });
    } catch (e: any) {
      setToast({ type: "error", msg: e.message });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-[#FAFAFA]">

      {/* ── Header ── */}
      <div className="w-full border-b border-zinc-200 bg-white px-6 lg:px-10 py-6 flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-zinc-900 tracking-[-0.02em]">Policy</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Global spending rules & compliance settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all",
            saving
              ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
              : "bg-zinc-900 text-white hover:bg-zinc-800 active:scale-[0.98]"
          )}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="w-full px-6 lg:px-10 pt-4"
          >
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium",
              toast.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
            )}>
              {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Content ── */}
      <div className="w-full px-6 lg:px-10 py-8 space-y-6">

        {/* Meal Allowances */}
        <Section icon={UtensilsCrossed} title="Meal Allowances" description="Daily limits by city tier">
          <SettingRow label="Tier I — Metro cities" description="Mumbai, Delhi, Bangalore, Hyderabad">
            <AmountInput value={form.meal_tier1_limit} onChange={v => set("meal_tier1_limit", v ?? 0)} />
          </SettingRow>
          <Divider />
          <SettingRow label="Tier II — Urban hubs" description="Pune, Jaipur, Ahmedabad, Lucknow">
            <AmountInput value={form.meal_tier2_limit} onChange={v => set("meal_tier2_limit", v ?? 0)} />
          </SettingRow>
          <Divider />
          <SettingRow label="Tier III — Standard locations" description="Other cities and suburban areas">
            <AmountInput value={form.meal_tier3_limit} onChange={v => set("meal_tier3_limit", v ?? 0)} />
          </SettingRow>
        </Section>

        {/* Travel & Hotel side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Section icon={Car} title="Travel" description="Transit & commute rules">
            <SettingRow label="Allow travel claims">
              <Toggle value={form.travel_allowed} onChange={v => set("travel_allowed", v)} />
            </SettingRow>
            <Divider />
            <SettingRow label="Daily limit" description={!form.travel_allowed ? "Enable travel first" : undefined}>
              <AmountInput
                value={form.travel_daily_limit}
                onChange={v => set("travel_daily_limit", v)}
                disabled={!form.travel_allowed}
              />
            </SettingRow>
          </Section>

          <Section icon={Hotel} title="Accommodation" description="Hotel & stay policies">
            <SettingRow label="Allow hotel claims">
              <Toggle value={form.hotel_allowed} onChange={v => set("hotel_allowed", v)} />
            </SettingRow>
            <Divider />
            <SettingRow label="Daily limit" description={!form.hotel_allowed ? "Enable hotels first" : undefined}>
              <AmountInput
                value={form.hotel_daily_limit}
                onChange={v => set("hotel_daily_limit", v)}
                disabled={!form.hotel_allowed}
              />
            </SettingRow>
          </Section>
        </div>

        {/* Compliance */}
        <Section icon={ShieldCheck} title="Compliance" description="Audit & verification settings">
          <SettingRow label="Require receipt for all claims" description="Employees must attach proof of expense">
            <Toggle value={form.requires_receipt} onChange={v => set("requires_receipt", v)} />
          </SettingRow>
          <Divider />
          <SettingRow label="Reimbursement cycle" description="Processing window for payouts">
            <input
              type="text"
              value={form.reimbursement_cycle}
              onChange={e => set("reimbursement_cycle", e.target.value)}
              className="w-40 px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 text-right"
              placeholder="e.g. 15-25 of month"
            />
          </SettingRow>
        </Section>
      </div>
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ icon: Icon, title, description, children }: {
  icon: any; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-zinc-200 overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center">
          <Icon size={16} className="text-zinc-500" />
        </div>
        <div>
          <h3 className="text-[14px] font-semibold text-zinc-900">{title}</h3>
          <p className="text-[12px] text-zinc-400">{description}</p>
        </div>
      </div>
      <div className="px-6">{children}</div>
    </motion.div>
  );
}

function Divider() {
  return <div className="h-px bg-zinc-100" />;
}