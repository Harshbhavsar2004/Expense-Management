"use client";

import { Plus, Search, MessageSquare, Trash2 } from "lucide-react";
import type { ChatSession } from "@/types";
import { groupSessionsByDate } from "@/lib/utils";

interface ChatSidebarProps {
  sessions: ChatSession[];
  currentId: string | null;
  search: string;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onSearchChange: (value: string) => void;
}

export default function ChatSidebar({
  sessions,
  currentId,
  search,
  onNewChat,
  onSelectSession,
  onDeleteSession,
  onSearchChange,
}: ChatSidebarProps) {
  const groups = groupSessionsByDate(
    sessions.filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <aside className="aib-sidebar-in" style={{
      width: "256px",
      background: "#0c0c0f",
      borderRight: "1px solid rgba(255,255,255,0.07)",
      display: "flex", flexDirection: "column", flexShrink: 0,
    }}>
      {/* New chat */}
      <div style={{ padding: "12px 10px 6px" }}>
        <button
          className="aib-new-chat"
          onClick={onNewChat}
          style={{
            width: "100%", display: "flex", alignItems: "center", gap: "9px",
            padding: "9px 13px", borderRadius: "10px", cursor: "pointer",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.7)", fontSize: "12.5px", fontWeight: 600,
            fontFamily: "'Sora', sans-serif", transition: "all 0.18s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            e.currentTarget.style.color = "rgba(255,255,255,0.9)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            e.currentTarget.style.color = "rgba(255,255,255,0.7)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
          }}
        >
          <Plus size={14} /> New chat
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "4px 10px 8px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "9px", padding: "7px 11px",
          transition: "border-color 0.15s",
        }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)")}
        >
          <Search size={13} color="rgba(255,255,255,0.2)" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search chats…"
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: "12px", color: "rgba(255,255,255,0.6)",
              fontFamily: "'Sora', sans-serif",
            }}
          />
        </div>
      </div>

      {/* History list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 60px" }}>
        {groups.length === 0 ? (
          <div style={{ padding: "40px 16px", textAlign: "center" }}>
            <MessageSquare size={26} style={{ color: "rgba(255,255,255,0.06)", marginBottom: "10px" }} />
            <p style={{ margin: 0, fontSize: "12px", color: "rgba(255,255,255,0.15)", fontFamily: "'Sora', sans-serif" }}>No conversations yet</p>
          </div>
        ) : groups.map(group => (
          <div key={group.label} style={{ marginBottom: "2px" }}>
            <div style={{
              fontSize: "9.5px", fontWeight: 700, color: "rgba(255,255,255,0.2)",
              textTransform: "uppercase", letterSpacing: "0.1em",
              padding: "10px 6px 5px",
            }}>
              {group.label}
            </div>
            {group.items.map(session => (
              <div
                key={session.id}
                className="aib-sidebar-item"
                onClick={() => onSelectSession(session.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 10px", borderRadius: "8px", cursor: "pointer",
                  background: currentId === session.id
                    ? "rgba(255,255,255,0.08)"
                    : "transparent",
                  border: `1px solid ${currentId === session.id ? "rgba(255,255,255,0.12)" : "transparent"}`,
                  position: "relative",
                }}
              >
                <MessageSquare size={12} color={currentId === session.id ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.2)"} style={{ flexShrink: 0 }} />
                <span style={{
                  flex: 1, fontSize: "12px",
                  color: currentId === session.id ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.42)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  lineHeight: 1.4, fontFamily: "'Sora', sans-serif",
                }}>
                  {session.title}
                </span>
                <button
                  className="aib-del-btn"
                  onClick={e => onDeleteSession(session.id, e)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.2)", padding: "2px",
                    display: "flex", opacity: 0, transition: "opacity 0.15s, color 0.15s", flexShrink: 0,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: "10px 14px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        fontSize: "10px", color: "rgba(255,255,255,0.14)", textAlign: "center",
        fontFamily: "'Sora', sans-serif",
      }}>
        {sessions.length} chat{sessions.length !== 1 ? "s" : ""} · stored locally
      </div>
    </aside>
  );
}
