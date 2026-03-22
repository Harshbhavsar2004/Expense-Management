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
      position: "absolute", bottom: "100%", left: 0, right: 0,
      marginBottom: "10px",
      background: "#111114",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "14px",
      boxShadow: "0 -16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset",
      zIndex: 50, overflow: "hidden",
      maxHeight: "280px", overflowY: "auto",
    }}>
      <div style={{
        padding: "8px 14px 6px", fontSize: "9.5px", fontWeight: 700,
        color: "rgba(255,255,255,0.2)", textTransform: "uppercase",
        letterSpacing: "0.1em", borderBottom: "1px solid rgba(255,255,255,0.06)",
        fontFamily: "'Sora', sans-serif",
      }}>
        Mention a user
      </div>

      {filteredMentions.length === 0 && (
        <div style={{ padding: "12px 14px", fontSize: 12, color: "rgba(255,255,255,0.25)", textAlign: "center", fontFamily: "'Sora', sans-serif" }}>
          {mentionUsers.length === 0 ? "Loading users…" : `No match for "${mentionQuery}"`}
        </div>
      )}

      {filteredMentions.map((user, i) => (
        <div
          key={user.id}
          className="mention-item"
          onMouseDown={e => { e.preventDefault(); onSelect(user); }}
          onMouseEnter={() => onHover(i)}
          style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "9px 14px", cursor: "pointer",
            background: i === mentionIdx ? "rgba(255,255,255,0.07)" : "transparent",
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
            background: user.role === "admin"
              ? "rgba(255,255,255,0.12)"
              : "rgba(255,255,255,0.06)",
            border: user.role === "admin" ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.75)",
          }}>
            {initials(user.full_name)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(255,255,255,0.85)", fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.full_name}
            </div>
            {user.email && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", fontFamily: "'Sora', sans-serif", marginTop: 1 }}>
                {user.email}
              </div>
            )}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.45)",
            fontFamily: "'Sora', sans-serif", textTransform: "capitalize", flexShrink: 0,
            border: "1px solid rgba(255,255,255,0.1)",
          }}>
            {user.role}
          </span>
        </div>
      ))}
    </div>
  );
}
