"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, ChevronLeft, ChevronRight, Mic } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ChatMessage, ChatSession, AttachedFile, MentionUser, AppliedMention, DashboardSpec } from "@/types";
import DashboardRenderer from "@/components/DashboardRenderer";
import { AdminAIBotStyles } from "./styles";
import ChatSidebar from "./ChatSidebar";
import WelcomeScreen from "./WelcomeScreen";
import MessageList from "./MessageList";
import MentionDropdown from "./MentionDropdown";
import ChatInput from "./ChatInput";
import VoiceAgentPanel from "./VoiceAgentPanel";

export default function AdminAIBot() {
  const [isOpen, setIsOpen]           = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sessions, setSessions]       = useState<ChatSession[]>([]);
  const [currentId, setCurrentId]     = useState<string | null>(null);
  const [input, setInput]             = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isLoading, setIsLoading]     = useState(false);
  const [search, setSearch]           = useState("");
  const [hasLoaded, setHasLoaded]     = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentOpen, setAgentOpen]     = useState(false);
  const [fabHover, setFabHover]       = useState(false);
  const [dashboardSpec, setDashboardSpec] = useState<DashboardSpec | null>(null);
  const [connectedToolkits, setConnectedToolkits] = useState<string[]>([]);
  const [user, setUserId]               = useState<{ id: string } | null>(null);

  // Mention state
  const [mentionUsers, setMentionUsers]       = useState<MentionUser[]>([]);
  const [mentionStart, setMentionStart]       = useState(-1);
  const [mentionQuery, setMentionQuery]       = useState<string | null>(null);
  const [mentionIdx, setMentionIdx]           = useState(0);
  const [appliedMentions, setAppliedMentions] = useState<AppliedMention[]>([]);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const currentIdRef    = useRef<string | null>(null);
  const lastVoiceMsgRef = useRef<{ id: string; role: "user" | "assistant" | "tool" } | null>(null);

  /* ── Persist / hydrate ── */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("expify_admin_sessions");
      if (raw) setSessions(JSON.parse(raw));
    } catch { /* ignore */ }
    setHasLoaded(true);
  }, []);

  /* ── Get current user ── */
  useEffect(() => {
    // Initial fetch
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) setUserId({ id: data.user.id });
    });

    // Listen for changes (robust handle for late session loads)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setUserId({ id: session.user.id });
      else setUserId(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    localStorage.setItem("expify_admin_sessions", JSON.stringify(sessions));
  }, [sessions, hasLoaded]);

  /* ── Fetch users for @mention ── */
  useEffect(() => {
    if (!isOpen || mentionUsers.length > 0) return;
    supabase
      .from("users")
      .select("id,full_name,role,phone,email")
      .then(({ data, error }) => {
        if (!error && data) setMentionUsers(data as MentionUser[]);
      });
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Fetch integrations ── */
  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors/status");
      const data = await res.json();
      if (data.connected_toolkits) {
        setConnectedToolkits(data.connected_toolkits);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchIntegrations();
      const timer = setInterval(fetchIntegrations, 15000);
      return () => clearInterval(timer);
    }
  }, [isOpen, fetchIntegrations]);

  /* ── Keep currentIdRef in sync ── */
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, isLoading, currentId]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && mentionQuery === null) {
        closeBot();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, mentionQuery]); // eslint-disable-line react-hooks/exhaustive-deps
 
  /* ── Open / close ── */
  const openBot = () => {
    setIsOpen(true);
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
  };

  const closeBot = () => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsOpen(false);
      document.body.style.overflow = "";
    }, 280);
  };


  /* ── Session helpers ── */
  const currentSession  = sessions.find(s => s.id === currentId) ?? null;
  const currentMessages = currentSession?.messages ?? [];

  const createNewSession = () => {
    setCurrentId(null);
    setInput("");
    setAttachedFiles([]);
    setAppliedMentions([]);
    setMentionStart(-1);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const selectSession = (id: string) => setCurrentId(id);

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentId === id) setCurrentId(null);
  };

  /* ── File attach ── */
  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newFiles: AttachedFile[] = files.map(file => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
      type: file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : "other",
    }));
    setAttachedFiles(prev => [...prev, ...newFiles]);
    e.target.value = "";
  };

  const removeFile = (id: string) => {
    setAttachedFiles(prev => {
      const f = prev.find(f => f.id === id);
      if (f?.preview) URL.revokeObjectURL(f.preview);
      return prev.filter(f => f.id !== id);
    });
  };

  /* ── Mention helpers ── */
  const filteredMentions = mentionQuery !== null
    ? mentionUsers.filter(u => u.full_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)
    : [];
  const showMentionDropdown = mentionQuery !== null && (filteredMentions.length > 0 || mentionUsers.length === 0);

  const buildSendValue = (displayText: string) => {
    let result = displayText;
    for (const m of appliedMentions) result = result.split(m.display).join(m.withId);
    return result.trim();
  };

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  };

  const selectMentionUser = (user: MentionUser) => {
    const cursor  = textareaRef.current?.selectionStart ?? input.length;
    const before  = input.slice(0, mentionStart);
    const after   = input.slice(cursor);
    const display = `@${user.full_name} `;
    const withId  = `@${user.full_name} [user_id:${user.id}]`;
    const newVal  = before + display + after;
    setInput(newVal);
    setAppliedMentions(prev => [...prev.filter(m => m.display !== `@${user.full_name}`), { display: `@${user.full_name}`, withId }]);
    setMentionStart(-1);
    setMentionQuery(null);
    setTimeout(() => {
      if (!textareaRef.current) return;
      const pos = mentionStart + display.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(pos, pos);
      autoResize(textareaRef.current);
    }, 0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const cursor = e.target.selectionStart ?? newVal.length;
    setInput(newVal);
    autoResize(e.target);
    const textBeforeCursor = newVal.slice(0, cursor);
    const atIdx = textBeforeCursor.lastIndexOf("@");
    if (atIdx !== -1) {
      const queryText = textBeforeCursor.slice(atIdx + 1);
      if (!queryText.includes(" ")) {
        setMentionStart(atIdx);
        setMentionQuery(queryText);
        setMentionIdx(0);
        return;
      }
    }
    setMentionStart(-1);
    setMentionQuery(null);
  };

  const handleVoiceMessage = useCallback((msg: { 
    role: "user" | "assistant" | "tool"; 
    content: string; 
    isVoice: true; 
    is_chunk?: boolean; 
    is_final?: boolean;
    tool?: string;
    args?: any;
  }) => {
    const activeId = currentIdRef.current;
    
    setSessions(prev => {
      let currentSessions = [...prev];
      let sessionId = activeId;

      const getToolEmoji = (toolName: string) => {
        const tools: Record<string, string> = {
          resolve_user: "👤 Finding user",
          get_user_stats: "📊 Getting stats",
          get_applications: "📁 Fetching applications",
          get_flagged_expenses: "⚠️ Checking flags",
          get_policies: "📜 Reading policy",
          get_mismatch_breakdown: "🔢 Analyzing mismatches",
          get_expenses_detail: "🔍 Getting expense details",
          get_users: "👥 Listing users",
          set_policy_override: "✍️ Setting override",
          clear_policy_override: "🧹 Clearing override",
          generate_dashboard: "📈 Creating dashboard",
        };
        return tools[toolName] || `🛠️ Calling ${toolName}`;
      };

      // 1. Ensure we have a session
      if (!sessionId) {
        sessionId = `sess_voice_${Date.now()}`;
        currentIdRef.current = sessionId;
        setCurrentId(sessionId);
        currentSessions = [{
          id: sessionId,
          title: msg.role === "user" ? msg.content.slice(0, 40) : "Voice Conversation",
          createdAt: new Date().toISOString(),
          messages: [],
        }, ...currentSessions];
      }

      const sessionIdx = currentSessions.findIndex(s => s.id === sessionId);
      if (sessionIdx === -1) return prev;

      const session = { ...currentSessions[sessionIdx] };
      const lastMsg = lastVoiceMsgRef.current;

      // Determine content to display
      let displayContent = msg.content;
      if (msg.role === "tool" && msg.tool) {
        displayContent = `_${getToolEmoji(msg.tool)}..._`;
      }

      // 2. Decide: New bubble or Update existing?
      // We update if: same role AND we have a last message ID
      if (lastMsg && lastMsg.role === msg.role) {
        session.messages = session.messages.map(m => {
          if (m.id === lastMsg.id) {
            return {
              ...m,
              content: msg.is_chunk ? (m.content + displayContent) : (displayContent || m.content),
              timestamp: new Date().toISOString(),
            };
          }
          return m;
        });
      } else {
        // New bubble
        const newMsgId = `voice-${Date.now()}`;
        const chatMsg: ChatMessage = {
          id: newMsgId,
          role: msg.role === "tool" ? "assistant" : msg.role,
          content: displayContent,
          timestamp: new Date().toISOString(),
          isVoice: true,
        };
        session.messages = [...session.messages, chatMsg];
        lastVoiceMsgRef.current = { id: newMsgId, role: msg.role };
      }

      // If it's final (AI finished speaking), we reset the ref so the NEXT response is a new bubble
      if (msg.is_final) {
        lastVoiceMsgRef.current = null;
      }

      currentSessions[sessionIdx] = session;
      return currentSessions;
    });
  }, []);

  const handleVoiceDashboardId = useCallback((id: string, title: string) => {
    const chatMsg: ChatMessage = {
      id: `voice-db-${Date.now()}`,
      role: "assistant",
      content: `[dashboard_id:${id}]${title}`,
      timestamp: new Date().toISOString(),
      isVoice: true,
    };
    const activeId = currentIdRef.current;
    if (activeId) {
      setSessions(prev => prev.map(s =>
        s.id === activeId ? { ...s, messages: [...s.messages, chatMsg] } : s
      ));
    } else {
      const newId = `sess_voice_${Date.now()}`;
      currentIdRef.current = newId;
      setCurrentId(newId);
      setSessions(prev => [{
        id: newId,
        title: `Dashboard: ${title}`,
        createdAt: new Date().toISOString(),
        messages: [chatMsg],
      }, ...prev]);
    }
  }, []);

  /* ── Send ── */
  const handleSend = useCallback(async (content: string = input) => {
    const sendContent = content === input ? buildSendValue(content) : content.trim();
    const trimmed = sendContent.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      files: attachedFiles.map(f => ({ name: f.file.name, type: f.type, url: f.preview })),
      timestamp: new Date().toISOString(),
    };

    let sessionId = currentId;
    let existingMessages: ChatMessage[] = [];

    if (!sessionId) {
      sessionId = `sess_${Date.now()}`;
      const newSession: ChatSession = {
        id: sessionId,
        title: trimmed.slice(0, 42) || "New conversation",
        createdAt: new Date().toISOString(),
        messages: [userMsg],
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentId(sessionId);
    } else {
      const existing = sessions.find(s => s.id === sessionId);
      existingMessages = existing?.messages ?? [];
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, messages: [...s.messages, userMsg] } : s
      ));
    }

    setInput("");
    setAttachedFiles([]);
    setAppliedMentions([]);
    setMentionStart(-1);
    setMentionQuery(null);
    setIsLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const assistantId = `ai-${Date.now()}`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };
    setSessions(prev => prev.map(s =>
      s.id === sessionId ? { ...s, messages: [...s.messages, assistantMsg] } : s
    ));

    const history = [...existingMessages, userMsg]
      .slice(-12)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/enterprise-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, threadId: sessionId, history }),
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let hasDashboard = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          console.log("[DEBUG] Raw stream line:", line);
          const raw = line.slice(6).trim();
          if (!raw || raw === "[DONE]") continue;
          try {
            const parsed = JSON.parse(raw) as { delta?: string; dashboard?: DashboardSpec };

            // Dashboard spec — render inline as chart + open modal
            if (parsed.dashboard) {
              console.log("[DEBUG] Received dashboard spec:", parsed.dashboard);
              hasDashboard = true;
              const specJson = JSON.stringify(parsed.dashboard);
              setDashboardSpec(parsed.dashboard);
              if (!accumulated) setIsLoading(false);
              accumulated = specJson;
              setSessions(prev => prev.map(s =>
                s.id === sessionId
                  ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: specJson } : m) }
                  : s
              ));
            }

            // Text delta — skip if we already have a dashboard (don't overwrite chart with "Here is your dashboard")
            if (parsed.delta && !hasDashboard) {
              console.log("[DEBUG] Received text delta:", parsed.delta);
              if (!accumulated) setIsLoading(false);
              accumulated += parsed.delta;
              const snap = accumulated;
              setSessions(prev => prev.map(s =>
                s.id === sessionId
                  ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: snap } : m) }
                  : s
              ));
            }
          } catch { /* skip malformed */ }
        }
      }

      setIsLoading(false);
      if (!accumulated) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId
            ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: "No response from Enterprise Agent. Make sure the agent server is running." } : m) }
            : s
        ));
      }
    } catch (err) {
      setIsLoading(false);
      const errorText = err instanceof Error ? err.message : "Unknown error";
      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, messages: s.messages.map(m => m.id === assistantId ? { ...m, content: `⚠ Connection error: ${errorText}` } : m) }
          : s
      ));
    }
  }, [input, attachedFiles, currentId, sessions, appliedMentions]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentionDropdown) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMentions.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); selectMentionUser(filteredMentions[mentionIdx]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionStart(-1); setMentionQuery(null); return; }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const canSend = input.trim().length > 0 || attachedFiles.length > 0;

  return (
    <>
      <style>{AdminAIBotStyles}</style>

      {/* ── FAB ── */}
      <div
        onClick={openBot}
        title="Expify Admin AI"
        onMouseEnter={() => setFabHover(true)}
        onMouseLeave={() => setFabHover(false)}
        style={{
          position: "fixed", bottom: "28px", right: "28px",
          width: "56px", height: "56px", borderRadius: "50%",
          background: fabHover
            ? "linear-gradient(135deg,#7C3AED,#6D28D9)"
            : "linear-gradient(135deg,#8B5CF6,#7C3AED)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 1000,
          border: "1px solid rgba(255,255,255,0.2)",
          animation: fabHover ? "none" : "fabPulse 3s ease-in-out infinite",
          transform: fabHover ? "scale(1.1) translateY(-2px)" : "scale(1)",
          transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1), background 0.2s, border-color 0.2s",
          boxShadow: fabHover ? "0 12px 40px rgba(139,92,246,0.5)" : "0 8px 24px rgba(139,92,246,0.3)",
          backdropFilter: "blur(4px)",
        }}
      >
        <Sparkles
          size={22} color="white"
          style={{ transition: "transform 0.35s", transform: fabHover ? "rotate(18deg) scale(1.1)" : "rotate(0)", opacity: 0.9 }}
        />
        {sessions.length > 0 && (
          <div className="fab-counter" style={{
            position: "absolute", top: "-2px", right: "-2px",
            width: "18px", height: "18px", borderRadius: "50%",
            background: "rgba(255,255,255,0.9)",
            border: "2px solid #0a0a0c",
            fontSize: "8px", color: "#000", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 800,
          }}>
            {sessions.length > 9 ? "9+" : sessions.length}
          </div>
        )}
      </div>

      {/* ── Full-screen overlay + dashboard modal ── */}
      {isOpen && (
        <>
        <div
          className={isAnimating ? "aib-overlay-in" : "aib-overlay-out"}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#0a0a0c",
            display: "flex", flexDirection: "column",
            fontFamily: "'Sora', sans-serif",
          }}
        >
          {/* ── Top bar ── */}
          <div className="aib-topbar" style={{
            height: "56px", display: "flex", alignItems: "center",
            justifyContent: "space-between", padding: "0 16px 0 0",
            flexShrink: 0, background: "rgba(10,10,12,0.98)",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {/* Sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(p => !p)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "rgba(255,255,255,0.3)", padding: "10px 12px",
                  display: "flex", borderRadius: "10px", transition: "all 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              >
                {sidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>

              {/* Logo */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "0 4px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Sparkles size={14} color="white" style={{ opacity: 0.85 }} />
                </div>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em" }}>
                  Expify AI
                </span>
              </div>
            </div>

            {/* Close button */}
            <button
              onClick={closeBot}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.3)", padding: "10px 12px",
                display: "flex", borderRadius: "10px", transition: "all 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
              title="Close (Esc)"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── Body row: sidebar | main | voice panel ── */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

            {/* ── Left Sidebar ── */}
            {sidebarOpen && (
              <ChatSidebar
                sessions={sessions}
                currentId={currentId}
                search={search}
                onNewChat={createNewSession}
                onSelectSession={selectSession}
                onDeleteSession={deleteSession}
                onSearchChange={setSearch}
              />
            )}

            {/* ── Main chat area ── */}
            <div className="aib-main-in aib-main-bg" style={{
              flex: 1, display: "flex", flexDirection: "column",
              overflow: "hidden", position: "relative",
            }}>
              {/* Messages / welcome */}
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {currentMessages.length === 0 ? (
                  <WelcomeScreen />
                ) : (
                  <MessageList
                    messages={currentMessages}
                    messagesEndRef={messagesEndRef}
                  />
                )}
              </div>

              {/* ── Input area ── */}
              <ChatInput
                input={input}
                attachedFiles={attachedFiles}
                showMentionDropdown={showMentionDropdown}
                canSend={canSend}
                agentOpen={agentOpen}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSend={() => handleSend()}
                onAttach={handleFileAttach}
                onRemoveFile={removeFile}
                onToggleAgent={() => setAgentOpen(p => !p)}
                onManageConnectors={() => {
                  window.location.href = "/admin/connectors";
                }}
                connectedToolkits={connectedToolkits}
                textareaRef={textareaRef}
                fileInputRef={fileInputRef}
                mentionDropdown={
                  <MentionDropdown
                    filteredMentions={filteredMentions}
                    mentionUsers={mentionUsers}
                    mentionQuery={mentionQuery}
                    mentionIdx={mentionIdx}
                    onSelect={selectMentionUser}
                    onHover={setMentionIdx}
                  />
                }
              />
            </div>

            {/* ── Right: Voice Agent panel (sibling, like sidebar) ── */}
            {agentOpen && (
              <div
                className="aib-voice-panel-in aib-voice-panel-divider"
                style={{
                  width: "320px",
                  flexShrink: 0,
                  background: "#0c0c0f",
                  display: "flex", flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                {/* Voice panel header */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "14px 16px",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                  flexShrink: 0, height: "56px", boxSizing: "border-box",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "8px",
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Mic size={13} color="white" style={{ opacity: 0.8 }} />
                    </div>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.85)", fontFamily: "'Sora', sans-serif" }}>
                      Voice Agent
                    </span>
                  </div>
                  <button
                    onClick={() => setAgentOpen(false)}
                    style={{
                      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px", padding: "5px", cursor: "pointer",
                      color: "rgba(255,255,255,0.35)", display: "flex", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}
                  >
                    <X size={15} />
                  </button>
                </div>
                  <VoiceAgentPanel
                    adminId={user?.id}
                    onVoiceMessage={handleVoiceMessage}
                    onDashboard={setDashboardSpec}
                    onVoiceDashboardId={handleVoiceDashboardId}
                  />
              </div>
            )}
          </div>
        </div>

        {/* ── Dashboard modal overlay ── */}
        {dashboardSpec && (
          <div
            onClick={() => setDashboardSpec(null)}
            style={{
              position: "fixed", inset: 0, zIndex: 99999,
              background: "rgba(0,0,0,0.72)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "24px",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: "720px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            >
              <div style={{
                display: "flex", justifyContent: "flex-end", marginBottom: "10px",
              }}>
                <button
                  onClick={() => setDashboardSpec(null)}
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px", padding: "6px 10px",
                    color: "rgba(255,255,255,0.5)", cursor: "pointer",
                    fontSize: "12px", fontFamily: "'Sora', sans-serif",
                    display: "flex", alignItems: "center", gap: "5px",
                  }}
                >
                  <X size={13} /> Close
                </button>
              </div>
              <DashboardRenderer spec={dashboardSpec} />
            </div>
          </div>
        )}
      </>
    )}
    </>
  );
}
