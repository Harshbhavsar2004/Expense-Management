"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Paperclip, Mic, MicOff, Send, X, FileText, Sparkles,
  BarChart3, FileCheck, Users, TrendingUp, ArrowUpRight,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

/* ─────────────────────────── Types ─────────────────────────── */

interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "pdf" | "other";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  files?: { name: string; type: string; url?: string }[];
  timestamp: Date;
}

/* ──────────────────────── Suggestions ──────────────────────── */

const SUGGESTIONS = [
  {
    icon: <BarChart3 size={17} />,
    title: "Expense Summary",
    desc: "Show me this month's expense breakdown by category",
    color: "#6366F1",
    gradient: "rgba(99,102,241,0.12)",
  },
  {
    icon: <FileCheck size={17} />,
    title: "Pending Approvals",
    desc: "Which applications are waiting for my review?",
    color: "#F97316",
    gradient: "rgba(249,115,22,0.12)",
  },
  {
    icon: <TrendingUp size={17} />,
    title: "Spending Trends",
    desc: "Analyze spending patterns and flag anomalies",
    color: "#10B981",
    gradient: "rgba(16,185,129,0.12)",
  },
  {
    icon: <Users size={17} />,
    title: "Employee Report",
    desc: "Who are the top spenders this quarter?",
    color: "#3B82F6",
    gradient: "rgba(59,130,246,0.12)",
  },
];

/* ─────────────────────────── Page ──────────────────────────── */

