"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, ShieldCheck, Clock, RefreshCw, Send, CheckCircle2,
  AlertTriangle, X, Image as ImageIcon,
  Utensils, UtensilsCrossed, Car, Hotel, Fuel, Phone, Heart, Package, Plane,
  Receipt, ShoppingBag, ShoppingCart, Wifi, Coffee, Croissant, MapPin, Building2,
  Eye, EyeOff, BadgeCheck, CalendarDays,
  IndianRupee, CircleDot, FileText
} from "lucide-react";
import { AuditAgent } from "@/components/AuditAgent";
import { ExpenseRow } from "@/components/ExpensesTable";

// ─── Category Icon Map (neutral palette — no per-category colors) ─────────────
const CATEGORY_META: Record<string, React.ReactNode> = {
  food:          <Utensils size={17} />,
  meals:         <Coffee size={17} />,
  dinner:        <UtensilsCrossed size={17} />,
  lunch:         <Utensils size={17} />,
  breakfast:     <Croissant size={17} />,
  groceries:     <ShoppingCart size={17} />,
  others:        <Package size={17} />,
  travel:        <Plane size={17} />,
  transport:     <Car size={17} />,
  hotel:         <Hotel size={17} />,
  accommodation: <Building2 size={17} />,
  fuel:          <Fuel size={17} />,
  phone:         <Phone size={17} />,
  communication: <Wifi size={17} />,
  medical:       <Heart size={17} />,
  shopping:      <ShoppingBag size={17} />,
  location:      <MapPin size={17} />,
  receipt:       <Receipt size={17} />,
};

function getCategoryIcon(type?: string): React.ReactNode {
  if (!type) return <Package size={17} />;
  const key = type.toLowerCase().trim();
  for (const [k, v] of Object.entries(CATEGORY_META)) {
    if (key.includes(k)) return v;
  }
  return <Package size={17} />;
}

// ─── Status Map ───────────────────────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft:     { label: "Draft",     className: "bg-slate-100 text-slate-500 border-slate-200"      },
  submitted: { label: "Submitted", className: "bg-blue-50 text-blue-600 border-blue-200"    },
  approved:  { label: "Approved",  className: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  rejected:  { label: "Rejected",  className: "bg-rose-50 text-rose-500 border-rose-200"          },
};

// ─── Resolve helpers ──────────────────────────────────────────────────────────
function resolveAmounts(expense: ExpenseRow) {
  const claimed  = expense.amount != null
    ? expense.amount
    : parseFloat(String((expense as any).claimed_amount_numeric || "0")) || 0;
  const approved = expense.approved_amount != null
    ? expense.approved_amount
    : parseFloat(String(
        (expense as any).reimbursable_amount
        ?? (expense as any).claimed_amount_numeric
        ?? "0"
      )) || claimed;
  return { claimed, approved };
}

function resolveScreenshotUrl(expense: ExpenseRow): string | null {
  const url = (expense as any).upi_screenshot_url
    || (expense as any).screenshot_url
    || (expense as any).payment_screenshot
    || (expense as any).receipt_url
    || expense.receipts?.[0]?.image_url
    || null;

  // DEBUG — open browser console to verify receipt data is arriving
  console.log("[screenshot]", expense.id?.slice(0, 8), {
    upi_screenshot_url: (expense as any).upi_screenshot_url,
    receipts: expense.receipts,
    resolved: url,
  });

  return url;
}

