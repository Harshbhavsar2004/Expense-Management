"use client";

import type { MentionUser } from "@/types";
import { initials } from "@/lib/utils";

interface MentionDropdownProps {
  filteredMentions: MentionUser[];
  mentionUsers: MentionUser[];
  mentionQuery: string | null;
  mentionIdx: number;
  onSelect: (user: MentionUser) => void;
  onHover: (idx: number) => void;
}

export default function MentionDropdown({
  filteredMentions,
  mentionUsers,
  mentionQuery,
  mentionIdx,
  onSelect,
  onHover,
}: MentionDropdownProps) {
  return (
    <div style={{
      position: "absolute",
      bottom: "100%",
      left: 0,
      right: 0,
      marginBottom: "8px",
      background: "#0a0a0a",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "12px",
      boxShadow: "0 -20px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03) inset",
      zIndex: 50,
      overflow: "hidden",
      maxHeight: "260px",
      overflowY: "auto",
      fontFamily: "var(--font-sans, 'Geist', sans-serif)",
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 14px 6px",
        fontSize: "9px",
        fontWeight: 600,
        color: "rgba(255,255,255,0.2)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        Mention a user
      </div>

      {filteredMentions.length === 0 && (
        <div style={{
          padding: "14px",
          fontSize: "12px",
          color: "rgba(255,255,255,0.22)",
          textAlign: "center",
        }}>
          {mentionUsers.length === 0
            ? "Loading users…"
            : `No match for "${mentionQuery}"`
          }
        </div>
      )}

      {filteredMentions.map((user, i) => (
        <div
          key={user.id}
          className="mention-item"
          onMouseDown={e => { e.preventDefault(); onSelect(user); }}
          onMouseEnter={() => onHover(i)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "9px 14px",
            cursor: "pointer",
            background: i === mentionIdx ? "rgba(255,255,255,0.05)" : "transparent",
            transition: "background 0.1s",
          }}
        >
          {/* Avatar */}
          <div style={{
            width: "30px",
            height: "30px",
            borderRadius: "50%",
            flexShrink: 0,
            background: user.role === "admin"
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.05)",
            border: `1px solid ${user.role === "admin"
              ? "rgba(255,255,255,0.18)"
              : "rgba(255,255,255,0.08)"}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "10px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.02em",
          }}>
            {initials(user.full_name)}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.82)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {user.full_name}
            </div>
            {user.email && (
              <div style={{
                fontSize: "11px",
                color: "rgba(255,255,255,0.25)",
                marginTop: "1px",
              }}>
                {user.email}
              </div>
            )}
          </div>

          {/* Role badge */}
          <span style={{
            fontSize: "9.5px",
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: "20px",
            background: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.35)",
            textTransform: "capitalize",
            flexShrink: 0,
            border: "1px solid rgba(255,255,255,0.07)",
            letterSpacing: "0.04em",
          }}>
            {user.role}
          </span>
        </div>
      ))}
    </div>
  );
}