export default function AdminDashboard() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;

  /* Auto-scroll */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* File attach */
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: AttachedFile[] = files.map((file) => {
      const type = file.type.startsWith("image/")
        ? "image"
        : file.type === "application/pdf"
        ? "pdf"
        : "other";
      return {
        id: Math.random().toString(36).slice(2),
        file,
        preview: type === "image" ? URL.createObjectURL(file) : undefined,
        type,
      };
    });
    setAttachedFiles((prev) => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => {
      const removed = prev.find((f) => f.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((f) => f.id !== id);
    });
  };

  /* Send message */
  const handleSend = useCallback(
    async (content: string = input) => {
      const trimmed = content.trim();
      if (!trimmed && attachedFiles.length === 0) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
        files: attachedFiles.map((f) => ({
          name: f.file.name,
          type: f.type,
          url: f.preview,
        })),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setAttachedFiles([]);
      setIsLoading(true);

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }

      /* Simulated response — wire to real backend */
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content:
              "I'm analyzing your request. Connect this to the Expify AI backend to get live expense insights, audit summaries, and approval recommendations.",
            timestamp: new Date(),
          },
        ]);
        setIsLoading(false);
      }, 1600);
    },
    [input, attachedFiles]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const canSend = input.trim().length > 0 || attachedFiles.length > 0;

  /* ──────────────────── Render ──────────────────── */

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#0D0D0F",
        position: "relative",
      }}
    >
      {/* Quick-nav pills (top-right) */}
      {!hasMessages && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "24px",
            display: "flex",
            gap: "8px",
            zIndex: 10,
          }}
        >
          {[
            { label: "Approvals", href: "/admin/approvals", color: "#F97316" },
            { label: "All Expenses", href: "/admin/expenses", color: "#6366F1" },
            { label: "Reports", href: "/admin/reports", color: "#10B981" },
          ].map((pill) => (
            <Link key={pill.label} href={pill.href} style={{ textDecoration: "none" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 13px",
                  borderRadius: "9999px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "'Inter', sans-serif",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `${pill.color}18`;
                  e.currentTarget.style.borderColor = `${pill.color}40`;
                  e.currentTarget.style.color = pill.color;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.55)";
                }}
              >
                {pill.label} <ChevronRight size={12} />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Chat / Welcome area ── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {!hasMessages ? (
          /* ── Welcome Screen ── */
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 24px 24px",
            }}
          >
            {/* Glow */}
            <div
              style={{
                position: "absolute",
                top: "20%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "360px",
                height: "360px",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Logo mark */}
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "18px",
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "22px",
                boxShadow: "0 0 48px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.2)",
              }}
            >
              <Sparkles size={27} color="white" />
            </div>

            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "26px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.92)",
                fontFamily: "'DM Sans', sans-serif",
                textAlign: "center",
                letterSpacing: "-0.02em",
              }}
            >
              Expify Admin AI
            </h1>
            <p
              style={{
                margin: "0 0 44px",
                fontSize: "14px",
                color: "rgba(255,255,255,0.38)",
                fontFamily: "'Inter', sans-serif",
                textAlign: "center",
                maxWidth: "400px",
                lineHeight: 1.65,
              }}
            >
              Ask anything about expenses, approvals, or employees.
              Upload receipts or PDFs for instant AI analysis.
            </p>

            {/* Suggestion cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "10px",
                width: "100%",
                maxWidth: "620px",
              }}
            >
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.title}
                  onClick={() => handleSend(s.desc)}
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: "14px",
                    padding: "18px 18px 16px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.18s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = s.gradient;
                    e.currentTarget.style.borderColor = `${s.color}30`;
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                    e.currentTarget.style.transform = "translateY(0)";
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "10px",
                      background: `${s.color}18`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: s.color,
                    }}
                  >
                    {s.icon}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "rgba(255,255,255,0.82)",
                        fontFamily: "'Inter', sans-serif",
                        marginBottom: "4px",
                      }}
                    >
                      {s.title}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.35)",
                        fontFamily: "'Inter', sans-serif",
                        lineHeight: 1.45,
                      }}
                    >
                      {s.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Shortcut row */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                marginTop: "32px",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.22)",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Or go to
              </span>
              {[
                { label: "Pending Approvals", href: "/admin/approvals" },
                { label: "Employees", href: "/admin/employees" },
              ].map((lnk) => (
                <Link key={lnk.label} href={lnk.href} style={{ textDecoration: "none" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'Inter', sans-serif",
                      display: "flex",
                      alignItems: "center",
                      gap: "3px",
                      padding: "4px 10px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "9999px",
                      transition: "all 0.15s",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.7)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = "rgba(255,255,255,0.35)")
                    }
                  >
                    {lnk.label} <ArrowUpRight size={10} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          /* ── Messages ── */
          <div
            style={{
              maxWidth: "780px",
              width: "100%",
              margin: "0 auto",
              padding: "40px 24px 20px",
              display: "flex",
              flexDirection: "column",
              gap: "28px",
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: "14px",
                  flexDirection: msg.role === "user" ? "row-reverse" : "row",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg,#6366F1,#8B5CF6)"
                        : "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {msg.role === "user" ? "A" : <Sparkles size={15} />}
                </div>

                <div
                  style={{
                    maxWidth: "78%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  }}
                >
                  {/* Attached files preview */}
                  {msg.files && msg.files.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {msg.files.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            padding: "7px 11px",
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: "10px",
                            border: "1px solid rgba(255,255,255,0.09)",
                          }}
                        >
                          {f.type === "image" && f.url ? (
                            <img
                              src={f.url}
                              alt={f.name}
                              style={{ width: "52px", height: "52px", objectFit: "cover", borderRadius: "6px" }}
                            />
                          ) : (
                            <FileText size={15} color="#F97316" />
                          )}
                          <span
                            style={{
                              fontSize: "11px",
                              color: "rgba(255,255,255,0.45)",
                              fontFamily: "'Inter', sans-serif",
                              maxWidth: "100px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {f.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bubble */}
                  {msg.content && (
                    <div
                      style={{
                        padding: "13px 17px",
                        borderRadius:
                          msg.role === "user"
                            ? "18px 18px 4px 18px"
                            : "4px 18px 18px 18px",
                        background:
                          msg.role === "user"
                            ? "linear-gradient(135deg,#6366F1,#7C3AED)"
                            : "rgba(255,255,255,0.055)",
                        border:
                          msg.role === "assistant"
                            ? "1px solid rgba(255,255,255,0.08)"
                            : "none",
                        fontSize: "14px",
                        lineHeight: 1.65,
                        color: "rgba(255,255,255,0.88)",
                        fontFamily: "'Inter', sans-serif",
                      }}
                    >
                      {msg.content}
                    </div>
                  )}

                  <span
                    style={{
                      fontSize: "10px",
                      color: "rgba(255,255,255,0.2)",
                      fontFamily: "'Inter', sans-serif",
                    }}
                  >
                    {msg.timestamp.toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}

            {/* Loading dots */}
            {isLoading && (
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div
                  style={{
                    width: "34px",
                    height: "34px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Sparkles size={15} color="rgba(255,255,255,0.6)" />
                </div>
                <div
                  style={{
                    padding: "16px 20px",
                    background: "rgba(255,255,255,0.055)",
                    borderRadius: "4px 18px 18px 18px",
                    border: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    gap: "5px",
                    alignItems: "center",
                  }}
                >
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="dot-bounce"
                      style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.4)",
                        display: "inline-block",
                        animationDelay: `${delay}ms`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input Area ── */}
      <div
        style={{
          padding: hasMessages ? "16px 24px 20px" : "20px 24px 28px",
          background: "#0D0D0F",
          borderTop: hasMessages ? "1px solid rgba(255,255,255,0.05)" : "none",
        }}
      >
        <div style={{ maxWidth: "780px", margin: "0 auto" }}>
          {/* File preview chips */}
          {attachedFiles.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "10px",
                padding: "10px 12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {attachedFiles.map((f) => (
                <div
                  key={f.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "5px 9px",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "9px",
                  }}
                >
                  {f.type === "image" && f.preview ? (
                    <img
                      src={f.preview}
                      alt={f.file.name}
                      style={{ width: "28px", height: "28px", objectFit: "cover", borderRadius: "5px" }}
                    />
                  ) : (
                    <FileText size={16} color={f.type === "pdf" ? "#F97316" : "rgba(255,255,255,0.4)"} />
                  )}
                  <span
                    style={{
                      fontSize: "12px",
                      color: "rgba(255,255,255,0.55)",
                      fontFamily: "'Inter', sans-serif",
                      maxWidth: "120px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f.file.name}
                  </span>
                  <button
                    onClick={() => removeFile(f.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "rgba(255,255,255,0.25)",
                      display: "flex",
                      padding: "1px",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Main input box */}
          <div
            style={{
              background: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "18px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
              transition: "border-color 0.2s, box-shadow 0.2s",
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(99,102,241,0.45)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.08)";
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {/* Attach button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Attach image or PDF"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "rgba(255,255,255,0.3)",
                padding: "6px",
                borderRadius: "9px",
                display: "flex",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                e.currentTarget.style.background = "none";
              }}
            >
              <Paperclip size={19} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf"
              style={{ display: "none" }}
              onChange={handleFileAttach}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize(e.target);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask about expenses, upload receipts, or request a report…"
              rows={1}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "14px",
                color: "rgba(255,255,255,0.85)",
                fontFamily: "'Inter', sans-serif",
                lineHeight: "1.6",
                padding: "5px 0",
                maxHeight: "180px",
                overflowY: "auto",
              }}
            />

            {/* Mic button */}
            <button
              onClick={() => setIsRecording((p) => !p)}
              title={isRecording ? "Stop recording" : "Voice input"}
              style={{
                background: isRecording ? "rgba(239,68,68,0.15)" : "none",
                border: isRecording ? "1px solid rgba(239,68,68,0.3)" : "none",
                cursor: "pointer",
                color: isRecording ? "#EF4444" : "rgba(255,255,255,0.3)",
                padding: "6px",
                borderRadius: "9px",
                display: "flex",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.color = "rgba(255,255,255,0.75)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isRecording) {
                  e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                  e.currentTarget.style.background = "none";
                }
              }}
            >
              {isRecording ? <MicOff size={19} /> : <Mic size={19} />}
            </button>

            {/* Send button */}
            <button
              onClick={() => handleSend()}
              disabled={!canSend}
              style={{
                background: canSend
                  ? "linear-gradient(135deg,#6366F1,#7C3AED)"
                  : "rgba(255,255,255,0.06)",
                border: "none",
                borderRadius: "11px",
                padding: "9px",
                cursor: canSend ? "pointer" : "not-allowed",
                color: canSend ? "white" : "rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s",
                flexShrink: 0,
                boxShadow: canSend ? "0 0 16px rgba(99,102,241,0.35)" : "none",
              }}
            >
              <Send size={17} />
            </button>
          </div>

          {/* Footer hint */}
          <p
            style={{
              margin: "10px 0 0",
              textAlign: "center",
              fontSize: "11px",
              color: "rgba(255,255,255,0.15)",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            Press Enter to send · Shift+Enter for new line · Supports images &amp; PDFs
          </p>
        </div>
      </div>
    </div>
  );
}
