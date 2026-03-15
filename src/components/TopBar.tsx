"use client";

import { useEffect, useState } from "react";
import { Search, Bell, Plus, Users } from "lucide-react";

interface TopBarProps {
  orgName?: string;
  title?: string;
}

export function TopBar({ orgName, title = "Dashboard" }: TopBarProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  return (
    <header
      id="main-topbar"
      style={{
        height: "var(--topbar-height)",
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 32px",
        gap: "24px",
        flexShrink: 0,
        position: "sticky",
        top: 0,
        zIndex: 9,
      }}
    >
      {/* Title & Organization */}
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
            {title}
          </h2>
          {orgName && (
            <>
              <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>•</span>
              <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-secondary)" }}>{orgName}</span>
            </>
          )}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
          {dateStr} — {timeStr}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Search claims..."
            style={{
              padding: "8px 12px 8px 36px",
              background: "var(--bg-tertiary)",
              border: "1px solid transparent",
              borderRadius: "var(--radius-md)",
              fontSize: "13px",
              width: "240px",
              outline: "none",
              transition: "var(--transition)",
            }}
            onFocus={(e) => (e.currentTarget.style.border = "1px solid var(--border-active)")}
            onBlur={(e) => (e.currentTarget.style.border = "1px solid transparent")}
          />
        </div>

        {/* Notifs */}
        <button
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            transition: "var(--transition)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tertiary)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Bell size={18} />
          <span style={{ position: "absolute", top: "10px", right: "10px", width: "6px", height: "6px", background: "var(--danger)", borderRadius: "50%", border: "2px solid white" }} />
        </button>

        {/* CTA */}
        <button
          style={{
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "10px 16px",
            fontSize: "13px",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 4px 12px var(--accent-glow)",
            transition: "var(--transition)",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--accent)")}
        >
          <Plus size={16} strokeWidth={3} />
          <span>New Claim</span>
        </button>
      </div>
    </header>
  );
}
