"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { CopilotKit, useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { Send, Sparkles, Square, User, AtSign, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

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

// ─── MentionInput ────────────────────────────────────────────────────────────

function MentionInput({ users }: { users: MentionUser[] }) {
  const { appendMessage, isLoading, stopGeneration } = useCopilotChat();

  const [displayValue, setDisplayValue]       = useState("");
  const [appliedMentions, setAppliedMentions] = useState<AppliedMention[]>([]);

  const [mentionStart, setMentionStart]   = useState(-1);
  const [mentionQuery, setMentionQuery]   = useState<string | null>(null);
  const [dropdownIdx, setDropdownIdx]     = useState(0);
  const [isFocused, setIsFocused]         = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filtered =
    mentionQuery !== null
      ? users
          .filter((u) =>
            u.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
          )
          .slice(0, 5)
      : [];

  const showDropdown = mentionQuery !== null && filtered.length > 0;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [displayValue]);

  const selectUser = (user: MentionUser) => {
    const cursor  = textareaRef.current?.selectionStart ?? displayValue.length;
    const before  = displayValue.slice(0, mentionStart);
    const after   = displayValue.slice(cursor);
    const display = `@${user.full_name} `;
    const withId  = `@${user.full_name} [user_id:${user.id}]`;

    setDisplayValue(before + display + after);
    setAppliedMentions((prev) => [
      ...prev.filter((m) => m.display !== `@${user.full_name}`), 
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

  const buildSendValue = () => {
    let result = displayValue;
    for (const m of appliedMentions) {
      result = result.split(m.display).join(m.withId);
    }
    return result.trim();
  };

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
    <div className="relative p-6 bg-white border-t border-zinc-200">
      {/* ── @mention dropdown ── */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute bottom-full left-6 right-6 mb-4 border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl bg-white/90"
          >
            <div className="px-4 py-2 bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <AtSign size={10} />
              Mention Employee
            </div>

            <div className="max-h-60 overflow-y-auto">
              {filtered.map((user, i) => (
                <div
                  key={user.id}
                  onMouseDown={(e) => { e.preventDefault(); selectUser(user); }}
                  onMouseEnter={() => setDropdownIdx(i)}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors",
                    i === dropdownIdx ? "bg-blue-50/50" : "transparent"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-white uppercase",
                    user.role === "admin" ? "bg-blue-600" : "bg-zinc-600"
                  )}>
                    {initials(user.full_name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-zinc-900 truncate">{user.full_name}</div>
                    {user.phone && <div className="text-[10px] text-zinc-500 font-medium">{user.phone}</div>}
                  </div>

                  <span className={cn(
                    "px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-tighter",
                    user.role === "admin" ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-600"
                  )}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={cn(
        "flex flex-col gap-2 p-1.5 bg-zinc-50 border rounded-3xl transition-all duration-300 shadow-inner",
        isFocused ? "border-blue-300 ring-4 ring-blue-50 bg-white" : "border-zinc-200"
      )}>
        <textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask about spending trends, employee compliance, or policy details..."
          rows={1}
          disabled={isLoading}
          className="flex-1 px-4 py-3 bg-transparent border-none focus:outline-none text-[15px] text-zinc-900 placeholder-zinc-400 font-medium resize-none leading-relaxed"
        />

        <div className="flex items-center justify-between px-3 pb-2 pt-1 border-t border-zinc-100/50">
          <div className="flex items-center gap-4 text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
            <span className="flex items-center gap-1.5"><AtSign size={12} /> Mention</span>
            <span className="flex items-center gap-1.5"><Info size={12} /> Shift + Enter for new line</span>
          </div>

          <div>
            {isLoading ? (
              <button
                onClick={stopGeneration}
                className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 hover:bg-rose-100 flex items-center justify-center transition-colors"
                title="Stop generating"
              >
                <Square size={16} fill="currentColor" />
              </button>
            ) : (
              <motion.button
                onClick={() => void handleSend()}
                disabled={!canSend}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md transform hover:-translate-y-0.5",
                  canSend 
                    ? "bg-blue-600 text-white hover:bg-blue-700" 
                    : "bg-zinc-200 text-zinc-400 cursor-not-allowed"
                )}
                title="Send Message"
              >
                <Send size={18} />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [user, setUser]             = useState<UserProfile | null>(null);
  const [loading, setLoading]       = useState(true);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => { if (data?.id) setUser(data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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
      <div className="flex flex-col items-center justify-center h-full gap-4 text-zinc-400">
        <div className="w-8 h-8 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs font-bold tracking-widest uppercase">Initializing Intelligence...</p>
      </div>
    );
  }

  if (!user) {
    return <div className="flex items-center justify-center h-full text-zinc-500 font-medium">Session expired. Please re-login.</div>;
  }

  const instructions = `
    SYSTEM CONTEXT:
    Authenticated user: ${user.full_name} (${user.role})
    This context is verified. Never ask the user to confirm their identity.
    Admin Mode: Full access to all organizational metrics, audit results, and employee records.
    Employee Mode: Scoped results only.
  `.trim();

  return (
    <div className="flex flex-col h-full bg-zinc-50/50">
      <style>{`
        .copilotKitInputContainer { display: none !important; }
        .copilotKitMessagesContainer { background: transparent !important; padding-bottom: 2rem !important; }
        .copilotKitMessage { border: none !important; margin-bottom: 1.5rem !important; max-width: 85% !important; }
        .copilotKitMessage--user { align-self: flex-end !important; }
        .copilotKitMessage--assistant { align-self: flex-start !important; }
        .copilotKitMessage--user .copilotKitMessageContent { 
          background: #2563eb !important; 
          color: white !important; 
          border-radius: 1.5rem 1.5rem 0.25rem 1.5rem !important; 
          font-weight: 500 !important;
          box-shadow: 0 4px 12px rgba(37,99,235,0.15) !important;
        }
        .copilotKitMessage--assistant .copilotKitMessageContent { 
          background: white !important; 
          color: #18181b !important; 
          border: 1px solid #e4e4e7 !important;
          border-radius: 1.5rem 1.5rem 1.5rem 0.25rem !important; 
          box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important;
        }
      `}</style>

      <CopilotKit runtimeUrl="/api/copilotkit" agent="enterprise_agent">
        <div className="flex flex-col h-full overflow-hidden w-full bg-white">
          {/* ── Chat Header ── */}
          <div className="px-8 py-5 flex items-center justify-between border-b border-zinc-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/20 text-white">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-zinc-900 leading-none mb-1">Enterprise Intelligence</h2>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Always Active</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-100 rounded-2xl border border-zinc-200">
               <User size={14} className="text-zinc-500" />
               <span className="text-xs font-bold text-zinc-700">{user.full_name}</span>
            </div>
          </div>

          {/* ── Chat Area ── */}
          <div className="flex-1 overflow-hidden relative flex flex-col pt-4 px-4 sm:px-8">
             <CopilotChat
                instructions={instructions}
                labels={{
                  title: "AI Insights",
                  initial: `Welcome back, ${user.full_name}. I'm synced with your ${user.role} workspace. Accessing real-time records... how can I assist you today?`,
                }}
              />
          </div>

          {/* ── Custom Input ── */}
          <MentionInput users={mentionUsers} />
        </div>
      </CopilotKit>
    </div>
  );
}
