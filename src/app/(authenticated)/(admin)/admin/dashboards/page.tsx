"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { 
  IconChartPie, 
  IconExternalLink, 
  IconTrash, 
  IconSearch, 
  IconCalendar,
  IconLayoutGrid,
  IconList
} from "@tabler/icons-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function DashboardsListPage() {
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const supabase = createClient();

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("dashboards")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDashboards(data || []);
    } catch (err: any) {
      console.error("Error fetching dashboards:", err);
      toast.error("Failed to load dashboards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this dashboard?")) return;

    try {
      const { error } = await supabase.from("dashboards").delete().eq("id", id);
      if (error) throw error;
      toast.success("Dashboard deleted");
      setDashboards(prev => prev.filter(d => d.id !== id));
    } catch (err: any) {
      toast.error("Failed to delete dashboard");
    }
  };

  const filtered = dashboards.filter(d => 
    (d.spec?.title || "Untitled Dashboard").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#f8f9fc]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <IconChartPie className="text-indigo-600" size={28} />
            Visual Insights
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Browse and manage your AI-generated visual dashboards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text"
              placeholder="Search dashboards..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64 transition-all"
            />
          </div>
          <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
            <button 
              onClick={() => setView("grid")}
              className={cn("p-1.5 rounded-md transition-all", view === "grid" ? "bg-slate-100 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <IconLayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setView("list")}
              className={cn("p-1.5 rounded-md transition-all", view === "list" ? "bg-slate-100 text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600")}
            >
              <IconList size={18} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-48 bg-white border border-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-300 rounded-3xl">
          <IconChartPie size={48} className="text-slate-200 mb-4" />
          <h3 className="text-lg font-semibold text-slate-900">No Dashboards Found</h3>
          <p className="text-slate-500 text-sm max-w-xs text-center mt-1">
            Generate insights using the AI assistant to see them listed here.
          </p>
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((d) => (
            <div 
              key={d.id}
              className="group relative bg-white border border-slate-200 rounded-2xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner">
                  <IconChartPie size={24} />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={(e) => handleDelete(d.id, e)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <IconTrash size={16} />
                  </button>
                </div>
              </div>
              
              <h3 className="text-[17px] font-bold text-slate-900 mb-2 leading-tight">
                {d.spec?.title || "Untitled Dashboard"}
              </h3>
              
              <div className="flex items-center gap-4 mt-auto pt-4 border-t border-slate-50 text-slate-400 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <IconCalendar size={14} />
                  {format(new Date(d.created_at), "MMM d, yyyy")}
                </span>
              </div>

              <a 
                href={`/admin/dashboard/${d.id}`}
                target="_blank"
                className="mt-5 w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all shadow-lg active:scale-95"
              >
                Open Dashboard <IconExternalLink size={16} />
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <IconChartPie size={18} />
                      </div>
                      <span className="font-semibold text-slate-900 text-sm">
                        {d.spec?.title || "Untitled Dashboard"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {format(new Date(d.created_at), "MMM d, yyyy · HH:mm")}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       <a 
                        href={`/admin/dashboard/${d.id}`}
                        target="_blank"
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Open Dashboard"
                      >
                        <IconExternalLink size={18} />
                      </a>
                      <button 
                        onClick={(e) => handleDelete(d.id, e)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <IconTrash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
