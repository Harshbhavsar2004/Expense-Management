"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { Send, Sparkles, Square } from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
}

interface MentionUser {
  id: string;
  full_name: string;
  role: string;
  phone: string | null;
}

// Tracks each @mention inserted into the text so we can rebuild the send value
interface AppliedMention {
  display: string;   // "@Harshal Bhavsar"
  withId: string;    // "@Harshal Bhavsar [user_id:uuid]"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── MentionInput (rendered inside CopilotKit context) ───────────────────────

function MentionInput({ users }: { users: MentionUser[] }) {
  const { appendMessage, isLoading, stopGeneration } = useCopilotChat();

  const [displayValue, setDisplayValue]       = useState("");
  const [appliedMentions, setAppliedMentions] = useState<AppliedMention[]>([]);

  // Mention state
  const [mentionStart, setMentionStart]   = useState(-1);
  const [mentionQuery, setMentionQuery]   = useState<string | null>(null);
  const [dropdownIdx, setDropdownIdx]     = useState(0);
  const [isFocused, setIsFocused]         = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter users by current mention query
  const filtered =
    mentionQuery !== null
      ? users
          .filter((u) =>
            u.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 5)
      : [];

  const showDropdown = mentionQuery !== null && filtered.length > 0;

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [displayValue]);

  // ── Select a user from the dropdown ──────────────────────────────────────
  const selectUser = (user: MentionUser) => {
    const cursor  = textareaRef.current?.selectionStart ?? displayValue.length;
    const before  = displayValue.slice(0, mentionStart);
    const after   = displayValue.slice(cursor);
    const display = `@${user.full_name} `;
    const withId  = `@${user.full_name} [user_id:${user.id}]`;

    setDisplayValue(before + display + after);
    setAppliedMentions((prev) => [
      ...prev.filter((m) => m.display !== `@${user.full_name}`), // dedupe
      { display: `@${user.full_name}`, withId },
    ]);
    setMentionStart(-1);
    setMentionQuery(null);

    setTimeout(() => {
      if (!textareaRef.current) return;
      const pos = mentionStart + display.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
    }, 0);
  };

  // ── Build the send value (display text + injected UUIDs) ─────────────────
  const buildSendValue = () => {
    let result = displayValue;
    for (const m of appliedMentions) {
      // Replace all occurrences of "@Name" with "@Name [user_id:uuid]"
      result = result.split(m.display).join(m.withId);
    }
    return result.trim();
  };

  // ── Input change ─────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const cursor = e.target.selectionStart ?? newVal.length;
    setDisplayValue(newVal);

