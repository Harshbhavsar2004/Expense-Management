"use client";

import { RefObject, ReactNode } from "react";
import { 
  Paperclip, 
  FileText, 
  X, 
  Volume2, 
  ArrowUp, 
  Plug, 
  Mail, 
  MessageSquare, 
  Calendar, 
  Github,
  BookOpen,
  HardDrive
} from "lucide-react";
import type { AttachedFile } from "@/types";

interface ChatInputProps {
  input: string;
  attachedFiles: AttachedFile[];
  showMentionDropdown: boolean;
  canSend: boolean;
  agentOpen: boolean;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAttach: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: (id: string) => void;
  onToggleAgent: () => void;
  onManageConnectors: () => void;
  connectedToolkits?: string[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  mentionDropdown: ReactNode;
}

const TOOLKIT_ICONS: Record<string, ReactNode> = {
  gmail: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4.5v15c0 .85-.65 1.5-1.5 1.5H21V7.39l-9 6.22-9-6.22V21H2.5c-.85 0-1.5-.65-1.5-1.5v-15c0-.85.66-1.5 1.5-1.5H4l8 5.54L20 3h1.5c.85 0 1.5.65 1.5 1.5z" fill="#EA4335"/>
    </svg>
  ),
  slack: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2.5 7.5a2.5 2.5 0 0 0 0 5H5v-2.5a2.5 2.5 0 0 0-2.5-2.5zM9 2a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0zm2.5 2.5v2.5H14a2.5 2.5 0 1 0 0-5h-2.5zM19 9a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm-2.5 2.5V14H19a2.5 2.5 0 1 0 0-5h-2.5zM15 22a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zm2.5-2.5a2.5 2.5 0 0 0 0-5H15v2.5a2.5 2.5 0 0 0 2.5 2.5z" fill="#36C5F0"/>
      <path d="M11 11H9v2h2v-2z" fill="#2EB67D"/>
      <path d="M15 11h-2v2h2v-2z" fill="#E01E5A"/>
      <path d="M11 7H9v2h2V7z" fill="#ECB22E"/>
    </svg>
  ),
  google_calendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-2-7h-5v5h5v-5z" fill="#4285F4"/>
    </svg>
  ),
  googlecalendar: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm-2-7h-5v5h5v-5z" fill="#4285F4"/>
    </svg>
  ),
  github: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="#ffffff" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.011-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  ),
};

export default function ChatInput({
  input,
  attachedFiles,
  showMentionDropdown,
  canSend,
  agentOpen,
  onChange,
  onKeyDown,
  onSend,
  onAttach,
  onRemoveFile,
  onToggleAgent,
  onManageConnectors,
  connectedToolkits = [],
  textareaRef,
  fileInputRef,
  mentionDropdown,
}: ChatInputProps) {
  return (
    <div style={{
      padding: "10px 28px 20px",
      background: "rgba(10,10,12,0.95)",
      backdropFilter: "blur(16px)",
      flexShrink: 0,
    }}>
      <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}>

        {/* @mention dropdown */}
        {showMentionDropdown && mentionDropdown}

        {/* File chips */}
        {attachedFiles.length > 0 && (
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "7px",
            marginBottom: "8px", padding: "8px 10px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "12px", border: "1px solid rgba(255,255,255,0.06)",
          }}>
            {attachedFiles.map(f => (
              <div key={f.id} className="aib-chip" style={{
                display: "flex", alignItems: "center", gap: "7px",
                padding: "5px 9px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.07)", borderRadius: "8px",
                transition: "all 0.15s",
              }}>
                {f.type === "image" && f.preview
                  ? <img src={f.preview} alt={f.file.name} style={{ width: "26px", height: "26px", objectFit: "cover", borderRadius: "4px" }} />
                  : <FileText size={14} color="rgba(255,255,255,0.45)" />
                }
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", maxWidth: "100px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.file.name}
                </span>
                <button
                  onClick={() => onRemoveFile(f.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.2)", display: "flex", padding: "1px", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
                  onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.2)")}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input box */}
        <div
          className="aib-input-wrap"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: "16px", padding: "10px 12px",
            display: "flex", alignItems: "flex-end", gap: "6px",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        >
          {/* Attach */}
          <button
            className="aib-action-btn"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            style={{ display: "none" }}
            onChange={onAttach}
          />

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Ask Expify AI anything…"
            rows={1}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              resize: "none", fontSize: "14px", color: "rgba(255,255,255,0.85)",
              fontFamily: "'Sora', sans-serif", lineHeight: "1.6",
              padding: "4px 0", maxHeight: "180px", overflowY: "auto",
            }}
          />

          {/* Voice Agent toggle */}
          <button
            className={`aib-action-btn ${agentOpen ? "active" : ""}`}
            onClick={onToggleAgent}
            title="Voice Agent"
          >
            <Volume2 size={18} />
          </button>

          {/* Send */}
          <button
            className="aib-send-btn"
            onClick={onSend}
            disabled={!canSend}
            title="Send"
            style={{
              background: canSend
                ? "rgba(255,255,255,0.92)"
                : "rgba(255,255,255,0.06)",
              border: "none", borderRadius: "12px", padding: "9px 11px",
              cursor: canSend ? "pointer" : "not-allowed",
              color: canSend ? "#0a0a0c" : "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <ArrowUp size={18} strokeWidth={2.5} />
          </button>
        </div>

        {/* Connectors / Integrations - Below Input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "12px",
          padding: "0 4px",
          flexWrap: "wrap",
          minHeight: "32px"
        }}>
          {connectedToolkits.length > 0 ? (
            <>
              <div 
                onClick={onManageConnectors}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "6px 12px",
                  background: "rgba(139, 92, 246, 0.08)",
                  border: "1px solid rgba(139, 92, 246, 0.2)",
                  borderRadius: "100px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(139, 92, 246, 0.12)";
                  e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(139, 92, 246, 0.08)";
                  e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.2)";
                }}
              >
                <Plug size={13} color="#A78BFA" />
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "#A78BFA", letterSpacing: "0.01em" }}>
                  {connectedToolkits.length} {connectedToolkits.length === 1 ? 'Tool' : 'Tools'} Active
                </span>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {connectedToolkits.map(t => (
                  <div 
                    key={t} 
                    title={t}
                    style={{ 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "30px",
                      height: "30px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      color: "#A78BFA",
                      transition: "transform 0.2s"
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                  >
                    {TOOLKIT_ICONS[t.toLowerCase()] || <Plug size={15} />}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div 
              onClick={onManageConnectors}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "7px",
                padding: "6px 12px",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                borderRadius: "100px",
                cursor: "pointer",
                color: "rgba(255, 255, 255, 0.3)",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.5)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                e.currentTarget.style.color = "rgba(255, 255, 255, 0.3)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
              }}
            >
              <Plug size={13} />
              <span style={{ fontSize: "11px", fontWeight: 500 }}>Add your tools to enhance AI capabilities</span>
            </div>
          )}
        </div>

        <p style={{
          margin: "12px 0 0", textAlign: "center", fontSize: "10.5px",
          color: "rgba(255,255,255,0.12)", fontFamily: "'Sora', sans-serif",
          letterSpacing: "0.02em",
        }}>
          @ to mention a user &nbsp;·&nbsp; Enter to send &nbsp;·&nbsp; Shift+Enter for new line &nbsp;·&nbsp; Supports images &amp; PDFs
        </p>
      </div>
    </div>
  );
}
