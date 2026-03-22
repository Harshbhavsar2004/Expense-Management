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
  } catch {
    // not valid JSON dashboard
  }
  return null;
}
function extractDashboardLinks(content: string): { id: string; title: string; raw: string }[] {
  const regex = /\[dashboard_id:([^\]]+)\]([^[\n\r]*)/g;
  const links: { id: string; title: string; raw: string }[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push({
      id: match[1],
      title: match[2].trim() || "Dashboard",
      raw: match[0]
    });
  }
  return links;
}

export default function MessageBubble({ msg, idx }: MessageBubbleProps) {
  const dashboardSpec = msg.role === "assistant" ? tryParseDashboard(msg.content) : null;
  const dashboardLinks = msg.role === "assistant" ? extractDashboardLinks(msg.content) : [];
  
  // Clean up content for markdown: remove the [dashboard_id:...] triggers
  let cleanContent = msg.content;
  if (dashboardLinks.length > 0) {
    dashboardLinks.forEach(link => {
      cleanContent = cleanContent.replace(link.raw, "");
    });
    cleanContent = cleanContent.trim();
  }

  if (msg.role === "assistant" && (dashboardSpec || dashboardLinks.length > 0)) {
     console.log("[DEBUG] MessageBubble assistant content:", msg.content);
     console.log("[DEBUG] dashboardSpec:", !!dashboardSpec);
     console.log("[DEBUG] dashboardLinks count:", dashboardLinks.length);
  }

  return (
    <div
      className="aib-msg-in"
      style={{
        display: "flex",
        flexDirection: msg.role === "user" ? "row-reverse" : "row",
        gap: "14px", alignItems: "flex-start",
        marginBottom: "26px",
        width: "100%",
        animationDelay: `${Math.min(idx, 6) * 0.05}s`,
      }}
    >
      {/* Avatar */}
      {msg.role === "assistant" ? (
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%",
          flexShrink: 0,
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={14} color="rgba(255,255,255,0.7)" />
        </div>
      ) : (
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: "32px", height: "32px", borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.16)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <User size={15} color="rgba(255,255,255,0.8)" />
          </div>
          {/* Mic badge for voice messages */}
          {msg.isVoice && (
            <div style={{
              position: "absolute", bottom: "-3px", right: "-3px",
              width: "15px", height: "15px", borderRadius: "50%",
              background: "#34D399",
              border: "2px solid #0c0c14",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Mic size={7} color="white" strokeWidth={2.5} />
            </div>
          )}
        </div>
      )}

      <div style={{
        flex: 1, display: "flex", flexDirection: "column", gap: "5px",
        alignItems: msg.role === "user" ? "flex-end" : "flex-start",
        maxWidth: "82%",
      }}>
        <span style={{
          fontSize: "10.5px", fontWeight: 600,
          color: "rgba(255,255,255,0.24)",
          marginBottom: "2px", letterSpacing: "0.03em",
          display: "flex", alignItems: "center", gap: "5px",
        }}>
          {msg.role === "user" ? "You" : "Expify AI"}
          {msg.isVoice && (
            <span style={{
              fontSize: "9px", color: "#34D399",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.2)",
              borderRadius: "8px", padding: "1px 5px",
              display: "inline-flex", alignItems: "center", gap: "3px",
              fontWeight: 600,
            }}>
              <Mic size={7} /> voice
            </span>
          )}
        </span>

        {/* Files */}
        {msg.files && msg.files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {msg.files.map((f, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "6px 10px", background: "rgba(255,255,255,0.04)",
                borderRadius: "9px", border: "1px solid rgba(255,255,255,0.07)",
              }}>
                {f.type === "image" && f.url
                  ? <img src={f.url} alt={f.name} style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "5px" }} />
                  : <FileText size={14} color="rgba(255,255,255,0.5)" />
                }
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.38)", maxWidth: "90px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Message content */}
        {msg.role === "user" ? (
          msg.content && (
            <div className="aib-user-bubble" style={{
              padding: "11px 17px", borderRadius: "18px 18px 4px 18px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              fontSize: "14px", lineHeight: 1.65,
              color: "rgba(255,255,255,0.88)",
            }}>
              {msg.content}
            </div>
          )
        ) : dashboardSpec ? (
          /* Dashboard rendered inline */
          <DashboardRenderer spec={dashboardSpec} />
        ) : (dashboardLinks.length > 0 || cleanContent) ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Render any detected dashboard buttons */}
            {dashboardLinks.map((link, i) => (
              <Link
                key={i}
                href={`/admin/dashboard/${link.id}`}
                target="_blank"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "12px 18px",
                  background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
                  border: "1px solid rgba(139,92,246,0.3)",
                  borderRadius: "14px",
                  textDecoration: "none",
                  color: "white",
                  transition: "transform 0.2s, background 0.2s",
                  cursor: "pointer",
                  width: "fit-content",
                  minWidth: "200px"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.25))";
                  e.currentTarget.style.transform = "scale(1.02)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))";
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <div style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: "rgba(139,92,246,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <ExternalLink size={18} color="#A78BFA" />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#DDD" }}>
                    {link.title}
                  </span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>
                    Click here to view dashboard
                  </span>
                </div>
              </Link>
            ))}

            {/* Render remaining text content */}
            {cleanContent && (
              <div style={{
                fontSize: "14.5px", lineHeight: 1.78,
                color: "rgba(255,255,255,0.8)",
              }} className="expify-md">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                     h1: (props) => <h1 style={{ fontSize: "1.25rem", margin: "12px 0 8px", color: "rgba(255,255,255,0.95)", fontWeight: 700 }} {...props} />,
                     h2: (props) => <h2 style={{ fontSize: "1.15rem", margin: "10px 0 6px", color: "rgba(255,255,255,0.9)", fontWeight: 700 }} {...props} />,
                     h3: (props) => <h3 style={{ fontSize: "1.05rem", margin: "8px 0 4px", color: "rgba(255,255,255,0.85)", fontWeight: 600 }} {...props} />,
                     h4: (props) => <h4 style={{ fontSize: "1rem", margin: "6px 0 3px", color: "rgba(255,255,255,0.8)" }} {...props} />,
                     h5: (props) => <h5 style={{ fontSize: "0.95rem", margin: "4px 0 2px", color: "rgba(255,255,255,0.75)" }} {...props} />,
                     h6: (props) => <h6 style={{ fontSize: "0.9rem", margin: "2px 0 1px", color: "rgba(255,255,255,0.7)" }} {...props} />,
                     a: (props) => <a style={{ color: "rgba(255,255,255,0.9)", textDecoration: "underline", textUnderlineOffset: "3px", wordBreak: "break-all" }} target="_blank" rel="noopener noreferrer" {...props} />,
                     hr: (props) => <hr style={{ border: "none", borderTop: "1px solid rgba(255,255,255,0.1)", margin: "14px 0" }} {...props} />,
                    table: (props) => (
                      <div style={{ overflowX: "auto", margin: "12px 0", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "13px" }} {...props} />
                      </div>
                    ),
                    thead: (props) => <thead style={{ background: "rgba(255,255,255,0.04)" }} {...props} />,
                    th: (props) => <th style={{ padding: "8px 13px", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)", fontWeight: 600, whiteSpace: "nowrap", fontFamily: "'Sora', sans-serif" }} {...props} />,
                    td: (props) => <td style={{ padding: "7px 13px", borderBottom: "1px solid rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.65)", whiteSpace: "nowrap", fontFamily: "'Sora', sans-serif" }} {...props} />,
                    p: (props) => <p style={{ margin: "4px 0" }} {...props} />,
                    strong: (props) => <strong style={{ color: "rgba(255,255,255,0.95)", fontWeight: 700 }} {...props} />,
                    ul: (props) => <ul style={{ paddingLeft: "18px", margin: "6px 0" }} {...props} />,
                    li: (props) => <li style={{ margin: "4px 0" }} {...props} />,
                    code: (props) => <code style={{ background: "rgba(255,255,255,0.07)", borderRadius: "5px", padding: "1px 6px", fontSize: "12.5px", fontFamily: "'JetBrains Mono', monospace", color: "rgba(255,255,255,0.75)" }} {...props} />,
                    pre: (props) => <pre style={{ background: "rgba(255,255,255,0.04)", borderRadius: "10px", padding: "12px 16px", overflow: "auto", border: "1px solid rgba(255,255,255,0.07)" }} {...props} />,
                  }}
                >
                  {cleanContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ) : (
          /* Loading dots */
          <div style={{
            padding: "14px 18px", borderRadius: "18px 18px 18px 4px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
            display: "flex", flexDirection: "column", gap: "8px",
            minWidth: "160px",
          }}>
            <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
              {[0, 150, 300].map(d => (
                <span key={d} className="dot-bounce" style={{
                  width: "7px", height: "7px", borderRadius: "50%",
                  background: "rgba(255,255,255,0.4)",
                  display: "inline-block",
                  animationDelay: `${d}ms`,
                  flexShrink: 0,
                }} />
              ))}
            </div>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", fontWeight: 500 }}>
              Expify AI is thinking...
            </span>
          </div>
        )}

        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.12)", letterSpacing: "0.02em" }}>
          {new Date(msg.timestamp).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
