"use client";

import { useEffect, useRef, useState } from "react";
import { X, MicOff, Mic, Bot, Clock, Volume2, Wifi, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardSpec } from "@/types";

const AGENT = "http://localhost:8000";
type SessionState = "idle" | "connecting" | "connected" | "error";

interface VoiceMsg {
  role: "user" | "assistant" | "tool";
  content: string;
  isVoice: true;
  is_chunk?: boolean;
  is_final?: boolean;
}

interface Props {
  adminId?: string;  // current admin UUID — forwarded so enterprise agent loads Composio tools
  onVoiceMessage?: (msg: VoiceMsg) => void;
  onDashboard?: (spec: DashboardSpec) => void;
  onVoiceDashboardId?: (id: string, title: string) => void;
}

export default function VoiceAgentPanel({ adminId, onVoiceMessage, onDashboard, onVoiceDashboardId }: Props) {
  const [sessionState,  setSessionState]  = useState<SessionState>("idle");
  const [isMuted,       setIsMuted]       = useState(false);
  const [errorMsg,      setErrorMsg]      = useState("");
  const [thinkingLabel, setThinkingLabel] = useState<string | null>(null);

  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const audioRef  = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pcIdRef   = useRef<string | null>(null);
  const bars      = Array.from({ length: 5 });

  useEffect(() => { return () => cleanup(); }, []);

  const cleanup = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    pcIdRef.current = null;
    if (audioRef.current) { audioRef.current.srcObject = null; audioRef.current = null; }
    setThinkingLabel(null);
  };

  const handleStart = async () => {
    setSessionState("connecting");
    setErrorMsg("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        if (!audioRef.current) { audioRef.current = new Audio(); audioRef.current.autoplay = true; }
        audioRef.current.srcObject = e.streams[0];
      };

      pc.ondatachannel = (e) => {
        const ch = e.channel;
        ch.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data) as {
              type: string; text?: string; spec?: DashboardSpec;
              id?: string; title?: string; is_chunk?: boolean;
              is_final?: boolean; status?: string; label?: string;
            };

            if (msg.type === "voice_user" && msg.text) {
              onVoiceMessage?.({ role: "user", content: msg.text, isVoice: true });

            } else if (msg.type === "voice_assistant") {
              onVoiceMessage?.({
                role: "assistant", content: msg.text || "", isVoice: true,
                is_chunk: msg.is_chunk, is_final: msg.is_final,
              });

            } else if (msg.type === "voice_thinking") {
              if (msg.status === "start")      setThinkingLabel(msg.label ?? "Thinking…");
              else if (msg.status === "clear") setThinkingLabel(null);

            } else if (msg.type === "voice_dashboard" && msg.spec) {
              onDashboard?.(msg.spec);

            } else if (msg.type === "voice_dashboard_id" && msg.id) {
              onVoiceDashboardId?.(msg.id, msg.title || "Dashboard");
            }
          } catch { /* ignore malformed */ }
        };
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") setSessionState("connected");
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          setErrorMsg("WebRTC connection lost.");
          setSessionState("error");
        }
      };

      pc.createDataChannel("data");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") { resolve(); return; }
        pc.onicegatheringstatechange = () => { if (pc.iceGatheringState === "complete") resolve(); };
        setTimeout(resolve, 4000);
      });


      // Ensure we have a valid admin_id. 
      // The user wants us to get it directly from Supabase for correctness.
      let finalAdminId = adminId || "";
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) finalAdminId = user.id;
      } catch (err) {
        console.warn("[Voice] Failed to fetch user from Supabase, falling back to prop:", err);
      }

      const offerBody: Record<string, string> = {
        sdp:      pc.localDescription!.sdp,
        type:     pc.localDescription!.type,
        admin_id: finalAdminId,  // ← forwarded to enterprise agent for Composio
      };
      if (pcIdRef.current) offerBody.pc_id = pcIdRef.current;

      const res = await fetch(`${AGENT}/voice/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(offerBody),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const { sdp, type, pc_id } = await res.json();
      pcIdRef.current = pc_id;
      await pc.setRemoteDescription({ sdp, type });
      setSessionState("connected");

    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error.");
      setSessionState("error");
      cleanup();
    }
  };

  const handleEnd  = () => { cleanup(); setSessionState("idle"); setIsMuted(false); };
  const handleMute = () => {
    if (!streamRef.current) return;
    const next = !isMuted;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setIsMuted(next);
  };

  const isActive    = sessionState === "connecting" || sessionState === "connected";
  const isConnected = sessionState === "connected";

  const statusLabel =
    sessionState === "connecting" ? "Connecting…"      :
    sessionState === "connected"  ? "Connected"        :
    sessionState === "error"      ? "Connection Error" : "Voice Agent";

  const statusSub =
    sessionState === "idle"       ? "Click the orb to start a voice session" :
    sessionState === "connecting" ? "Establishing WebRTC connection…"         :
    sessionState === "connected"  ? "Powered by Sarvam AI · Google Gemini"   : errorMsg;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      padding: "28px 20px 24px", overflowY: "auto" }}>

      <div style={{ flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "24px", width: "100%" }}>

        {/* Orb */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
          {isActive && (<>
            <div className="agent-ring agent-ring-1" />
            <div className="agent-ring agent-ring-2" />
            <div className="agent-ring agent-ring-3" />
          </>)}

          <div onClick={sessionState === "idle" ? handleStart : undefined}
            className={isActive ? "voice-orb-active" : ""}
            style={{
              width: "108px", height: "108px", borderRadius: "50%",
              background: isActive ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
              border: isActive ? "1.5px solid rgba(255,255,255,0.25)" : "1.5px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
              position: "relative", zIndex: 1,
              cursor: sessionState === "idle" ? "pointer" : "default",
              backdropFilter: "blur(12px)",
            }}>
            {!isActive
              ? <Bot size={40} color="rgba(255,255,255,0.5)" strokeWidth={1.5} />
              : <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "32px" }}>
                  {bars.map((_, i) => (
                    <div key={i} className={`voice-bar voice-bar-${i + 1}`} style={{
                      width: "4px", borderRadius: "3px", background: "rgba(255,255,255,0.8)",
                      animationPlayState: isConnected ? "running" : "paused",
                      height: `${7 + i * 4}px`, transition: "height 0.3s",
                    }} />
                  ))}
                </div>
            }
          </div>

          {/* Status */}
          <div style={{ textAlign: "center", maxWidth: "240px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", marginBottom: "6px" }}>
              {isConnected && <div style={{ width: "6px", height: "6px", borderRadius: "50%",
                background: "#4ade80", boxShadow: "0 0 8px rgba(74,222,128,0.5)" }} />}
              <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, fontFamily: "'Sora', sans-serif",
                color: sessionState === "error" ? "#f87171" : "rgba(255,255,255,0.88)" }}>
                {statusLabel}
              </p>
            </div>
            <p style={{ margin: 0, fontSize: "11.5px", fontFamily: "'Sora', sans-serif", lineHeight: 1.5,
              color: sessionState === "error" ? "rgba(248,113,113,0.65)" : "rgba(255,255,255,0.3)" }}>
              {statusSub}
            </p>
          </div>
        </div>

        {/* ── Thinking pill ── */}
        <div style={{
          height: "34px", display: "flex", alignItems: "center", justifyContent: "center",
          opacity: thinkingLabel ? 1 : 0, transition: "opacity 0.25s", pointerEvents: "none",
        }}>
          {thinkingLabel && (
            <div style={{
              display: "flex", alignItems: "center", gap: "8px",
              padding: "7px 16px",
              background: "rgba(139, 92, 246, 0.08)",
              border: "1px solid rgba(139, 92, 246, 0.22)",
              borderRadius: "40px",
            }}>
              <Loader2 size={12} color="#A78BFA"
                style={{ flexShrink: 0, animation: "vaSpin 1s linear infinite" }} />
              <span style={{ fontSize: "11.5px", fontWeight: 500, color: "#A78BFA",
                fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap" }}>
                {thinkingLabel}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          {isActive && (<>
            <button onClick={handleMute} style={{
              width: "44px", height: "44px", borderRadius: "50%", cursor: "pointer",
              background: isMuted ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.06)",
              border: `1px solid ${isMuted ? "rgba(248,113,113,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: isMuted ? "#f87171" : "rgba(255,255,255,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
            }}>
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>

            <button onClick={handleEnd} style={{
              width: "58px", height: "58px", borderRadius: "50%",
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.28)",
              color: "#f87171", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.12)"; }}>
              <X size={22} />
            </button>

            <button style={{
              width: "44px", height: "44px", borderRadius: "50%", cursor: "default",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.55)", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Volume2 size={18} />
            </button>
          </>)}

          {sessionState === "idle" && (
            <button onClick={handleStart} style={{
              display: "flex", alignItems: "center", gap: "9px", padding: "12px 26px",
              borderRadius: "40px", background: "rgba(255,255,255,0.09)",
              border: "1px solid rgba(255,255,255,0.16)", color: "rgba(255,255,255,0.88)",
              cursor: "pointer", fontSize: "13px", fontWeight: 600,
              fontFamily: "'Sora', sans-serif", transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; }}>
              <Mic size={16} /> Start Session
            </button>
          )}

          {sessionState === "error" && (
            <button onClick={() => { setSessionState("idle"); setErrorMsg(""); }} style={{
              padding: "10px 22px", borderRadius: "40px",
              background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.22)",
              color: "#f87171", cursor: "pointer", fontSize: "12.5px",
              fontFamily: "'Sora', sans-serif", fontWeight: 600,
            }}>
              Try Again
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: "8px 14px",
        borderRadius: "40px", background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.07)", marginTop: "20px" }}>
        {isActive ? <Wifi size={12} color="rgba(255,255,255,0.3)" /> : <Clock size={12} color="rgba(255,255,255,0.25)" />}
        <span style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.25)", fontFamily: "'Sora', sans-serif", fontWeight: 500 }}>
          {isActive ? "WebRTC · Enterprise bridge · 8 kHz audio" : ""}
        </span>
      </div>

      <style>{`@keyframes vaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}