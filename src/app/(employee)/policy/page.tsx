"use client";

import { useEffect, useState } from "react";
import {
  UtensilsCrossed, Hotel, PlaneTakeoff, Calendar,
  ShieldCheck, FileBadge, CheckCircle, XCircle,
  Clock, Info, ArrowRight, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-body text-xs font-semibold uppercase tracking-widest text-slate-400 block mb-1">
      {children}
    </span>
  );
}

function MealTierCard({
  tier, label, cities, amount, highlight,
}: {
  tier: string; label: string; cities: string[]; amount: string; highlight?: boolean;
}) {
  return (
    <div className={cn(
      "bg-white rounded-2xl p-5 border transition-all duration-200 hover:-translate-y-0.5",
      highlight
        ? "border-l-4 border-violet-400 shadow-sm shadow-violet-100/60"
        : "border-slate-100 shadow-sm",
    )}>
      <SectionLabel>{tier}</SectionLabel>
      <div className="font-display font-extrabold text-2xl text-slate-800 mt-1">{amount}</div>
      <div className="font-body text-xs font-medium text-slate-400 mb-4">{label}</div>
      <div className="flex flex-col gap-1.5">
        {cities.map((city) => (
          <div key={city} className="flex items-center gap-1.5 font-body text-xs font-medium text-slate-500">
            <CheckCircle size={11} className={highlight ? "text-violet-500" : "text-slate-300"} />
            {city}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100">
      <CheckCircle size={9} /> Allowed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-rose-50 text-rose-500 border border-rose-100">
      <XCircle size={9} /> Not Allowed
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
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

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div className="px-6 py-8 max-w-5xl mx-auto space-y-6">
        <div className="h-32 rounded-2xl bg-slate-100 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-52 rounded-2xl bg-slate-100 animate-pulse"
                 style={{ opacity: 1 - i * 0.2 }} />
          ))}
        </div>
      </div>
    );
  }

  // ── No policy ──
  if (!policy) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-5">
          <ShieldCheck size={28} className="text-slate-300" />
        </div>
        <h2 className="font-display font-bold text-xl text-slate-700 mb-2">No Policy Assigned</h2>
        <p className="font-body text-sm text-slate-400 max-w-xs">
          No expense policy has been assigned to your profile yet. Contact your admin.
        </p>
      </div>
    );
  }

  const isOverrideActive   = policy.has_active_override;
  const isViewingOverride  = tab === "Temporary Override" && isOverrideActive;

  const mealT1 = isViewingOverride ? policy.effective_meal_tier1_limit : policy.base_meal_tier1_limit;
  const mealT2 = isViewingOverride ? policy.effective_meal_tier2_limit : policy.base_meal_tier2_limit;
  const mealT3 = isViewingOverride ? policy.effective_meal_tier3_limit : policy.base_meal_tier3_limit;
  const travelLimit = isViewingOverride ? policy.effective_travel_daily_limit : policy.base_travel_daily_limit;
  const hotelLimit  = isViewingOverride ? policy.effective_hotel_daily_limit  : policy.base_hotel_daily_limit;

  return (
    <div className="bg-slate-50 min-h-screen font-body pb-20">
      <div className="max-w-5xl mx-auto px-6 pt-8">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <p className="font-body text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
              Policy Management
            </p>
            <h1 className="font-display font-extrabold text-3xl text-slate-800 tracking-tight">
              My Expense Policy
            </h1>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-2xl w-fit shadow-sm">
            {TABS.map((t) => (
              <button
                key={t}
                disabled={t === "Temporary Override" && !isOverrideActive}
                onClick={() => setTab(t)}
                className={cn(
                  "font-body font-semibold text-sm px-4 py-2 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:ring-offset-1",
                  tab === t
                    ? "bg-violet-500 text-white shadow-sm shadow-violet-200"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                  t === "Temporary Override" && !isOverrideActive
                    ? "opacity-40 cursor-not-allowed pointer-events-none"
                    : ""
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* ── Active Override Banner ───────────────────────────────────────── */}
        {isOverrideActive && (
          <div className="mb-6 bg-violet-50 border border-violet-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
              <Clock size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="font-body text-sm font-bold text-violet-700">Temporary Override Active</span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              </div>
              <p className="font-body text-xs text-violet-600">
                Valid from <strong>{fmtDate(policy.override_valid_from)}</strong> to <strong>{fmtDate(policy.override_valid_until)}</strong>.
                {policy.override_reason && (
                  <span className="italic ml-1 opacity-80">Reason: "{policy.override_reason}"</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── Meal Allowances ──────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display font-bold text-xl text-slate-800">Meal Allowances</h2>
              <p className="font-body text-sm text-slate-400 mt-0.5">Daily limits by city tier</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <UtensilsCrossed size={18} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MealTierCard
              tier="Metropolitan · Tier I"
              label="Mumbai, Delhi, Bangalore"
              cities={["Mumbai", "Delhi", "Bangalore"]}
              amount={fmt(mealT1)}
              highlight
            />
            <MealTierCard
              tier="Major Cities · Tier II"
              label="Pune, Hyderabad, Chennai"
              cities={["Pune", "Hyderabad", "Chennai"]}
              amount={fmt(mealT2)}
            />
            <MealTierCard
              tier="Other Locations · Tier III"
              label="All remaining regions"
              cities={["All other regions"]}
              amount={fmt(mealT3)}
            />
          </div>
        </div>

        {/* ── Travel & Hotel ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">

          {/* Travel */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                  <PlaneTakeoff size={17} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-800">Travel</h3>
                  <p className="font-body text-xs text-slate-400">Corporate & field transit</p>
                </div>
              </div>
              <StatusBadge allowed={policy.travel_allowed} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <SectionLabel>Status</SectionLabel>
                <span className="font-display font-bold text-slate-800 text-base">
                  {policy.travel_allowed ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <SectionLabel>Daily Limit</SectionLabel>
                <span className="font-display font-bold text-violet-600 text-base">{fmt(travelLimit)}</span>
              </div>
            </div>
            <p className="font-body text-xs text-slate-400 mt-3 italic">
              Economy domestic · Business international &gt;6 hrs
            </p>
          </div>

          {/* Hotel */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
                  <Hotel size={17} />
                </div>
                <div>
                  <h3 className="font-display font-bold text-lg text-slate-800">Hotel Stays</h3>
                  <p className="font-body text-xs text-slate-400">Lodging & accommodation</p>
                </div>
              </div>
              <StatusBadge allowed={policy.hotel_allowed} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <SectionLabel>Status</SectionLabel>
                <span className="font-display font-bold text-slate-800 text-base">
                  {policy.hotel_allowed ? "Active" : "Disabled"}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <SectionLabel>Nightly Cap</SectionLabel>
                <span className="font-display font-bold text-violet-600 text-base">{fmt(hotelLimit)}</span>
              </div>
            </div>
            <p className="font-body text-xs text-slate-400 mt-3 italic">
              Corporate tie-ups preferred for Tier I cities
            </p>
          </div>
        </div>

        {/* ── General Rules ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center">
              <FileBadge size={17} />
            </div>
            <div>
              <h2 className="font-display font-bold text-xl text-slate-800">General Rules</h2>
              <p className="font-body text-xs text-slate-400">Compliance & reimbursement settings</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            {/* Receipt requirement */}
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 px-4 py-4 flex items-center justify-between">
              <div>
                <span className="font-body text-sm font-semibold text-slate-700 block">Receipt Required</span>
                <span className="font-body text-xs text-slate-400">For all expense claims</span>
              </div>
              {policy.requires_receipt ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
                  <CheckCircle size={9} /> Yes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                  Optional
                </span>
              )}
            </div>

            {/* Reimbursement cycle */}
            <div className="flex-1 bg-slate-50 rounded-xl border border-slate-100 px-4 py-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
                <Calendar size={15} />
              </div>
              <div>
                <SectionLabel>Reimbursement Cycle</SectionLabel>
                <span className="font-display font-bold text-slate-800 text-base capitalize">
                  {policy.reimbursement_cycle}
                </span>
              </div>
            </div>
          </div>

          {/* Custom notes */}
          {policy.custom_notes && (
            <div className="mt-4 px-4 py-3 rounded-xl bg-violet-50 border border-violet-100 flex items-start gap-2">
              <Info size={14} className="text-violet-400 mt-0.5 shrink-0" />
              <p className="font-body text-xs text-violet-700 leading-relaxed italic">
                "{policy.custom_notes}"
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={16} />
            </div>
            <div>
              <span className="font-body text-sm font-semibold text-slate-700 block">Verified Policy · EXP-BP-2026-0042</span>
              <span className="font-body text-xs text-slate-400">Last updated Mar 2026</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="font-body font-semibold rounded-2xl transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.97] px-5 py-2.5 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 focus:ring-slate-300">
              Download PDF
            </button>
            <button className="font-body font-semibold rounded-2xl transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 active:scale-[0.97] px-5 py-2.5 text-sm bg-violet-500 hover:bg-violet-600 text-white shadow-sm shadow-violet-200 focus:ring-violet-400 flex items-center gap-2">
              Request Variance
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}