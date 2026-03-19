"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Filter, Plus, LayoutGrid, List } from "lucide-react";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();

  const fetchApps = async () => {
    setLoading(true);
    setFadeOut(false);
    // Enforce a minimum skeleton display time so it never flashes
    const minDelay = new Promise((resolve) => setTimeout(resolve, 800));
    try {
      const [res] = await Promise.all([fetch("/api/applications/all"), minDelay]);
      const data = await res.json();
      // Trigger fade-out first, then swap content
      setFadeOut(true);
      setTimeout(() => {
        if (Array.isArray(data)) {
          setApplications(data);
        } else {
          console.error("Data is not an array:", data);
          setApplications([]);
        }
        setLoading(false);
        setFadeOut(false);
      }, 350);
    } catch (err) {
      console.error("Fetch error:", err);
      setFadeOut(true);
      setTimeout(() => {
        setLoading(false);
        setFadeOut(false);
      }, 350);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const filteredApps = Array.isArray(applications) ? applications.filter((app: any) =>
    app.application_id?.toLowerCase().includes(search.toLowerCase()) ||
    app.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    app.city?.toLowerCase().includes(search.toLowerCase())
  ) : [];

  return (
    <div className="p-8 h-full flex flex-col relative overflow-hidden">
      <div className="max-w-7xl mx-auto w-full flex flex-col gap-8 h-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-8 h-[2px] bg-blue-500"></span>
              <span className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em]">Management</span>
            </div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Expense Applications</h1>
            <p className="text-slate-500 mt-2 font-medium">Review and audit client visit reports from WhatsApp.</p>
          </div>

          <div className="flex gap-3">
            <div className="bg-white/5 p-1 rounded-xl flex">
              <button className="p-2 text-white bg-blue-500 rounded-lg shadow-lg"><LayoutGrid size={18} /></button>
              <button className="p-2 text-gray-500 hover:text-white"><List size={18} /></button>
            </div>
            <button className="btn-accent px-6 py-2 rounded-xl flex items-center gap-2 font-bold transition-all hover:scale-105">
              <Plus size={18} /> New Report
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search by Application ID, Client or City..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pl-12 pr-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all font-medium"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl text-slate-600 font-bold hover:bg-slate-50 transition-all shadow-sm">
            <Filter size={18} /> Filters
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-x-auto overflow-y-auto pb-12 custom-scrollbar">
          {loading ? (
            <div
              className="flex flex-col gap-3 transition-opacity duration-300 ease-in-out"
              style={{ opacity: fadeOut ? 0 : 1 }}
            >
              {/* Table header skeleton */}
              <div className="min-w-[800px] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex gap-6">
                  {[120, 160, 100, 130, 90, 80].map((w, i) => (
                    <div
                      key={i}
                      className="h-3 rounded-full bg-slate-200 animate-pulse"
                      style={{
                        width: w,
                        animationDelay: `${i * 60}ms`,
                        animationDuration: "1.6s",
                      }}
                    />
                  ))}
                </div>
                {/* Row skeletons */}
                {[...Array(6)].map((_, rowIdx) => (
                  <div
                    key={rowIdx}
                    className="border-b border-slate-100 px-6 py-4 flex gap-6 items-center"
                    style={{
                      opacity: 1 - rowIdx * 0.12,
                    }}
                  >
                    {[120, 160, 100, 130, 90, 80].map((w, colIdx) => (
                      <div
                        key={colIdx}
                        className="h-3.5 rounded-full bg-slate-100 animate-pulse"
                        style={{
                          width: w * (0.7 + Math.random() * 0.5),
                          animationDelay: `${rowIdx * 80 + colIdx * 40}ms`,
                          animationDuration: "1.6s",
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : filteredApps.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-50 mt-12 animate-fade-in">
              <Search size={64} className="text-slate-300 mb-4" />
              <p className="typo-h3 text-slate-500">No applications found.</p>
            </div>
          ) : (
            <div
              className="min-w-[800px] border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm animate-fade-in"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="py-4 px-6 typo-overline text-slate-500">Application ID</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Client</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Date</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Location</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Duration</th>
                    <th className="py-4 px-6 typo-overline text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApps.map((app: any) => (
                    <tr
                      key={app.id}
                      onClick={() => router.push(`/applications/${app.application_id}`)}
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <span className="typo-body-default font-semibold text-blue-600 group-hover:text-blue-700 transition-colors">
                          {app.application_id}
                        </span>
                      </td>
                      <td className="py-4 px-6 typo-body-default text-slate-900 font-medium">
                        {app.client_name}
                      </td>
                      <td className="py-4 px-6 typo-body-small text-slate-500">
                        {new Date(app.created_at).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric"
                        })}
                      </td>
                      <td className="py-4 px-6 typo-body-default text-slate-600">
                        {app.city} <span className="text-slate-400">({app.city_tier})</span>
                      </td>
                      <td className="py-4 px-6 typo-body-default text-slate-600">
                        {app.visit_duration}
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          app.status === 'draft' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          app.status === 'submitted' ? 'bg-blue-100 text-blue-600 border-blue-200' :
                          app.status === 'approved' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' :
                          'bg-rose-100 text-rose-600 border-rose-200'
                        }`}>
                          {app.status || 'draft'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}w