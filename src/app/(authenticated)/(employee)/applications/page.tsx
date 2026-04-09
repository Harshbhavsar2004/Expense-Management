"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Monitor, ChevronLeft, ChevronRight } from "lucide-react";
import { CircularLoader } from "@/components/CircularLoader";
import { motion, AnimatePresence } from "framer-motion";

function WhatsAppIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.978-1.414A9.953 9.953 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2Z"
        fill="#25D366"
      />
      <path
        d="M8.5 8.5c.2-.5.7-.8 1.2-.8.3 0 .5.1.7.2l.8 1.8c.1.3.1.6-.1.8l-.5.6c.4.8 1 1.5 1.8 2 .3.1.5-.1.7-.3l.5-.5c.2-.2.5-.3.8-.2l1.8.8c.3.1.5.4.5.7 0 1.1-.9 2-2 2-3 0-6-3-6-6 0-1.1.9-2 2-2-.1 0 0 0 0 0Z"
        fill="white"
      />
    </svg>
  );
}

function CliqIcon({ size = 14 }: { size?: number }) {
  return (
    <img
      src="https://gdm-catalog-fmapi-prod.imgix.net/ProductLogo/7ad8ef27-d58d-47ff-bfa9-28a293d2d243.png?w=90&h=90&fit=max&dpr=3&auto=format&q=50"
      alt="Cliq by Zoho"
      width={size}
      height={size}
      style={{ borderRadius: 3, objectFit: "contain" }}
    />
  );
}

const PAGE_SIZE = 5;

// ── Source helpers ─────────────────────────────────────────────────────────

type Source = "web" | "whatsapp" | "cliq";

/** Derive source from the DB field (or fall back to user_phone heuristic) */
function getSource(app: any): Source {
  const phone = app.user_phone || "";
  if (phone.startsWith("cliq:")) return "cliq";
  
  // Custom prefix logic requested by user
  if (phone.startsWith("+918600437554")) return "web";      // Audit AI
  if (phone.startsWith("918600437554"))  return "whatsapp"; // WhatsApp
  
  if (app.source) return app.source as Source;
  if (app.user_id == null) return "whatsapp";
  return "web";
}

const SOURCE_META: Record<Source, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
  web: {
    label: "Audit AI",
    icon: <Monitor size={13} strokeWidth={2} />,
    bg: "bg-violet-50",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: <WhatsAppIcon size={13} />,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  cliq: {
    label: "Cliq by Zoho",
    icon: <CliqIcon size={13} />,
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
  },
};

function SourceBadge({ app }: { app: any }) {
  const source = getSource(app);
  const meta = SOURCE_META[source];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;

  const pages: (number | "…")[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    if (current > 3) pages.push("…");
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2) pages.push("…");
    pages.push(total);
  }

  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/60">
      <span className="text-xs text-slate-400 font-medium">
        Page {current} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(current - 1)}
          disabled={current === 1}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={15} />
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="px-2 text-slate-400 text-sm select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p as number)}
              className={`min-w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                p === current
                  ? "bg-blue-500 text-white shadow-sm shadow-blue-200"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onChange(current + 1)}
          disabled={current === total}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const router = useRouter();

  const fetchApps = async () => {
    setLoading(true);
    setFadeOut(false);
    const minDelay = new Promise((resolve) => setTimeout(resolve, 800));
    try {
      const [res] = await Promise.all([fetch("/api/applications/all"), minDelay]);
      const data = await res.json();
      setFadeOut(true);
      setTimeout(() => {
        setApplications(Array.isArray(data) ? data : []);
        setLoading(false);
        setFadeOut(false);
      }, 350);
    } catch (err) {
      console.error("Fetch error:", err);
      setFadeOut(true);
      setTimeout(() => { setLoading(false); setFadeOut(false); }, 350);
    }
  };

  useEffect(() => { fetchApps(); }, []);

  // Reset to page 1 whenever search changes
  useEffect(() => { setPage(1); }, [search]);

  const filteredApps = useMemo(
    () =>
      applications.filter(
        (app) =>
          app.application_id?.toLowerCase().includes(search.toLowerCase()) ||
          app.client_name?.toLowerCase().includes(search.toLowerCase()) ||
          app.city?.toLowerCase().includes(search.toLowerCase())
      ),
    [applications, search]
  );

  const totalPages = Math.max(1, Math.ceil(filteredApps.length / PAGE_SIZE));
  const pagedApps = filteredApps.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-8 h-full flex flex-col relative overflow-hidden">
      <div className="w-full flex flex-col gap-8 h-full">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <p className="text-slate-500 mt-2 font-medium">
              Review and audit client visit reports.
            </p>
          </div>

          {/* Source legend */}
          <div className="flex items-center gap-2">
            {(Object.entries(SOURCE_META) as [Source, typeof SOURCE_META[Source]][]).map(([key, meta]) => (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
              >
                {meta.icon}
                {meta.label}
              </span>
            ))}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Search by Application ID, Client or City..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-x-auto overflow-y-auto pb-12">
          {loading ? (
            <CircularLoader message="Fetching applications..." />
          ) : filteredApps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50 mt-12 animate-fade-in">
              <Search size={64} className="text-slate-300 mb-4" />
              <p className="typo-h3 text-slate-500">No applications found.</p>
            </div>
          ) : (
            <div className="min-w-215 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm animate-fade-in">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-4 px-6 typo-overline text-slate-500">Application ID</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Client</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Source</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Date</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Location</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Duration</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AnimatePresence mode="popLayout">
                    {pagedApps.map((app: any, index: number) => (
                      <motion.tr
                        key={app.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.2, delay: index * 0.04 }}
                        onClick={() => router.push(`/applications/${app.application_id}`)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors group"
                      >
                      <td className="py-4 px-6">
                        <span className="typo-body-default font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                          {app.application_id}
                        </span>
                      </td>
                      <td className="py-4 px-6 typo-body-default text-slate-900 font-medium">
                        {app.client_name}
                      </td>
                      <td className="py-4 px-6">
                        <SourceBadge app={app} />
                      </td>
                      <td className="py-4 px-6 typo-body-small text-slate-500">
                        {new Date(app.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-6 typo-body-default text-slate-600">
                        {app.city}{" "}
                        <span className="text-slate-400">({app.city_tier})</span>
                      </td>
                      <td className="py-4 px-6 typo-body-default text-slate-600">
                        {app.visit_duration}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            app.status === "draft"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : app.status === "submitted"
                              ? "bg-blue-100 text-blue-600 border-blue-200"
                              : app.status === "approved"
                              ? "bg-emerald-100 text-emerald-600 border-emerald-200"
                              : "bg-rose-100 text-rose-600 border-rose-200"
                          }`}
                        >
                          {app.status || "draft"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {/* Pagination */}
              <Pagination
                current={page}
                total={totalPages}
                onChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
