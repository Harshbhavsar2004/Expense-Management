"use client";

import { useState, useEffect, useRef } from "react";
import { useCopilotChatHeadless_c } from "@copilotkit/react-core";
import { ShieldAlert, X, Send, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { ExpenseRow } from "./ExpensesTable";

interface AuditAgentProps {
  selectedRecord: ExpenseRow | null;
  onClose: () => void;
}

// Handles all message content formats: string, array-of-parts (AG-UI/Google ADK), or nested object
function extractContent(msg: any): string {
  const raw = msg.content;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((part: any) => part.text ?? part.content ?? "")
      .filter(Boolean)
      .join("");
  }
  return raw.content ?? raw.parts?.[0]?.text ?? "";
}

export function AuditAgent({ selectedRecord, onClose }: AuditAgentProps) {
  const { messages, sendMessage, isLoading } = useCopilotChatHeadless_c();
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastAuditedId = useRef<string | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Trigger audit analysis when a new record is selected
  useEffect(() => {
    if (!selectedRecord) return;
    if (lastAuditedId.current === selectedRecord.id) return;
    lastAuditedId.current = selectedRecord.id;

    // If already audited, don't auto-trigger agent again unless requested
    if (selectedRecord.audit_explanation) {
      console.log("AuditAgent: Record already audited, skipping auto-prompt.");
      return;
    }

    const prompt = `Perform an audit on this expense claim based on company policy. 
- Expense ID: ${selectedRecord.id}
- Employee: ${selectedRecord.user_name || "Unknown"}
- Category: ${selectedRecord.expense_type}
- City: ${selectedRecord.city || "Not specified"} (${selectedRecord.city_tier || "N/A"})
- Claimed Amount: ₹${selectedRecord.claimed_amount_numeric}
- Receipt Total: ₹${selectedRecord.total_receipt_amount}
- Date: ${selectedRecord.date_range || "Not specified"}
- Verified: ${selectedRecord.verified ? "Yes" : "No"}
- Mismatches: ${selectedRecord.mismatches?.join(", ") || "None"}

Check meal caps for the city tier and amount/date matches. Always call set_audit_result with a detailed timeline of your analysis.`;

    sendMessage({ id: crypto.randomUUID(), role: "user", content: prompt });
  }, [selectedRecord, sendMessage]);

  const handleSend = (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;
    sendMessage({ id: crypto.randomUUID(), role: "user", content: messageText });
    if (!text) setInput("");
  };

  const manualAudit = () => {
    if (!selectedRecord) return;
    lastAuditedId.current = null; // Reset to allow re-trigger
    const prompt = `Perform a fresh audit on this expense claim (Expense ID: ${selectedRecord.id}). 
Please re-verify the records and provide a fresh verdict.`;
    sendMessage({ id: crypto.randomUUID(), role: "user", content: prompt });
  };

  const isOpen = !!selectedRecord;

  // Filter out the auto-generated system audit prompt from visible chat
  const displayMessages = (messages || []).filter((m) => {
    const content = extractContent(m);
    return !content.includes("Perform an audit on this expense claim based on company policy.");
  });

  const existingAudit = selectedRecord?.audit_explanation;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.2)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            transition: "opacity 0.3s ease",
          }}
        />
      )}

      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: isOpen ? 0 : "-450px",
          width: "450px",
          height: "100vh",
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-10px 0 40px rgba(0,0,0,0.1)",
          zIndex: 101,
          transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ padding: "8px", background: "var(--accent-light)", borderRadius: "var(--radius-sm)", color: "var(--accent)" }}>
              <ShieldAlert size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700 }}>Audit Intelligence</h3>
              <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>● Agent Active</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>
            <X size={20} />
          </button>
        </div>

        {/* Audit Details Context */}
        {selectedRecord && (
          <div style={{ padding: "20px 24px", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
               <div>
                 <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Transaction Reference</div>
                 <div style={{ fontWeight: 700, fontSize: "14px", marginTop: "4px" }}>{selectedRecord.expense_type} (₹{selectedRecord.claimed_amount_numeric})</div>
               </div>
               <div style={{ 
                 padding: "6px 12px", 
                 borderRadius: "20px", 
                 fontSize: "12px", 
                 fontWeight: 700,
                 background: selectedRecord.audit_explanation ? (selectedRecord.verified ? "var(--success-light)" : "var(--danger-light)") : "var(--bg-secondary)",
                 color: selectedRecord.audit_explanation ? (selectedRecord.verified ? "var(--success)" : "var(--danger)") : "var(--text-muted)",
                 display: "flex",
                 alignItems: "center",
                 gap: "6px"
               }}>
                 {selectedRecord.audit_explanation ? (selectedRecord.verified ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>) : <Info size={14}/>}
                 {selectedRecord.audit_explanation ? (selectedRecord.verified ? "Verified" : "Mismatch Found") : "Pending Audit"}
               </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
               <div style={{ padding: "10px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Receipt Amount</div>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>₹{selectedRecord.total_receipt_amount || "0"}</div>
               </div>
               <div style={{ padding: "10px", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Verification Status</div>
                  <div style={{ fontWeight: 700, fontSize: "12px", color: selectedRecord.amount_match ? "var(--success)" : "var(--danger)" }}>
                    {selectedRecord.amount_match ? "✓ Amount Matches" : "⚠ Amount Mismatch"}
                  </div>
               </div>
            </div>
          </div>
        )}

        {/* Chat Interface */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Debug Info */}
          {displayMessages.length === 0 && (messages || []).length > 0 && !isLoading && (
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
              Analysing record details...
            </div>
          )}

          {/* Display existing audit from DB if no chat activity */}
          {existingAudit && displayMessages.length === 0 && !isLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {selectedRecord.audit_timeline && selectedRecord.audit_timeline.length > 0 && (
                  <AuditTimeline steps={selectedRecord.audit_timeline} />
                )}

                <div style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
                    <div style={{
                      background: "var(--bg-tertiary)",
                      color: "var(--text-primary)",
                      padding: "16px",
                      borderRadius: "16px 16px 16px 4px",
                      fontSize: "13px",
                      lineHeight: 1.6,
                      border: "1px solid var(--border)",
                      whiteSpace: "pre-wrap",
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: "8px", color: "var(--accent)", fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px" }}>
                        Stored Audit Results
                      </div>
                      {existingAudit}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", fontWeight: 600 }}>
                      Audit Cloud Service
                    </div>
                </div>
            </div>
          )}

          {displayMessages.map((msg: any, idx: number) => {
            const content = extractContent(msg);
            
            if (!content && msg.tool_calls) {
              return (
                <div key={msg.id || `tool-${idx}`} style={{ alignSelf: "flex-start", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", marginBottom: "-10px" }}>
                  Assistant is running verification tool...
                </div>
              );
            }

            if (!content) return null;
            
            const role = String(msg.role || "").toLowerCase();
            const isUser = role === "user";
            const isTool = role === "tool";

            if (isTool) return null;

            return (
              <div key={msg.id || idx} style={{ alignSelf: isUser ? "flex-end" : "flex-start", maxWidth: "85%" }}>
                <div style={{
                  background: isUser ? "var(--accent)" : "var(--bg-tertiary)",
                  color: isUser ? "white" : "var(--text-primary)",
                  padding: "12px 16px",
                  borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: "13px",
                  lineHeight: 1.6,
                  border: isUser ? "none" : "1px solid var(--border)",
                  whiteSpace: "pre-wrap",
                  boxShadow: isUser ? "0 4px 12px var(--accent-glow)" : "none",
                }}>
                  {content}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "6px", textAlign: isUser ? "right" : "left", fontWeight: 600 }}>
                  {isUser ? "Admin Auditor" : "AI Specialist"}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div style={{ alignSelf: "flex-start", background: "var(--bg-tertiary)", padding: "12px 16px", borderRadius: "16px 16px 16px 4px", border: "1px solid var(--border)" }}>
              <div className="shimmer" style={{ width: "100px", height: "14px" }} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer & Actions */}
        <div style={{ padding: "24px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
             {existingAudit ? (
                <QuickAction 
                  icon={<AlertCircle size={14} />} 
                  label="Re-audit Record" 
                  onClick={manualAudit} 
                />
             ) : (
                <QuickAction 
                  icon={<Info size={14} />} 
                  label="Explain Discrepancy" 
                  onClick={() => handleSend("Can you explain exactly where the mismatch is?")} 
                />
             )}
             <QuickAction 
               icon={<ShieldAlert size={14} />} 
               label="Review Receipt" 
               onClick={() => handleSend("Analyze the receipt again for potential OCR errors.")} 
             />
          </div>

          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Ask for audit clarification..."
              style={{
                width: "100%",
                padding: "14px 48px 14px 16px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "8px",
                cursor: "pointer",
              }}
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function QuickAction({ icon, label, onClick }: { icon: any, label: string, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        background: "var(--bg-tertiary)",
        border: "1px solid var(--border)",
        borderRadius: "20px",
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--text-secondary)",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function AuditTimeline({ steps }: { steps: string[] }) {
  return (
    <div style={{ padding: "16px", background: "var(--bg-tertiary)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px", color: "var(--accent)" }}>
        <ShieldAlert size={14} />
        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>Audit Thought Process</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {steps.map((step, i) => (
          <div key={i} style={{ display: "flex", gap: "12px", minHeight: "30px" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                background: i === steps.length - 1 ? "var(--accent)" : "var(--border)",
                border: i === steps.length - 1 ? "2px solid var(--accent-light)" : "none",
                marginTop: "4px"
              }} />
              {i < steps.length - 1 && (
                <div style={{ width: "1px", flex: 1, background: "var(--border)" }} />
              )}
            </div>
            <div style={{ fontSize: "12px", color: i === steps.length - 1 ? "var(--text-primary)" : "var(--text-secondary)", paddingBottom: "12px", fontWeight: i === steps.length - 1 ? 600 : 400 }}>
              {step}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