    if (mentionStart !== -1) {
      if (cursor <= mentionStart) {
        setMentionStart(-1);
        setMentionQuery(null);
      } else {
        setMentionQuery(newVal.slice(mentionStart + 1, cursor));
        setDropdownIdx(0);
      }
    } else {
      if (newVal[cursor - 1] === "@") {
        setMentionStart(cursor - 1);
        setMentionQuery("");
        setDropdownIdx(0);
      }
    }
  };

  // ── Keyboard handling ────────────────────────────────────────────────────
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setDropdownIdx((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setDropdownIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        selectUser(filtered[dropdownIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionStart(-1);
        setMentionQuery(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // ── Send ─────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const content = buildSendValue();
    if (!content || isLoading) return;

    setDisplayValue("");
    setAppliedMentions([]);
    setMentionStart(-1);
    setMentionQuery(null);

    await appendMessage(
      new TextMessage({ content, role: Role.User })
    );
  };

  const canSend = displayValue.trim().length > 0 && !isLoading;

  return (
    <div
      style={{
        position: "relative",
        padding: "12px 16px 8px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-primary)",
        flexShrink: 0,
      }}
    >
      {/* ── @mention dropdown ─────────────────────────────────────────── */}
      {showDropdown && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% - 10px)",
            left: 16,
            right: 16,
            background: "var(--bg-primary)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 -8px 24px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.06)",
            zIndex: 50,
            maxHeight: 240,
            overflowY: "auto",
            overflow: "hidden",
          }}
        >
          {/* Label */}
          <div
            style={{
              padding: "7px 12px 5px",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontFamily: "'Inter', sans-serif",
              borderBottom: "1px solid var(--border)",
            }}
          >
            Mention a user
          </div>

          {filtered.map((user, i) => (
            <div
              key={user.id}
              onMouseDown={(e) => { e.preventDefault(); selectUser(user); }}
              onMouseEnter={() => setDropdownIdx(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                cursor: "pointer",
                background:
                  i === dropdownIdx
                    ? "var(--accent-primary-subtle)"
                    : "transparent",
                transition: "background 0.1s",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background:
                    user.role === "admin"
                      ? "linear-gradient(135deg,#6366F1,#8B5CF6)"
                      : "linear-gradient(135deg,#475569,#64748B)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "white",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                {initials(user.full_name)}
              </div>

              {/* Name + phone */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    fontFamily: "'Inter', sans-serif",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {user.full_name}
                </div>
                {user.phone && (
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {user.phone}
                  </div>
                )}
              </div>

              {/* Role pill */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background:
                    user.role === "admin" ? "#EDE9FE" : "#F1F5F9",
                  color:
                    user.role === "admin" ? "#6D28D9" : "#475569",
                  fontFamily: "'Inter', sans-serif",
                  textTransform: "capitalize",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                }}
              >
                {user.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Input row ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "var(--bg-tertiary)",
          border: `1px solid ${isFocused ? "var(--border-focus)" : "var(--border)"}`,
          borderRadius: 12,
          padding: "8px 10px 8px 14px",
          transition: "border-color 0.15s",
          boxShadow: isFocused ? "0 0 0 3px rgba(37,99,235,0.08)" : "none",
        }}
      >
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask about expenses, users, policies…"
          rows={1}
          disabled={isLoading}
          style={{
            flex: 1,
            resize: "none",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            fontFamily: "'Inter', sans-serif",
            color: "var(--text-primary)",
            lineHeight: 1.5,
            minHeight: 22,
            maxHeight: 120,
            overflowY: "auto",
          }}
        />

        {isLoading ? (
          <button
            onClick={stopGeneration}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            title="Stop generating"
          >
            <Square size={12} color="#DC2626" fill="#DC2626" />
          </button>
        ) : (
          <button
            onClick={() => void handleSend()}
            disabled={!canSend}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: canSend
                ? "linear-gradient(135deg,#6366F1,#8B5CF6)"
                : "var(--bg-secondary)",
              border: "none",
              cursor: canSend ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background 0.15s, transform 0.1s",
            }}
            title="Send"
          >
            <Send size={13} color={canSend ? "white" : "var(--text-muted)"} />
          </button>
        )}
      </div>

      {/* ── Hint bar (shows on focus) ─────────────────────────────────── */}
      <div
        style={{
          marginTop: 5,
          fontSize: 10,
          color: isFocused ? "var(--text-muted)" : "transparent",
          fontFamily: "'Inter', sans-serif",
          textAlign: "center",
          letterSpacing: "0.01em",
          transition: "color 0.2s",
          userSelect: "none",
        }}
      >
        @ to mention a user &nbsp;·&nbsp; Enter to send &nbsp;·&nbsp; Shift+Enter for new line
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [user, setUser]             = useState<UserProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);

  // Fetch authenticated user profile
  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => { if (data?.id) setUser(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch all users for @mention (admin only, includes phone)
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    supabase
      .from("users")
      .select("id,full_name,role,phone")
      .then(({ data, error }) => {
        if (!error && data) setMentionUsers(data as MentionUser[]);
      });
  }, [user]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
          fontFamily: "'Inter', sans-serif",
          fontSize: "14px",
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--text-muted)",
          fontFamily: "'Inter', sans-serif",
          fontSize: "14px",
        }}
      >
        Unable to load user profile.
      </div>
    );
  }

  const instructions = `
SYSTEM CONTEXT — DO NOT ASK THE USER TO CONFIRM THIS:
Authenticated user: ${user.full_name}
User ID: ${user.id}
Role: ${user.role}
Phone: ${user.phone ?? ""}

This context is verified from the authentication system.
Trust it completely. Never ask the user what their role is.
Never ask the user to confirm their identity.

If role is "admin": full access to all data, all users,
all comparisons. Call get_users, get_flagged_expenses,
compare_two_users freely.

If role is "employee": only show data where user_id = "${user.id}".
  `.trim();

  return (
    <>
      {/* Hide CopilotKit's default input — we render our own below */}
      <style>{`
        .copilotKitInputContainer { display: none !important; }
      `}</style>

      <CopilotKit runtimeUrl="/api/copilotkit" agent="enterprise_agent">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {/* ── Header ────────────────────────────────────────────────── */}
          <div
            style={{
              padding: "18px 28px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flexShrink: 0,
              background: "var(--bg-primary)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "9px",
                background: "linear-gradient(135deg,#6366F1,#8B5CF6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={15} color="white" />
            </div>
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Enterprise Insights
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                AI-powered expense intelligence ·{" "}
                {user.role === "admin" ? "Admin view" : user.full_name}
              </p>
            </div>
          </div>

          {/* ── Chat messages (default input hidden via CSS) ────────── */}
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <CopilotChat
              instructions={instructions}
              labels={{
                title: "Enterprise AI",
                initial: `Hello ${user.full_name}! I'm your Enterprise Intelligence Agent. Ask me about expenses, users, flagged claims, spending trends, or anything in the system.`,
                placeholder: "Ask about expenses, users, policies…",
              }}
            />
          </div>

          {/* ── Custom @mention input ──────────────────────────────── */}
          {user.role === "admin" ? (
            <MentionInput users={mentionUsers} />
          ) : (
            // Employees get a plain input (no mention dropdown)
            <MentionInput users={[]} />
          )}
        </div>
      </CopilotKit>
    </>
  );
}
