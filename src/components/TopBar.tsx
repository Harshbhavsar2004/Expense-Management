"use client";

import { useEffect, useState } from "react";
import { Search, Bell, Plus, ChevronRight, SlidersHorizontal } from "lucide-react";
export type UserRole = "employee" | "admin";

interface TopBarProps {
  orgName?: string;
  title?: string;
  breadcrumb?: string[];
  role?: UserRole;
  onNewClaim?: () => void;
}

export function TopBar({
  orgName = "Expify Agent",
  title = "Dashboard",
  breadcrumb,
  role = "employee",
  onNewClaim,
}: TopBarProps) {
  const [now, setNow] = useState(new Date());
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <header
      style={{
        height: "var(--topbar-height)",
        background: "var(--bg-secondary)",
        borderBottom: "1.5px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: "16px",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 40,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      {/* ── Left: Breadcrumb + Title ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {breadcrumb && breadcrumb.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "1px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>
              {orgName}
            </span>
            {breadcrumb.map((crumb, i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <ChevronRight size={11} color="var(--text-muted)" />
                <span style={{ fontSize: "11px", color: i === breadcrumb.length - 1 ? "var(--text-secondary)" : "var(--text-muted)", fontFamily: "'Inter', sans-serif", fontWeight: i === breadcrumb.length - 1 ? 500 : 400 }}>
                  {crumb}
                </span>
              </span>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <h1
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {title}
          </h1>

          {/* Role badge */}
          <span
            className={`role-badge ${role}`}
          >
            {role === "admin" ? "Admin" : "Employee"}
          </span>
        </div>
      </div>

      {/* ── Center: Date/Time ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "5px 12px",
          background: "var(--bg-tertiary)",
          borderRadius: "var(--radius-md)",
          flexShrink: 0,
        }}
      >
        <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)", boxShadow: "0 0 0 2px var(--success-bg)" }} />
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", fontFamily: "'Inter', sans-serif", fontWeight: 500, whiteSpace: "nowrap" }}>
          {dateStr}
        </span>
        <span style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "'Inter', sans-serif" }}>·</span>
        <span style={{ fontSize: "12px", color: "var(--text-primary)", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}>
          {timeStr}
        </span>
      </div>

      {/* ── Right: Search + Actions ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "11px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="Search expenses..."
            style={{
              padding: "8px 12px 8px 32px",
              background: searchFocused ? "var(--bg-secondary)" : "var(--bg-tertiary)",
              border: searchFocused ? "1.5px solid var(--accent)" : "1px solid transparent",
              borderRadius: "var(--radius-md)",
              width: "220px",
              outline: "none",
              fontSize: "13px",
              fontFamily: "'Inter', sans-serif",
              color: "var(--text-primary)",
              transition: "all 0.18s",
              boxShadow: searchFocused ? "0 0 0 3px var(--accent-light)" : "none",
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>

        {/* Notifications */}
        <button
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <Bell size={16} />
          <span
            style={{
              position: "absolute",
              top: "7px",
              right: "7px",
              width: "5px",
              height: "5px",
              background: "var(--danger)",
              borderRadius: "50%",
              border: "1.5px solid white",
            }}
          />
        </button>

        {/* Filters (admin only) */}
        {role === "admin" && (
          <button
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-tertiary)"; e.currentTarget.style.borderColor = "var(--border-hover)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-secondary)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            <SlidersHorizontal size={16} />
          </button>
        )}

        {/* CTA */}
        {role === "employee" && (
          <button
            onClick={onNewClaim}
            className="btn-primary typo-button"
            style={{ gap: "6px", padding: "8px 16px" }}
          >
            <Plus size={15} strokeWidth={2.5} />
            New Claim
          </button>
        )}
      </div>
    </header>
  );
}
