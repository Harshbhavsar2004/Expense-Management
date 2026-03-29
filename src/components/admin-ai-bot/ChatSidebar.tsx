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
      width: "248px",
      background: "#000000",
      borderRight: "1px solid rgba(255,255,255,0.06)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
      fontFamily: "var(--font-sans, 'Geist', sans-serif)",
    }}>

      {/* Header */}
      <div style={{
        padding: "16px 12px 8px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        {/* Logo mark */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "0 4px",
          marginBottom: "12px",
        }}>
          <div style={{
            width: "22px",
            height: "22px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <MessageSquare size={11} color="rgba(255,255,255,0.6)" />
          </div>
          <span style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "-0.01em",
          }}>
            Chats
          </span>
        </div>

        {/* New chat */}
        <button
          className="aib-new-chat"
          onClick={onNewChat}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 11px",
            borderRadius: "8px",
            cursor: "pointer",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.6)",
            fontSize: "12px",
            fontWeight: 500,
            fontFamily: "var(--font-sans, 'Geist', sans-serif)",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.09)";
            e.currentTarget.style.color = "rgba(255,255,255,0.85)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          }}
        >
          <Plus size={13} strokeWidth={2} />
          New conversation
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 12px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "7px",
            padding: "6px 10px",
            transition: "border-color 0.15s",
          }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)")}
          onBlurCapture={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")}
        >
          <Search size={12} color="rgba(255,255,255,0.18)" />
          <input
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "12px",
              color: "rgba(255,255,255,0.6)",
              fontFamily: "var(--font-sans, 'Geist', sans-serif)",
            }}
          />
        </div>
      </div>

      {/* History list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px 60px" }}>
        {groups.length === 0 ? (
          <div style={{ padding: "48px 16px", textAlign: "center" }}>
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
            }}>
              <MessageSquare size={14} color="rgba(255,255,255,0.15)" />
            </div>
            <p style={{
              margin: 0,
              fontSize: "11.5px",
              color: "rgba(255,255,255,0.18)",
              fontFamily: "var(--font-sans, 'Geist', sans-serif)",
            }}>
              No conversations yet
            </p>
          </div>
        ) : groups.map(group => (
          <div key={group.label} style={{ marginBottom: "4px" }}>
            <div style={{
              fontSize: "9px",
              fontWeight: 600,
              color: "rgba(255,255,255,0.18)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              padding: "10px 6px 4px",
              fontFamily: "var(--font-sans, 'Geist', sans-serif)",
            }}>
              {group.label}
            </div>
            {group.items.map(session => (
              <div
                key={session.id}
                className="aib-sidebar-item"
                onClick={() => onSelectSession(session.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 9px",
                  borderRadius: "7px",
                  cursor: "pointer",
                  background: currentId === session.id
                    ? "rgba(255,255,255,0.07)"
                    : "transparent",
                  border: `1px solid ${currentId === session.id
                    ? "rgba(255,255,255,0.09)"
                    : "transparent"}`,
                  position: "relative",
                  transition: "all 0.12s ease",
                }}
              >
                <div style={{
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  background: currentId === session.id
                    ? "rgba(255,255,255,0.5)"
                    : "rgba(255,255,255,0.15)",
                  flexShrink: 0,
                  transition: "background 0.15s",
                }} />
                <span style={{
                  flex: 1,
                  fontSize: "12px",
                  color: currentId === session.id
                    ? "rgba(255,255,255,0.82)"
                    : "rgba(255,255,255,0.38)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  lineHeight: 1.4,
                  fontFamily: "var(--font-sans, 'Geist', sans-serif)",
                  fontWeight: currentId === session.id ? 500 : 400,
                }}>
                  {session.title}
                </span>
                <button
                  className="aib-del-btn"
                  onClick={e => onDeleteSession(session.id, e)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "rgba(255,255,255,0.18)",
                    padding: "2px",
                    display: "flex",
                    opacity: 0,
                    transition: "opacity 0.12s, color 0.12s",
                    flexShrink: 0,
                    borderRadius: "4px",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#ff4444")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.18)")}
                >
                  <Trash2 size={11} />
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
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
      }}>
        <div style={{
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
        }} />
        <span style={{
          fontSize: "10px",
          color: "rgba(255,255,255,0.16)",
          fontFamily: "var(--font-sans, 'Geist', sans-serif)",
          letterSpacing: "0.02em",
        }}>
          {sessions.length} chat{sessions.length !== 1 ? "s" : ""} · stored locally
        </span>
      </div>
    </aside>
  );
}