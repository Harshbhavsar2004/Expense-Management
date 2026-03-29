"use client";

import { Sparkles, FileText, User, Mic, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { ChatMessage, DashboardSpec } from "@/types";
import DashboardRenderer from "@/components/DashboardRenderer";

interface MessageBubbleProps {
  msg: ChatMessage;
  idx: number;
}

function tryParseDashboard(content: string): DashboardSpec | null {
  if (!content.startsWith('{"type":"dashboard"')) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.type === "dashboard" && Array.isArray(parsed.charts)) {
      return parsed as DashboardSpec;
    }
  } catch { /* not valid JSON dashboard */ }
  return null;
}

function extractDashboardLinks(content: string): { id: string; title: string; raw: string }[] {
  const regex = /\[dashboard_id:([^\]]+)\]([^[\n\r]*)/g;
  const links: { id: string; title: string; raw: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({ id: match[1], title: match[2].trim() || "Dashboard", raw: match[0] });
  }
  return links;
}

export default function MessageBubble({ msg, idx }: MessageBubbleProps) {
  const dashboardSpec = msg.role === "assistant" ? tryParseDashboard(msg.content) : null;
  const dashboardLinks = msg.role === "assistant" ? extractDashboardLinks(msg.content) : [];

  let cleanContent = msg.content;
  if (dashboardLinks.length > 0) {
    dashboardLinks.forEach(link => { cleanContent = cleanContent.replace(link.raw, ""); });
    cleanContent = cleanContent.trim();
  }

  return (
    <div
      className="aib-msg-in"
      style={{
        display: "flex",
        flexDirection: msg.role === "user" ? "row-reverse" : "row",
        gap: "12px",
        alignItems: "flex-start",
        marginBottom: "24px",
        width: "100%",
        animationDelay: `${Math.min(idx, 6) * 0.04}s`,
        fontFamily: "var(--font-sans, 'Geist', sans-serif)",
      }}
    >
      {/* Avatar */}
      {msg.role === "assistant" ? (
        <div style={{
          width: "28px",
          height: "28px",
          borderRadius: "7px",
          flexShrink: 0,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "2px",
        }}>
          <Sparkles size={13} color="rgba(255,255,255,0.6)" strokeWidth={1.5} />
        </div>
      ) : (
        <div style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "7px",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.11)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <User size={13} color="rgba(255,255,255,0.65)" strokeWidth={1.5} />
          </div>
          {msg.isVoice && (
            <div style={{
              position: "absolute",
              bottom: "-2px",
              right: "-2px",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#22c55e",
              border: "2px solid #0a0a0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Mic size={6} color="white" strokeWidth={2.5} />
            </div>
          )}
        </div>
      )}

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        alignItems: msg.role === "user" ? "flex-end" : "flex-start",
        maxWidth: "80%",
      }}>
        {/* Label */}
        <span style={{
          fontSize: "10px",
          fontWeight: 500,
          color: "rgba(255,255,255,0.20)",
          marginBottom: "1px",
          letterSpacing: "0.04em",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          textTransform: "uppercase",
        }}>
          {msg.role === "user" ? "You" : "Expify AI"}
          {msg.isVoice && (
            <span style={{
              fontSize: "8.5px",
              color: "#22c55e",
              background: "rgba(34,197,94,0.07)",
              border: "1px solid rgba(34,197,94,0.15)",
              borderRadius: "6px",
              padding: "1px 5px",
              display: "inline-flex",
              alignItems: "center",
              gap: "2px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}>
              <Mic size={6} /> voice
            </span>
          )}
        </span>

        {/* Attached files */}
        {msg.files && msg.files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "2px" }}>
            {msg.files.map((f, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 9px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                {f.type === "image" && f.url
                  ? <img src={f.url} alt={f.name} style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "5px" }} />
                  : <FileText size={13} color="rgba(255,255,255,0.35)" />
                }
                <span style={{
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.35)",
                  maxWidth: "90px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {f.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {msg.role === "user" ? (
          msg.content && (
            <div className="aib-user-bubble" style={{
              padding: "10px 15px",
              borderRadius: "14px 14px 4px 14px",
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
              fontSize: "13.5px",
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.85)",
              fontFamily: "var(--font-sans, 'Geist', sans-serif)",
            }}>
              {msg.content}
            </div>
          )
        ) : dashboardSpec ? (
          <DashboardRenderer spec={dashboardSpec} />
        ) : (dashboardLinks.length > 0 || cleanContent) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {dashboardLinks.map((link, i) => (
              <Link
                key={i}
                href={`/admin/dashboard/${link.id}`}
                target="_blank"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "11px 15px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: "12px",
                  textDecoration: "none",
                  color: "white",
                  transition: "all 0.15s",
                  cursor: "pointer",
                  width: "fit-content",
                  minWidth: "200px",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)";
                }}
              >
                <div style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <ExternalLink size={15} color="rgba(255,255,255,0.6)" />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>
                    {link.title}
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
                    View dashboard
                  </span>
                </div>
              </Link>
            ))}

            {cleanContent && (
              <div
                className="expify-md"
                style={{ fontSize: "13.5px", lineHeight: 1.75, color: "rgba(255,255,255,0.72)" }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: (props) => <h1 style={{ fontSize: "1.2rem", margin: "12px 0 6px", color: "rgba(255,255,255,0.92)", fontWeight: 600, letterSpacing: "-0.02em" }} {...props} />,
                    h2: (props) => <h2 style={{ fontSize: "1.1rem", margin: "10px 0 5px", color: "rgba(255,255,255,0.88)", fontWeight: 600 }} {...props} />,
                    h3: (props) => <h3 style={{ fontSize: "1rem", margin: "8px 0 4px", color: "rgba(255,255,255,0.82)", fontWeight: 600 }} {...props} />,
                    h4: (props) => <h4 style={{ fontSize: "0.95rem", margin: "6px 0 3px", color: "rgba(255,255,255,0.78)" }} {...props} />,
                    h5: (props) => <h5 style={{ fontSize: "0.9rem", margin: "4px 0 2px", color: "rgba(255,255,255,0.72)" }} {...props} />,
                    h6: (props) => <h6 style={{ fontSize: "0.85rem", margin: "2px 0 1px", color: "rgba(255,255,255,0.55)", textTransform: "uppercase", letterSpacing: "0.06em" }} {...props} />,
                    a: (props) => <a style={{ color: "rgba(255,255,255,0.85)", textDecoration: "underline", textUnderlineOffset: "3px", textDecorationColor: "rgba(255,255,255,0.25)" }} target="_blank" rel="noopener noreferrer" {...props} />,
                    hr: (props) => <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.07)", margin: "14px 0" }} {...props} />,
                    table: (props) => (
                      <div style={{ overflowX: "auto", margin: "10px 0", borderRadius: "9px", border: "1px solid rgba(255,255,255,0.07)" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "12.5px" }} {...props} />
                      </div>
                    ),
                    thead: (props) => <thead style={{ background: "rgba(255,255,255,0.03)" }} {...props} />,
                    th: (props) => <th style={{ padding: "7px 12px", borderBottom: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.75)", fontWeight: 600, whiteSpace: "nowrap", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }} {...props} />,
                    td: (props) => <td style={{ padding: "6px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }} {...props} />,
                    p: (props) => <p style={{ margin: "4px 0", color: "rgba(255,255,255,0.72)" }} {...props} />,
                    strong: (props) => <strong style={{ color: "rgba(255,255,255,0.92)", fontWeight: 600 }} {...props} />,
                    ul: (props) => <ul style={{ paddingLeft: "16px", margin: "5px 0" }} {...props} />,
                    li: (props) => <li style={{ margin: "3px 0", color: "rgba(255,255,255,0.65)" }} {...props} />,
                    code: (props) => <code style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px", padding: "1px 5px", fontSize: "12px", fontFamily: "var(--font-mono, 'Geist Mono', monospace)", color: "rgba(255,255,255,0.72)" }} {...props} />,
                    pre: (props) => <pre style={{ background: "rgba(255,255,255,0.03)", borderRadius: "9px", padding: "12px 15px", overflow: "auto", border: "1px solid rgba(255,255,255,0.06)", margin: "8px 0" }} {...props} />,
                  }}
                >
                  {cleanContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          /* Loading state */
          <div style={{
            padding: "12px 16px",
            borderRadius: "14px 14px 14px 4px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            minWidth: "140px",
          }}>
            <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
              {[0, 140, 280].map(d => (
                <span key={d} className="dot-bounce" style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.35)",
                  display: "inline-block",
                  animationDelay: `${d}ms`,
                  flexShrink: 0,
                }} />
              ))}
            </div>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontWeight: 400 }}>
              Thinking…
            </span>
          </div>
        )}

        {/* Timestamp */}
        <span style={{
          fontSize: "9.5px",
          color: "rgba(255,255,255,0.14)",
          letterSpacing: "0.02em",
          marginTop: "1px",
        }}>
          {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}