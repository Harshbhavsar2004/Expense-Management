"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
  LineChart, Line,
} from "recharts";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, BarChart2, SlidersHorizontal, Sun, Moon } from "lucide-react";
import type { DashboardSpec, DashboardChart, DashboardTableRow } from "@/types";

interface Props { spec: DashboardSpec; hideHeader?: boolean; }

/* ─── Design token sets ──────────────────────────────────────────────── */
const DARK_T = {
  bg:           "#0f1115",
  bgPage:       "#050608",
  border:       "#1e2229",
  borderStrong: "#333a45",
  text:         "#f3f4f6",
  textSub:      "#9ca3af",
  textMuted:    "#6b7280",
  accent:       "#6366f1",
  accentLight:  "#1e2030",
  accentBorder: "#3b4261",
  headerBg:     "#0f1115",
  rowHover:     "#1a1d24",
  shadow:       "0 8px 32px rgba(0,0,0,0.6)",
  shadowCard:   "0 0 0 1px #1e2229, 0 4px 20px rgba(0,0,0,0.5)",
};

const LIGHT_T = {
  bg:           "#ffffff",
  bgPage:       "#f1f5f9",
  border:       "#e2e8f0",
  borderStrong: "#cbd5e1",
  text:         "#0f172a",
  textSub:      "#475569",
  textMuted:    "#94a3b8",
  accent:       "#6366f1",
  accentLight:  "#eef2ff",
  accentBorder: "#c7d2fe",
  headerBg:     "#ffffff",
  rowHover:     "#f8fafc",
  shadow:       "0 8px 32px rgba(0,0,0,0.08)",
  shadowCard:   "0 0 0 1px #e2e8f0, 0 4px 16px rgba(0,0,0,0.06)",
};

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6",
];

/* ─── Theme context ──────────────────────────────────────────────────── */
type Tokens = typeof DARK_T;
const ThemeCtx = createContext<Tokens>(DARK_T);