// ─── UPI Screenshot Viewer ────────────────────────────────────────────────────
function UpiViewer({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ImageIcon size={14} className="text-slate-400" />
            <span className="font-display font-bold text-slate-700 text-sm">Payment Screenshot</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X size={13} className="text-slate-500" />
          </button>
        </div>
        <div className="p-4 bg-slate-50">
          <img
            src={url}
            alt="UPI Screenshot"
            className="w-full rounded-2xl object-contain max-h-[65vh] border border-slate-200"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Expense Card ─────────────────────────────────────────────────────────────
function ExpenseCard({
  expense, selected, onClick, onViewScreenshot,
}: {
  expense: ExpenseRow;
  selected: boolean;
  onClick: () => void;
  onViewScreenshot: (url: string) => void;
}) {
  const icon          = getCategoryIcon(expense.expense_type);
  const hasMismatch   = expense.audit_result?.mismatch === true
    || (Array.isArray((expense as any).mismatches) && (expense as any).mismatches.length > 0);
  const isAudited     = !!expense.audit_result || !!(expense as any).audit_explanation;
  const screenshotUrl = resolveScreenshotUrl(expense);
  const { claimed, approved } = resolveAmounts(expense);
  const hasDiff       = Math.round(approved) < Math.round(claimed);

  const rawDate = expense.date || (expense as any).normalized_date_range || (expense as any).date_range;
  const date    = rawDate
    ? (rawDate.length === 10
        ? new Date(rawDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
        : rawDate)
    : "—";

  const auditReason = expense.audit_result?.reason
    || (expense as any).mismatches?.[0]?.replace(/_/g, " ");
  const auditNote   = expense.audit_result?.note || (expense as any).audit_explanation;

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-white rounded-2xl border transition-all duration-200 cursor-pointer
        ${selected
          ? "border-blue-300 shadow-md shadow-blue-100/50 ring-2 ring-blue-200/60"
          : "border-slate-100 hover:border-slate-200 hover:shadow-sm shadow-sm"
        }
      `}
    >
      {/* Left accent bar — only functional, not decorative */}
      {hasMismatch && <div className="absolute left-0 inset-y-3 w-[3px] rounded-full bg-rose-300 ml-px" />}
      {!hasMismatch && expense.verified && <div className="absolute left-0 inset-y-3 w-[3px] rounded-full bg-emerald-300 ml-px" />}

      <div className="pl-5 pr-4 py-3.5 flex items-center gap-4">

        {/* Category Icon — uniform slate colour */}
        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 group-hover:bg-slate-200/80 transition-colors">
          {icon}
        </div>

        {/* Description + badges + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-display font-bold text-slate-800 text-[13px] truncate max-w-[220px]">
              {(expense as any).description || expense.expense_type || "Expense"}
            </span>

            {isAudited ? (
              hasMismatch ? (
                <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-bold bg-rose-50 text-rose-500 border border-rose-100">
                  <AlertTriangle size={8} /> Mismatch
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                  <BadgeCheck size={8} /> Audited
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-semibold bg-slate-50 text-slate-400 border border-slate-200">
                <CircleDot size={8} /> Not Audited
              </span>
            )}

            {expense.verified && (
              <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-[10px] font-bold bg-violet-50 text-blue-500 border border-blue-100">
                <ShieldCheck size={8} /> Verified
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 capitalize">{expense.expense_type}</span>
            <span className="text-slate-300 text-[10px]">·</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <CalendarDays size={10} /> {date}
            </span>
            {hasMismatch && auditReason && (
              <>
                <span className="text-slate-300 text-[10px]">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium truncate max-w-[180px]">
                  <AlertTriangle size={9} /> {auditReason}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Amount — single value when equal, both when differ */}
        <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[95px]">
          {hasDiff ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Claimed</span>
                <span className="font-display font-semibold text-slate-400 text-xs line-through decoration-slate-300">
                  ₹{claimed.toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Approved</span>
                <span className="font-display font-bold text-rose-500 text-sm">
                  ₹{approved.toLocaleString("en-IN")}
                </span>
              </div>
            </>
          ) : (
            <span className="font-display font-bold text-slate-800 text-sm">
              ₹{claimed.toLocaleString("en-IN")}
            </span>
          )}
        </div>

      </div>

    </div>
  );
}

// ─── Expense Detail Panel ─────────────────────────────────────────────────────
function ExpenseDetailPanel({
  expense,
  onClose,
  onViewScreenshot,
}: {
  expense: ExpenseRow | null;
  onClose: () => void;
  onViewScreenshot: (url: string) => void;
}) {
  if (!expense) return null;

  const screenshotUrl = resolveScreenshotUrl(expense);
  const hasMismatch = expense.audit_result?.mismatch === true ||
    (Array.isArray((expense as any).mismatches) && (expense as any).mismatches.length > 0);
  const auditNote = expense.audit_result?.note || (expense as any).audit_explanation;
  const mismatches: string[] = Array.isArray((expense as any).mismatches)
    ? (expense as any).mismatches
    : [];
  const { claimed, approved } = resolveAmounts(expense);
  const displayApproved = hasMismatch ? 0 : approved;

  return (
    <div className="w-80 shrink-0 border-l border-slate-100 bg-white flex flex-col overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center">
            {getCategoryIcon(expense.expense_type)}
          </div>
          <span className="font-display font-bold text-slate-800 text-sm capitalize">
            {expense.expense_type || "Expense"}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">

        {/* Screenshot */}
        {screenshotUrl ? (
          <div className="group/img relative cursor-zoom-in" onClick={() => onViewScreenshot(screenshotUrl)}>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Screenshot</p>
            <div className="relative rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
              <img
                src={screenshotUrl}
                alt="Payment Screenshot"
                className="w-full object-contain max-h-64 transition-transform duration-300 group-hover/img:scale-105"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 flex items-center justify-center transition-colors">
                <Eye size={20} className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
              </div>
            </div>
            <p className="text-[9px] text-center text-slate-400 mt-2 font-medium">Click to expand</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center py-8 gap-2">
            <EyeOff size={20} className="text-slate-300" />
            <p className="text-[11px] text-slate-400 font-medium">No screenshot uploaded</p>
          </div>
        )}

        {/* Amounts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-[10px] text-slate-400 font-medium mb-0.5">Claimed</p>
            <p className="font-display font-bold text-slate-800 text-sm">₹{claimed.toLocaleString("en-IN")}</p>
          </div>
          <div className={`rounded-xl px-4 py-3 ${hasMismatch ? "bg-rose-50" : "bg-slate-50"}`}>
            <p className="text-[10px] text-slate-400 font-medium mb-0.5">Approved</p>
            <p className={`font-display font-bold text-sm ${hasMismatch ? "text-rose-500" : "text-slate-800"}`}>
              ₹{displayApproved.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Mismatches */}
        {mismatches.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Issues Found</p>
            <div className="flex flex-col gap-1.5">
              {mismatches.map((m) => (
                <div key={m} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-50 border border-rose-100">
                  <AlertTriangle size={11} className="text-rose-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-rose-500 capitalize">{m.replace(/_/g, " ")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit explanation */}
        {auditNote && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Audit Explanation</p>
            <div className={`rounded-xl p-3 text-[11px] leading-relaxed font-medium border
              ${hasMismatch
                ? "bg-rose-50 text-rose-600 border-rose-100"
                : "bg-emerald-50 text-emerald-700 border-emerald-100"
              }`}
            >
              <ShieldCheck size={10} className="inline mr-1.5 opacity-60" />
              {auditNote}
            </div>
          </div>
        )}

        {!auditNote && !hasMismatch && expense.verified && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 flex items-center gap-2">
            <BadgeCheck size={14} className="text-emerald-500 shrink-0" />
            <p className="text-[11px] font-semibold text-emerald-600">All audit checks passed.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard({ delay = 0 }: { delay?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-4"
         style={{ opacity: 1 - delay * 0.18 }}>
      <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse shrink-0"
           style={{ animationDelay: `${delay * 80}ms` }} />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-3.5 w-36 rounded-full bg-slate-200 animate-pulse"
             style={{ animationDelay: `${delay * 80 + 40}ms` }} />
        <div className="h-3 w-56 rounded-full bg-slate-100 animate-pulse"
             style={{ animationDelay: `${delay * 80 + 80}ms` }} />
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="h-4 w-20 rounded-full bg-slate-200 animate-pulse" />
        <div className="h-3 w-14 rounded-full bg-slate-100 animate-pulse" />
      </div>
    </div>
  );
}

// ─── Stat Chip ────────────────────────────────────────────────────────────────
function StatChip({ icon, label, value, color }: {
  icon: React.ReactNode; label: string; value: string;
   color: "slate" | "emerald" | "blue" | "rose";
}) {
  const map = {
    slate:   "bg-slate-50 text-slate-600 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
    blue:  "bg-blue-50 text-blue-600 border-blue-200",
    rose:    "bg-rose-50 text-rose-500 border-rose-200",
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${map[color]}`}>
      {icon}
      <span className="opacity-60 font-medium">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function ApplicationDetailsPage() {
  const params  = useParams();
  const router  = useRouter();
  const applicationId = params.id as string;

  const [expenses,       setExpenses]       = useState<ExpenseRow[]>([]);
  const [application,    setApplication]    = useState<any>(null);
  const [loading,        setLoading]        = useState(true);
  const [fadeOut,        setFadeOut]        = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [user,           setUser]           = useState<any>(null);
  const [selectedRecord, setSelectedRecord] = useState<ExpenseRow | null>(null);
  const [screenshotUrl,    setScreenshotUrl]    = useState<string | null>(null);
  const [activeCategory,   setActiveCategory]   = useState("all");
  const [submitSummary,  setSubmitSummary]  = useState<{
    reimbursable_amount: number; reimbursable_count: number;
    flagged_count: number;       total_claimed: number;
  } | null>(null);

  const fetchData = async () => {
    setLoading(true); setFadeOut(false);
    const minDelay = new Promise((r) => setTimeout(r, 800));
    try {
      const [appRes, userRes, expRes] = await Promise.all([
        fetch(`/api/applications/${applicationId}`),
        fetch("/api/user/profile"),
        fetch(`/api/expenses/by-application/${applicationId}`),
        minDelay,
      ]);
      const [appData, userData, expData] = await Promise.all([appRes.json(), userRes.json(), expRes.json()]);
      setFadeOut(true);
      setTimeout(() => {
        setApplication(appData); setUser(userData); setExpenses(expData);
        setLoading(false); setFadeOut(false);
      }, 300);
    } catch (err) {
      console.error(err);
      setFadeOut(true);
      setTimeout(() => { setLoading(false); setFadeOut(false); }, 300);
    }
  };

  useEffect(() => { if (applicationId) fetchData(); }, [applicationId]);

  const submitForApproval = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "submitted" }),
      });
      if (res.ok) {
        const data = await res.json();
        setSubmitSummary({
          reimbursable_amount: data.reimbursable_amount ?? 0,
          reimbursable_count:  data.reimbursable_count  ?? 0,
          flagged_count:       data.flagged_count        ?? 0,
          total_claimed:       data.total_claimed        ?? 0,
        });
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const categories = useMemo(() => {
    if (!Array.isArray(expenses)) return [];
    return Array.from(new Set(expenses.map((e) => e.expense_type).filter(Boolean))) as string[];
  }, [expenses]);

  const isEmployee    = user?.role === "employee";
  const status        = application?.status || "draft";
  const statusMeta    = STATUS_MAP[status] ?? STATUS_MAP.draft;
  const isMismatch = (e: ExpenseRow) =>
    e.audit_result?.mismatch === true ||
    (Array.isArray((e as any).mismatches) && (e as any).mismatches.length > 0);

  const totalClaimed  = expenses.reduce((s, e) => s + resolveAmounts(e).claimed, 0);
  // Approved = sum of verified expenses with no mismatches
  const totalApproved = expenses
    .filter((e) => e.verified && !isMismatch(e))
    .reduce((s, e) => s + resolveAmounts(e).claimed, 0);
  const auditedCount  = expenses.filter((e) => !!e.audit_result || !!(e as any).audit_explanation).length;

  const displayedExpenses = activeCategory === "all"
    ? expenses
    : expenses.filter((e) => e.expense_type === activeCategory);

  return (
    <div className="h-full flex flex-col bg-slate-50 font-body">

      {screenshotUrl && <UpiViewer url={screenshotUrl} onClose={() => setScreenshotUrl(null)} />}

      {/* ─── HEADER ───────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 px-5 py-2.5 shrink-0">
        <div className="flex items-center gap-3">

          {/* Back */}
          <button
            onClick={() => router.push("/applications")}
            className="group w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center shrink-0 transition-colors"
          >
            <ArrowLeft size={13} className="text-slate-500 group-hover:-translate-x-px transition-transform" />
          </button>

          {loading ? (
            <div className="flex items-center gap-2 flex-1 min-w-0" style={{ opacity: fadeOut ? 0 : 1, transition: "opacity 300ms" }}>
              <div className="h-4 w-40 rounded-full bg-slate-200 animate-pulse" />
              <div className="h-4 w-16 rounded-full bg-slate-100 animate-pulse" />
            </div>
          ) : (
            <>
              {/* Title + status */}

              {/* Meta */}
              <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                {application?.client_name && (
                  <span className="flex items-center gap-1"><Building2 size={10} />{application.client_name}</span>
                )}
                {application?.city && (
                  <span className="flex items-center gap-1"><MapPin size={10} />{application.city}</span>
                )}
                {application?.created_at && (
                  <span className="flex items-center gap-1">
                    <CalendarDays size={10} />
                    {new Date(application.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                )}
              </div>

              <div className="hidden md:block h-4 w-px bg-slate-200 shrink-0" />

              {/* Stat chips */}
              <div className="hidden md:flex items-center gap-1.5">
                <StatChip icon={<IndianRupee size={10} />} label="Claimed"  value={`₹${totalClaimed.toLocaleString("en-IN")}`}  color="slate" />
                <StatChip icon={<IndianRupee size={10} />} label="Approved" value={`₹${totalApproved.toLocaleString("en-IN")}`} color="slate" />
                <StatChip icon={<FileText size={10} />}    label="Expenses" value={String(expenses.length)}                      color="slate" />
                <StatChip icon={<ShieldCheck size={10} />} label="Audited"  value={`${auditedCount}/${expenses.length}`}         color="slate" />
              </div>
            </>
          )}

          <div className="flex-1" />

          {/* Action */}
          {!loading && isEmployee && status === "draft" && (
            <button
              onClick={submitForApproval}
              disabled={submitting || expenses.length === 0}
              className="shrink-0 font-semibold rounded-xl transition-all active:scale-[0.97] px-4 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
              Submit
            </button>
          )}
          {!loading && status === "submitted" && isEmployee && (
            <div className="flex items-center gap-1.5 text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100 shrink-0">
              <Clock size={12} /> Awaiting Approval
              {submitSummary && submitSummary.flagged_count > 0 && (
                <span className="text-rose-500 ml-1">· {submitSummary.flagged_count} flagged</span>
              )}
            </div>
          )}
          {!loading && status === "approved" && (
            <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shrink-0">
              <CheckCircle2 size={12} /> Approved
            </div>
          )}

        </div>
      </div>

      {/* ─── BODY ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-3 custom-scrollbar"
          style={{ opacity: fadeOut ? 0 : 1, transition: "opacity 300ms" }}
        >
          {loading ? (
            <> <SkeletonCard delay={0} /> <SkeletonCard delay={1} /> <SkeletonCard delay={2} /> <SkeletonCard delay={3} /> </>
          ) : expenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Receipt size={40} className="mb-3 opacity-20" />
              <p className="font-display font-bold text-slate-500 text-sm">No expenses found</p>
              <p className="font-body text-xs text-slate-400 mt-1">Adjust the filters or add a new expense.</p>
            </div>
          ) : (
            <>
              {/* Category chips */}
              <div className="flex items-center gap-2 flex-wrap">
                {categories.map((cat) => {
                  const catIcon = getCategoryIcon(cat);
                  const count   = expenses.filter((e) => e.expense_type === cat).length;
                  const active  = activeCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(active ? "all" : cat)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                        ${active
                          ? "bg-slate-800 text-white border-slate-800"
                          : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                        }`}
                    >
                      <span className={active ? "text-white opacity-80" : "text-slate-400"}>{catIcon}</span>
                      <span className="capitalize">{cat}</span>
                      <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold
                        ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2.5">
                {displayedExpenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={expense}
                    selected={selectedRecord?.id === expense.id}
                    onClick={() => setSelectedRecord((prev) => prev?.id === expense.id ? null : expense)}
                    onViewScreenshot={setScreenshotUrl}
                  />
                ))}
              </div>
            </>
          )}
          <div className="h-8 shrink-0" />
        </div>

        <ExpenseDetailPanel
          expense={selectedRecord}
          onClose={() => setSelectedRecord(null)}
          onViewScreenshot={setScreenshotUrl}
        />

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