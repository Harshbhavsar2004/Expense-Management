"use client";

export interface Filters {
  from: string;
  to: string;
  category: string;
}

interface FilterBarProps {
  filters: Filters;
  categories: string[];
  onChange: (filters: Filters) => void;
  onClear: () => void;
  total: number;
  loading?: boolean;
}

export function FilterBar({ filters, categories, onChange, onClear, total, loading }: FilterBarProps) {
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...filters, [key]: e.target.value });

  const hasFilters = filters.from || filters.to || (filters.category && filters.category !== "all");

  return (
    <div
      id="filter-bar"
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "16px",
        padding: "20px 32px",
        flexWrap: "wrap",
        flexShrink: 0,
        background: "white",
        borderBottom: "1.5px solid var(--border)",
      }}
    >
      {/* Date From */}
      <div style={filterGroupStyle}>
        <label className="typo-overline text-muted!" style={labelStyle} htmlFor="filter-from">Start Date</label>
        <input
          id="filter-from"
          type="date"
          className="typo-body-small"
          value={filters.from}
          onChange={set("from")}
          style={inputStyle}
        />
      </div>

      {/* Date To */}
      <div style={filterGroupStyle}>
        <label className="typo-overline text-muted!" style={labelStyle} htmlFor="filter-to">End Date</label>
        <input
          id="filter-to"
          type="date"
          className="typo-body-small"
          value={filters.to}
          onChange={set("to")}
          style={inputStyle}
        />
      </div>

      {/* Category */}
      <div style={filterGroupStyle}>
        <label className="typo-overline text-muted!" style={labelStyle} htmlFor="filter-category">Expense Type</label>
        <select
          id="filter-category"
          value={filters.category}
          className="typo-body-small"
          onChange={set("category")}
          style={{ ...inputStyle, minWidth: "160px" }}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {hasFilters && (
          <button
            id="filter-clear-btn"
            className="typo-button"
            onClick={onClear}
            style={{
              background: "var(--danger-bg)",
              border: "1px solid transparent",
              borderRadius: "var(--radius-md)",
              padding: "9px 16px",
              color: "var(--danger)",
              cursor: "pointer",
              transition: "all var(--transition)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(239, 68, 68, 0.2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "var(--danger-bg)"; }}
          >
            Reset Filters
          </button>
        )}
      </div>

      {/* Result count */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
        {loading ? (
          <div className="shimmer" style={{ width: "80px", height: "24px" }} />
        ) : (
          <div style={{
            background: "var(--bg-tertiary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            padding: "8px 16px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span className="typo-overline text-secondary!">Total Found:</span>
            <span className="typo-body-default font-bold! text-accent!">{total}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const filterGroupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const labelStyle: React.CSSProperties = {
  // Typography controlled by utility classes now
};

const inputStyle: React.CSSProperties = {
  background: "var(--bg-tertiary)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  padding: "6px 10px",
  color: "var(--text-primary)",
  outline: "none",
  cursor: "pointer",
  colorScheme: "dark",
};
