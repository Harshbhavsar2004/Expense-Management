"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Hotel, PlaneTakeoff,
  ShieldCheck, CheckCircle, XCircle,
  Clock, Calendar, FileBadge,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Policy = {
  has_active_override: boolean;
  override_valid_from: string | null;
  override_valid_until: string | null;
  override_reason: string | null;
  effective_meal_tier1_limit: number;
  effective_meal_tier2_limit: number;
  effective_meal_tier3_limit: number;
  effective_travel_daily_limit: number | null;
  effective_hotel_daily_limit: number | null;
  base_meal_tier1_limit: number;
  base_meal_tier2_limit: number;
  base_meal_tier3_limit: number;
  base_travel_daily_limit: number | null;
  base_hotel_daily_limit: number | null;
  travel_allowed: boolean;
  hotel_allowed: boolean;
  requires_receipt: boolean;
  reimbursement_cycle: string;
  custom_notes: string | null;
};

const TABS = ["Permanent Policy", "Temporary Override"] as const;
type Tab = (typeof TABS)[number];

function fmt(val: number | null) {
  if (val == null) return "No Limit";
  return `₹${val.toLocaleString("en-IN")}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PolicyPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("Permanent Policy");

  useEffect(() => {
    fetch("/api/user/policy")
      .then((r) => r.json())
      .then(setPolicy)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-7 w-full space-y-4">
        <div className="h-12 rounded-xl bg-slate-100 animate-pulse w-64" />
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-slate-100 animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
          ))}
        </div>
      </div>
    );
  }

  if (!policy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <ShieldCheck size={24} className="text-slate-300" />
        </div>
        <h2 className="font-semibold text-lg text-slate-700 mb-1">No Policy Assigned</h2>
        <p className="text-sm text-slate-400 max-w-xs">
          No expense policy has been assigned to your profile yet. Contact your admin.
        </p>
      </div>
    );
  }

  const isOverrideActive = policy.has_active_override;
  const isViewingOverride = tab === "Temporary Override" && isOverrideActive;

  const mealT1 = isViewingOverride ? policy.effective_meal_tier1_limit : policy.base_meal_tier1_limit;
  const mealT2 = isViewingOverride ? policy.effective_meal_tier2_limit : policy.base_meal_tier2_limit;
  const mealT3 = isViewingOverride ? policy.effective_meal_tier3_limit : policy.base_meal_tier3_limit;
  const travelLimit = isViewingOverride ? policy.effective_travel_daily_limit : policy.base_travel_daily_limit;
  const hotelLimit = isViewingOverride ? policy.effective_hotel_daily_limit : policy.base_hotel_daily_limit;

  const mealTiers = [
    { label: "Tier I — Metropolitan", sub: "", amount: mealT1 },
    { label: "Tier II — Major Cities", sub: "", amount: mealT2 },
    { label: "Tier III — Other", sub: "", amount: mealT3 },
  ];

  return (
    <div className="w-full p-7 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {TABS.map((t) => (
            <button
              key={t}
              disabled={t === "Temporary Override" && !isOverrideActive}
              onClick={() => setTab(t)}
              className={cn(
                "text-[13px] font-semibold px-4 py-1.5 rounded-md transition-all duration-150",
                tab === t
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
                t === "Temporary Override" && !isOverrideActive && "opacity-30 cursor-not-allowed pointer-events-none"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Override Banner */}
      {isOverrideActive && (
        <div className="mb-5 bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
            <Clock size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[13px] font-bold text-blue-700">Temporary Override Active</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
            <p className="text-xs text-blue-600">
              Valid <strong>{fmtDate(policy.override_valid_from)}</strong> — <strong>{fmtDate(policy.override_valid_until)}</strong>
              {policy.override_reason && <span className="ml-1 opacity-80">· {policy.override_reason}</span>}
            </p>
          </div>
        </div>
      )}

      {/* Meal Allowances — Table style */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
        <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
              <UtensilsCrossed size={16} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Meal Allowances</h2>
              <p className="text-xs text-slate-400">Daily limits by city tier</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {mealTiers.map((tier, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between sm:flex-col sm:items-start sm:justify-start gap-2">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                  {tier.label}
                </span>
                <span className="text-xs text-slate-400 mt-0.5 block">{tier.sub}</span>
              </div>
              <span className="text-xl font-bold text-slate-900 font-mono sm:mt-2">
                {fmt(tier.amount)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Travel & Hotel — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

        {/* Travel */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <PlaneTakeoff size={16} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Travel</h3>
                <p className="text-xs text-slate-400">Corporate & field transit</p>
              </div>
            </div>
            {policy.travel_allowed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle size={10} /> Allowed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-500 border border-rose-100">
                <XCircle size={10} /> Not Allowed
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
              <span className="text-base font-bold text-slate-900">{policy.travel_allowed ? "Active" : "Disabled"}</span>
            </div>
            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Daily Limit</span>
              <span className="text-base font-bold text-blue-600 font-mono">{fmt(travelLimit)}</span>
            </div>
          </div>
        </div>

        {/* Hotel */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
                <Hotel size={16} />
              </div>
              <div>
                <h3 className="text-[15px] font-bold text-slate-900">Hotel Stays</h3>
                <p className="text-xs text-slate-400">Lodging & accommodation</p>
              </div>
            </div>
            {policy.hotel_allowed ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100">
                <CheckCircle size={10} /> Allowed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-500 border border-rose-100">
                <XCircle size={10} /> Not Allowed
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Status</span>
              <span className="text-base font-bold text-slate-900">{policy.hotel_allowed ? "Active" : "Disabled"}</span>
            </div>
            <div className="px-5 py-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Nightly Cap</span>
              <span className="text-base font-bold text-blue-600 font-mono">{fmt(hotelLimit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* General Rules */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3 border-b border-slate-100">
          <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
            <FileBadge size={16} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">General Rules</h3>
            <p className="text-xs text-slate-400">Receipt & reimbursement policies</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          <div className="px-5 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Receipt Required</span>
            <span className="text-base font-bold text-slate-900">{policy.requires_receipt ? "Yes" : "No"}</span>
          </div>
          <div className="px-5 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Reimbursement Cycle</span>
            <span className="text-base font-bold text-slate-900 capitalize">{policy.reimbursement_cycle || "—"}</span>
          </div>
          <div className="px-5 py-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">Notes</span>
            <span className="text-sm text-slate-600">{policy.custom_notes || "No additional notes"}</span>
          </div>
        </div>
      </div>

    </div>
  );
}