/* ─── Token-dependent helpers (called with T at render time) ─────────── */
function makeTooltipStyle(T: Tokens) {
  return {
    contentStyle: {
      background: T.bg,
      border: `1px solid ${T.borderStrong}`,
      borderRadius: "10px",
      fontSize: "12px",
      color: T.text,
      fontFamily: "'DM Sans', sans-serif",
      boxShadow: T.shadow,
    },
    itemStyle: { color: T.textSub },
    labelStyle: { color: T.textMuted, marginBottom: "4px", fontWeight: 600, fontSize: "10px", textTransform: "uppercase" as const },
    cursor: { fill: T === DARK_T ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" },
  };
}

function makeAxisStyle(T: Tokens) {
  return {
    tick: { fill: T.textMuted, fontSize: 11, fontFamily: "'DM Sans', sans-serif" },
    axisLine: { stroke: T.border },
    tickLine: false as const,
  };
}

function makeCardStyle(T: Tokens): React.CSSProperties {
  return {
    background: T.bg,
    border: `1px solid ${T.border}`,
    borderRadius: "10px",
    padding: "20px 20px 16px",
    flex: "1 1 360px",
    minWidth: "320px",
    boxShadow: T.shadowCard,
  };
}

function fmt(v: number, unit?: string) {
  if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(1)}k`;
  if (unit === "₹" || unit?.startsWith("₹")) return `₹${v.toLocaleString("en-IN")}`;
  return String(v);
}

/* ─── Filter bar ─────────────────────────────────────────────────────── */
function FilterBar({
  search, setSearch,
  sort, setSort,
}: {
  search: string; setSearch: (v: string) => void;
  sort: "none" | "asc" | "desc"; setSort: (v: "none" | "asc" | "desc") => void;
}) {
  const T = useContext(ThemeCtx);
  const nextSort = sort === "none" ? "desc" : sort === "desc" ? "asc" : "none";
  const SortIcon = sort === "desc" ? ArrowDown : sort === "asc" ? ArrowUp : ArrowUpDown;
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center" }}>
      <div style={{
        flex: 1, display: "flex", alignItems: "center", gap: "6px",
        background: T.bgPage, border: `1px solid ${T.border}`,
        borderRadius: "6px", padding: "5px 10px",
      }}>
        <Search size={11} color={T.textMuted} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filter…"
          style={{
            background: "none", border: "none", outline: "none",
            color: T.text, fontSize: "12px",
            fontFamily: "'DM Sans', sans-serif", width: "100%",
          }}
        />
      </div>
      <button
        onClick={() => setSort(nextSort)}
        title="Sort by value"
        style={{
          display: "flex", alignItems: "center", gap: "4px",
          padding: "5px 10px", borderRadius: "6px",
          background: sort !== "none" ? T.accentLight : T.bgPage,
          border: sort !== "none" ? `1px solid ${T.accentBorder}` : `1px solid ${T.border}`,
          color: sort !== "none" ? T.accent : T.textMuted,
          cursor: "pointer", fontSize: "11px", fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
        }}
      >
        <SortIcon size={11} />
        {sort !== "none" && (sort === "desc" ? "High→Low" : "Low→High")}
      </button>
    </div>
  );
}

/* ─── Card Title ─────────────────────────────────────────────────────── */
function CardTitle({ chart }: { chart: DashboardChart }) {
  const T = useContext(ThemeCtx);
  return (
    <div style={{ marginBottom: "14px" }}>
      <p style={{
        margin: 0, fontSize: "13px", fontWeight: 600,
        color: T.text, letterSpacing: "0.01em",
        fontFamily: "'DM Sans', sans-serif",
        display: "flex", alignItems: "center", gap: "6px",
      }}>
        {chart.title}
        {chart.unit && (
          <span style={{ fontSize: "11px", color: T.textMuted, fontWeight: 400 }}>
            ({chart.unit})
          </span>
        )}
      </p>
    </div>
  );
}

function Empty() {
  const T = useContext(ThemeCtx);
  return (
    <p style={{ textAlign: "center", color: T.textMuted, fontSize: "12px", margin: "16px 0 0" }}>
      No data matches your filter
    </p>
  );
}

/* ─── Bar Chart ──────────────────────────────────────────────────────── */
function BarChartCard({ chart }: { chart: DashboardChart }) {
  const T = useContext(ThemeCtx);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"none" | "asc" | "desc">("none");

  const xKey = chart.x_key || "label";
  const yKey = chart.y_key || "value";

  const filtered = useMemo(() => {
    const dataArr = Array.isArray(chart.data) ? chart.data : [];
    let d = dataArr.filter((r: any) =>
      String(r[xKey] || r.label || "").toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "asc")  d = [...d].sort((a, b) => (a[yKey] || 0) - (b[yKey] || 0));
    if (sort === "desc") d = [...d].sort((a, b) => (b[yKey] || 0) - (a[yKey] || 0));
    return d;
  }, [chart.data, search, sort, xKey, yKey]);

  const { grouped, seriesKeys } = useMemo(() => {
    const d = filtered;
    if (d.length === 0) return { grouped: [], seriesKeys: [] };

    // Group by xKey to avoid duplicate labels
    const groups: Record<string, any> = {};
    const sKeys = new Set<string>();

    d.forEach(item => {
      const xVal = String(item[xKey] || item.label || "Other");
      if (!groups[xVal]) groups[xVal] = { [xKey]: xVal };
      
      // If there's a series (like 'type' or 'category'), use it. 
      // Otherwise use yKey.
      const sVal = item.type || item.series || item.category || yKey;
      groups[xVal][sVal] = (groups[xVal][sVal] || 0) + (item[yKey] || 0);
      sKeys.add(sVal);
    });

    return { 
      grouped: Object.values(groups), 
      seriesKeys: Array.from(sKeys) 
    };
  }, [filtered, xKey, yKey]);

  const tooltipStyle = makeTooltipStyle(T);
  const axisStyle = makeAxisStyle(T);
  return (
    <div style={makeCardStyle(T)}>
      <CardTitle chart={chart} />
      <FilterBar search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={grouped} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey={xKey} {...axisStyle}
            tick={{ ...axisStyle.tick, fontSize: 10 }}
            interval={0}
            tickFormatter={v => String(v).length > 12 ? String(v).slice(0, 11) + "…" : String(v)}
          />
          <YAxis {...axisStyle} tickFormatter={v => fmt(v, chart.unit)} width={58} />
          <Tooltip {...tooltipStyle}
            formatter={(val: any, name: any) => [fmt(Number(val), chart.unit), name]}
          />
          <Legend
            verticalAlign="top" align="right"
            wrapperStyle={{ fontSize: "10px", marginTop: "-10px", paddingBottom: "10px" }}
          />
          {seriesKeys.map((sKey, i) => (
            <Bar 
              key={sKey} 
              dataKey={sKey} 
              name={sKey} 
              fill={CHART_COLORS[i % CHART_COLORS.length]} 
              radius={[3, 3, 0, 0]} 
              maxBarSize={40} 
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {grouped.length === 0 && <Empty />}
    </div>
  );
}

/* ─── Donut / Pie ────────────────────────────────────────────────────── */
const RADIAN = Math.PI / 180;
function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null;
  const r = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 10, fontFamily: "'DM Sans', sans-serif", fontWeight: 700 }}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

function DonutChartCard({ chart }: { chart: DashboardChart }) {
  const T = useContext(ThemeCtx);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"none" | "asc" | "desc">("none");

  const categoryKey = chart.category_key || "label";
  const valueKey    = chart.value_key   || "value";

  const filtered = useMemo(() => {
    const dataArr = Array.isArray(chart.data) ? chart.data : [];
    let d = dataArr.filter((r: any) =>
      String(r[categoryKey] || r.label || "").toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "asc")  d = [...d].sort((a, b) => (a[valueKey] || 0) - (b[valueKey] || 0));
    if (sort === "desc") d = [...d].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0));
    return d;
  }, [chart.data, search, sort, categoryKey, valueKey]);

  const tooltipStyle = makeTooltipStyle(T);
  return (
    <div style={makeCardStyle(T)}>
      <CardTitle chart={chart} />
      <FilterBar search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
      <ResponsiveContainer width="100%" height={230}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey={valueKey}
            nameKey={categoryKey}
            cx="50%" cy="50%"
            innerRadius="42%" outerRadius="72%"
            labelLine={false}
            label={CustomLabel as any}
            strokeWidth={2}
            stroke={T.bg}
          >
            {filtered.map((entry, i) => (
              <Cell key={i}
                fill={entry.color || chart.colors?.[i % (chart.colors?.length || 1)] || CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom" height={36}
            formatter={v => (
              <span style={{ color: T.textSub, fontSize: 11, fontFamily: "'DM Sans', sans-serif" }}>{v}</span>
            )}
          />
          <Tooltip {...tooltipStyle}
            formatter={(v: any, name: any) => [fmt(Number(v), chart.unit), name]}
          />
        </PieChart>
      </ResponsiveContainer>
      {filtered.length === 0 && <Empty />}
    </div>
  );
}

/* ─── Line Chart ─────────────────────────────────────────────────────── */
function LineChartCard({ chart }: { chart: DashboardChart }) {
  const T = useContext(ThemeCtx);
  const [search, setSearch] = useState("");
  const xKey = chart.x_key || "label";
  const yKey = chart.y_key || "value";

  const filtered = useMemo(() => {
    const dataArr = Array.isArray(chart.data) ? chart.data : [];
    return dataArr.filter((r: any) =>
      String(r[xKey] || r.label || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [chart.data, search, xKey]);

  const tooltipStyle = makeTooltipStyle(T);
  const axisStyle = makeAxisStyle(T);
  return (
    <div style={{ ...makeCardStyle(T), flex: "1 1 100%" }}>
      <CardTitle chart={chart} />
      <div style={{ marginBottom: "14px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: T.bgPage, border: `1px solid ${T.border}`,
          borderRadius: "6px", padding: "5px 10px", maxWidth: "220px",
        }}>
          <Search size={11} color={T.textMuted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter…"
            style={{ background: "none", border: "none", outline: "none", color: T.text, fontSize: "12px", fontFamily: "'DM Sans', sans-serif", width: "100%" }} />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={filtered}>
          <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />
          <XAxis dataKey={xKey} {...axisStyle}
            tickFormatter={v => String(v).length > 10 ? String(v).slice(0, 9) + "…" : String(v)}
          />
          <YAxis {...axisStyle} tickFormatter={v => fmt(Number(v), chart.unit)} width={58} />
          <Tooltip {...tooltipStyle}
            formatter={(v: any) => [fmt(Number(v), chart.unit), chart.y_title || "Value"]}
          />
          <Line
            type="monotone" dataKey={yKey}
            stroke={chart.colors?.[0] || T.accent}
            strokeWidth={3}
            dot={{ fill: T.bg, stroke: chart.colors?.[0] || T.accent, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, strokeWidth: 0, fill: T.accent }}
          />
        </LineChart>
      </ResponsiveContainer>
      {filtered.length === 0 && <Empty />}
    </div>
  );
}

/* ─── Table ──────────────────────────────────────────────────────────── */
function TableCard({ chart }: { chart: any }) {
  const T = useContext(ThemeCtx);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rawRows: DashboardTableRow[] = useMemo(() => {
    const arr = chart.rows || chart.data || [];
    const safeArr = Array.isArray(arr) ? arr : [];
    return safeArr.map((r: any) =>
      typeof r !== "object" || r === null ? { value: r } : r
    );
  }, [chart]);

  const columns = useMemo(() => {
    if (chart.columns?.length > 0) return chart.columns;
    if (rawRows.length > 0) return Object.keys(rawRows[0]).map(k => ({ key: k, label: k }));
    return [];
  }, [chart.columns, rawRows]);

  const filtered = useMemo(() => {
    let rows = rawRows.filter((row: any) =>
      Object.values(row).some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))
    );
    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const av = a[sortCol], bv = b[sortCol];
        if (typeof av === "number" && typeof bv === "number")
          return sortDir === "asc" ? av - bv : bv - av;
        return sortDir === "asc"
          ? String(av).localeCompare(String(bv))
          : String(bv).localeCompare(String(av));
      });
    }
    return rows;
  }, [rawRows, search, sortCol, sortDir]);

  const toggleSort = (colId: string) => {
    if (sortCol === colId) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(colId); setSortDir("asc"); }
  };

  return (
    <div style={{ ...makeCardStyle(T), flex: "1 1 100%" }}>
      <CardTitle chart={chart} />
      <div style={{ marginBottom: "12px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: T.bgPage, border: `1px solid ${T.border}`,
          borderRadius: "6px", padding: "5px 10px", maxWidth: "220px",
        }}>
          <Search size={11} color={T.textMuted} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search table…"
            style={{ background: "none", border: "none", outline: "none", color: T.text, fontSize: "12px", fontFamily: "'DM Sans', sans-serif", width: "100%" }} />
        </div>
      </div>
      <div style={{ overflowX: "auto", borderRadius: "8px", border: `1px solid ${T.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px", fontFamily: "'DM Sans', sans-serif" }}>
          <thead>
            <tr style={{ background: T.headerBg }}>
              {columns.map((col: any, idx: number) => {
                const colId = typeof col === "string" ? col : (col.key || col.field || String(idx));
                const label = typeof col === "string" ? col : col.label || colId;
                return (
                  <th key={colId} onClick={() => toggleSort(colId)}
                    style={{
                      padding: "10px 14px", textAlign: "left", cursor: "pointer",
                      color: sortCol === colId ? T.accent : T.textSub,
                      fontWeight: 600, whiteSpace: "nowrap",
                      borderBottom: `1px solid ${T.border}`,
                      userSelect: "none", fontSize: "11.5px", letterSpacing: "0.03em",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {label}
                      {sortCol === colId
                        ? sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                        : <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
                      }
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length}
                  style={{ padding: "24px", textAlign: "center", color: T.textMuted, fontSize: "12px" }}>
                  No matching rows
                </td>
              </tr>
            ) : filtered.map((row, i) => (
              <tr key={i}
                style={{ borderTop: `1px solid ${T.border}`, transition: "background 0.1s" }}
                onMouseEnter={e => (e.currentTarget.style.background = T.rowHover)}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                {columns.map((col: any, idx: number) => {
                  const colId = typeof col === "string" ? col : (col.key || col.field || String(idx));
                  const val = row[colId];
                  const colProp = chart.column_properties?.[colId];
                  let displayVal: React.ReactNode = String(val ?? "—");
                  if (val && typeof val === "object") displayVal = JSON.stringify(val);
                  if (colProp?.type === "currency" && typeof val === "number") displayVal = fmt(val, "₹");
                  else if (colProp?.type === "boolean") displayVal = val ? "✅" : "❌";
                  return (
                    <td key={colId} style={{ padding: "9px 14px", color: T.textSub, whiteSpace: "nowrap" }}>
                      {displayVal}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > 0 && (
        <p style={{ margin: "6px 0 0", fontSize: "11px", color: T.textMuted, textAlign: "right" }}>
          {filtered.length} row{filtered.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

/* ─── KPI Summary Strip ──────────────────────────────────────────────── */
function SummaryStrip({ charts }: { charts: DashboardChart[] }) {
  const T = useContext(ThemeCtx);
  const totalValue = useMemo(() =>
    charts.reduce((sum, c) => {
      if (c.type === "table") return sum;
      const vKey = c.value_key || c.y_key || "value";
      const dataArr = Array.isArray(c.data) ? c.data : [];
      return sum + dataArr.reduce((s, d: any) => s + (Number(d[vKey] || d.value || 0)), 0);
    }, 0), [charts]);

  const itemCount = useMemo(() =>
    charts.reduce((s, c: any) => {
      const dataArr = Array.isArray(c.data) ? c.data : [];
      const rowsArr = Array.isArray(c.rows) ? c.rows : [];
      return s + (dataArr.length || rowsArr.length || 0);
    }, 0), [charts]);

  const units = new Set(charts.map(c => c.unit).filter(Boolean));
  const unit = units.size === 1 ? [...units][0] : "";

  const kpis = [
    { label: "Total Value", value: fmt(totalValue, unit), sub: "across all categories" },
    { label: "Data Points", value: String(itemCount), sub: "entries tracked" },
    { label: "Charts", value: String(charts.length), sub: "visualizations" },
  ];

  return (
    <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
      {kpis.map(({ label, value, sub }) => (
        <div key={label} style={{
          flex: "1 1 140px",
          background: T.bg,
          border: `1px solid ${T.border}`,
          borderRadius: "10px",
          padding: "14px 18px",
          boxShadow: T.shadowCard,
          borderLeft: `3px solid ${T.accent}`,
        }}>
          <p style={{ margin: 0, fontSize: "11px", color: T.textMuted, fontFamily: "'DM Sans', sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            {label}
          </p>
          <p style={{ margin: "4px 0 2px", fontSize: "22px", fontWeight: 700, color: T.text, fontFamily: "'DM Sans', sans-serif", letterSpacing: "-0.5px" }}>
            {value}
          </p>
          <p style={{ margin: 0, fontSize: "11px", color: T.textMuted, fontFamily: "'DM Sans', sans-serif" }}>
            {sub}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Main DashboardRenderer ─────────────────────────────────────────── */
export default function DashboardRenderer({ spec, hideHeader }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [isDark, setIsDark] = useState(true);
  const T = isDark ? DARK_T : LIGHT_T;

  const chartTypes = useMemo(() => {
    const types = new Set(spec.charts.map(c => c.type));
    return ["all", ...Array.from(types)];
  }, [spec.charts]);

  const visibleCharts = useMemo(() =>
    activeFilter === "all" ? spec.charts : spec.charts.filter(c => c.type === activeFilter),
    [spec.charts, activeFilter]
  );

  return (
    <ThemeCtx.Provider value={T}>
    {/* Full-width page wrapper */}
    <div style={{
      background: T.bgPage,
      minHeight: "100vh",
      width: "100%",
      fontFamily: "'DM Sans', sans-serif",
      transition: "background 0.2s",
    }}>
      {/* Top header bar — Zoho-style (shown only on standalone page) */}
      {!hideHeader && <div style={{
        background: T.bg,
        borderBottom: `1px solid ${T.border}`,
        padding: "0 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: "52px",
        position: "sticky",
        top: 0,
        zIndex: 10,
        boxShadow: `0 1px 3px ${isDark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.06)"}`,
        transition: "background 0.2s, border-color 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "8px",
            background: T.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 12px ${T.accent}44`,
          }}>
            <BarChart2 size={14} color="white" />
          </div>
          <span style={{ fontSize: "14px", fontWeight: 700, color: T.text, letterSpacing: "-0.2px" }}>
            {spec.title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(d => !d)}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "8px",
              background: T.accentLight, border: `1px solid ${T.accentBorder}`,
              color: T.accent, cursor: "pointer",
              transition: "all 0.18s",
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button style={{
            display: "flex", alignItems: "center", gap: "5px",
            padding: "6px 12px", borderRadius: "6px",
            background: "none", border: `1px solid ${T.border}`,
            color: T.textSub, cursor: "pointer", fontSize: "12px",
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
          }}>
            <SlidersHorizontal size={12} />
            Filters
          </button>
        </div>
      </div>}

      {/* Content area — full width with padding */}
      <div style={{ padding: "24px 28px 40px" }}>

        {/* Summary KPIs */}
        <SummaryStrip charts={spec.charts} />

        {/* Chart type tabs */}
        {chartTypes.length > 2 && (
          <div style={{
            display: "flex", gap: "4px", marginBottom: "20px",
            background: T.bg,
            border: `1px solid ${T.border}`,
            borderRadius: "8px",
            padding: "4px",
            width: "fit-content",
            boxShadow: T.shadowCard,
          }}>
            {chartTypes.map(type => (
              <button
                key={type}
                onClick={() => setActiveFilter(type)}
                style={{
                  padding: "5px 14px", borderRadius: "6px", cursor: "pointer",
                  fontSize: "12px", fontWeight: 500, fontFamily: "'DM Sans', sans-serif",
                  border: "none",
                  background: activeFilter === type ? T.text : "none",
                  color: activeFilter === type ? T.bg : T.textSub,
                  transition: "all 0.15s",
                  textTransform: "capitalize",
                }}
              >
                {type === "all" ? "All Charts" : type}
              </button>
            ))}
          </div>
        )}

        {/* Charts grid */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {visibleCharts.map((chart: any, i) => {
            const type = chart.type || chart.chartType;
            if (type === "bar")   return <BarChartCard   key={i} chart={chart} />;
            if (type === "donut") return <DonutChartCard key={i} chart={chart} />;
            if (type === "line")  return <LineChartCard  key={i} chart={chart} />;
            if (type === "table") return <TableCard      key={i} chart={chart} />;
            return null;
          })}
        </div>

        {/* Footer */}
        <p style={{
          margin: "32px 0 0",
          fontSize: "11.5px",
          color: T.textMuted,
          textAlign: "center",
          fontFamily: "'DM Sans', sans-serif",
        }}>
          AI Generated Insight · {spec.title}
        </p>
      </div>
    </div>
    </ThemeCtx.Provider>
  );
}