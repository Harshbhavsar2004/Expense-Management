"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, MicOff, Mic, Bot, Clock, Volume2, Wifi, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { DashboardSpec } from "@/types";

const AGENT = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";
type SessionState = "idle" | "connecting" | "connected" | "error";

interface VoiceMsg {
  role: "user" | "assistant" | "tool";
  content: string;
  isVoice: true;
  is_chunk?: boolean;
  is_final?: boolean;
}

interface Props {
  adminId?: string;
  onVoiceMessage?: (msg: VoiceMsg) => void;
  onDashboard?: (spec: DashboardSpec) => void;
  onVoiceDashboardId?: (id: string, title: string) => void;
}

// ── AudioWorklet processor source (inline to avoid external .js files) ────
const PCM_RECORDER_PROCESSOR = `
class PCMRecorderProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch) {
      const pcm16 = new Int16Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        pcm16[i] = Math.max(-1, Math.min(1, ch[i])) * 0x7fff;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm-recorder", PCMRecorderProcessor);
`;

export default function VoiceAgentPanel({ adminId, onVoiceMessage, onDashboard, onVoiceDashboardId }: Props) {
  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [isMuted, setIsMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [thinkingLabel, setThinkingLabel] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recCtxRef = useRef<AudioContext | null>(null);
  const playCtxRef = useRef<AudioContext | null>(null);
  const nextPlayRef = useRef<number>(0);
  const bars = Array.from({ length: 5 });

  useEffect(() => { return () => cleanup(); }, []);

  useEffect(() => {
    if (adminId) localStorage.setItem("expify_admin_user_id", adminId);
  }, [adminId]);

  const cleanup = useCallback(() => {
    // Stop mic
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    // Close recorder AudioContext
    if (recCtxRef.current?.state !== "closed") recCtxRef.current?.close().catch(() => {});
    recCtxRef.current = null;
    // Close player AudioContext
    if (playCtxRef.current?.state !== "closed") playCtxRef.current?.close().catch(() => {});
    playCtxRef.current = null;
    nextPlayRef.current = 0;
    // Close WebSocket
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    setThinkingLabel(null);
  }, []);

  // ── Decode base64 PCM and schedule gapless playback ──────────────────────
  const playAudio = useCallback((b64: string, sampleRate: number) => {
    const ctx = playCtxRef.current;
    if (!ctx || ctx.state === "closed") return;
    if (ctx.state === "suspended") ctx.resume();

    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const numSamples = bytes.length / 2;
    const float32 = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }
    const buf = ctx.createBuffer(1, numSamples, sampleRate);
    buf.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    const now = ctx.currentTime;
    const start = Math.max(now, nextPlayRef.current);
    src.start(start);
    nextPlayRef.current = start + buf.duration;
  }, []);

  // ── Handle incoming WebSocket messages ───────────────────────────────────
  const onWsMessage = useCallback((ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data) as {
        type: string; text?: string; data?: string; sampleRate?: number;
        id?: string; title?: string; label?: string; status?: string;
        message?: string; spec?: DashboardSpec;
        is_chunk?: boolean; is_final?: boolean;
      };

      switch (msg.type) {
        case "audio":
          if (msg.data) playAudio(msg.data, msg.sampleRate || 24000);
          break;

        case "transcript_in":
          if (msg.text) onVoiceMessage?.({ role: "user", content: msg.text, isVoice: true });
          break;

        case "transcript_out":
          if (msg.text) onVoiceMessage?.({
            role: "assistant", content: msg.text, isVoice: true,
            is_chunk: true, is_final: false,
          });
          break;

        case "text_out":
          if (msg.text) onVoiceMessage?.({
            role: "assistant", content: msg.text, isVoice: true,
            is_chunk: true, is_final: false,
          });
          break;

        case "tool_thinking":
          setThinkingLabel(msg.label ?? "Thinking…");
          break;

        case "turn_complete":
          setThinkingLabel(null);
          onVoiceMessage?.({ role: "assistant", content: "", isVoice: true, is_final: true });
          break;

        case "dashboard_ready":
          if (msg.id) onVoiceDashboardId?.(msg.id, msg.title || "Dashboard");
          break;

        case "error":
          console.error("[Voice WS]", msg.message);
          break;
      }
    } catch { /* ignore malformed */ }
  }, [playAudio, onVoiceMessage, onVoiceDashboardId]);

  // ── Start session ───────────────────────────────────────────────────────
  const handleStart = async () => {
    setSessionState("connecting");
    setErrorMsg("");
    try {
      // 1. Get microphone
      console.log("[Voice] Requesting microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      streamRef.current = stream;
      console.log("[Voice] Microphone acquired:", stream.getAudioTracks()[0]?.label);

      // 2. Create playback AudioContext (24 kHz for Gemini output)
      playCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayRef.current = 0;
      console.log("[Voice] Playback AudioContext created, sampleRate:", playCtxRef.current.sampleRate);

      // 3. Create recording AudioContext (16 kHz for Gemini input)
      const recCtx = new AudioContext({ sampleRate: 16000 });
      recCtxRef.current = recCtx;
      console.log("[Voice] Recording AudioContext created, sampleRate:", recCtx.sampleRate);

      // 4. Resolve admin ID
      let finalAdminId = adminId || "";
      if (!finalAdminId) {
        finalAdminId = localStorage.getItem("expify_admin_user_id") || "";
      }
      if (!finalAdminId) {
        console.log("[Voice] adminId prop and localStorage empty, fetching from Supabase...");
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) finalAdminId = user.id;
      }
      
      if (finalAdminId) {
        localStorage.setItem("expify_admin_user_id", finalAdminId);
      }
      
      console.log("[Voice] Resolved finalAdminId:", finalAdminId);

      if (!finalAdminId) {
        throw new Error("User identity not found. Please log in again.");
      }

      // 5. Open WebSocket FIRST (so it's ready when audio starts flowing)
      const sessionId = crypto.randomUUID();
      const wsUrl = `${AGENT.replace(/^http/, "ws")}/voice/ws/${sessionId}?admin_id=${encodeURIComponent(finalAdminId)}`;
      console.log("[Voice] Connecting WebSocket:", wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        console.log("[Voice] WebSocket connected!");
        setSessionState("connected");
      };
      ws.onmessage = onWsMessage;
      ws.onclose = (ev) => {
        console.log("[Voice] WebSocket closed:", ev.code, ev.reason);
        setSessionState("idle");
        setIsMuted(false);
        cleanup();
      };
      ws.onerror = (ev) => {
        console.error("[Voice] WebSocket error:", ev);
        setErrorMsg("WebSocket connection failed.");
        setSessionState("error");
        cleanup();
      };

      // 6. Set up mic audio capture — try AudioWorklet first, fallback to ScriptProcessor
      let audioChunkCount = 0;
      const sendPcm = (pcmBuffer: ArrayBuffer) => {
        audioChunkCount++;
        if (audioChunkCount <= 5 || audioChunkCount % 100 === 0) {
          console.log(`[Voice] Sending audio chunk #${audioChunkCount}: ${pcmBuffer.byteLength} bytes`);
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(pcmBuffer);
        }
      };

      const source = recCtx.createMediaStreamSource(stream);

      try {
        // AudioWorklet approach
        const blob = new Blob([PCM_RECORDER_PROCESSOR], { type: "application/javascript" });
        const workletUrl = URL.createObjectURL(blob);
        await recCtx.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        const workletNode = new AudioWorkletNode(recCtx, "pcm-recorder");
        source.connect(workletNode);
        // Connect to destination to keep the node alive in the audio graph
        // Use a zero-gain node to prevent echo
        const silencer = recCtx.createGain();
        silencer.gain.value = 0;
        workletNode.connect(silencer);
        silencer.connect(recCtx.destination);

        workletNode.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
          sendPcm(e.data);
        };
        console.log("[Voice] ✓ AudioWorklet mic recorder set up successfully");

      } catch (workletErr) {
        // Fallback: ScriptProcessorNode (deprecated but universally supported)
        console.warn("[Voice] AudioWorklet failed, using ScriptProcessor fallback:", workletErr);
        const processor = recCtx.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(recCtx.destination);

        processor.onaudioprocess = (e) => {
          const float32 = e.inputBuffer.getChannelData(0);
          const pcm16 = new Int16Array(float32.length);
          for (let i = 0; i < float32.length; i++) {
            pcm16[i] = Math.max(-1, Math.min(1, float32[i])) * 0x7fff;
          }
          sendPcm(pcm16.buffer);
        };
        console.log("[Voice] ✓ ScriptProcessor fallback set up successfully");
      }

    } catch (err: unknown) {
      console.error("[Voice] handleStart error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Unknown error.");
      setSessionState("error");
      cleanup();
    }
  };

  const handleEnd = () => { cleanup(); setSessionState("idle"); setIsMuted(false); };
  const handleMute = () => {
    if (!streamRef.current) return;
    const next = !isMuted;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setIsMuted(next);
  };

  const isActive = sessionState === "connecting" || sessionState === "connected";
  const isConnected = sessionState === "connected";

  const statusLabel =
    sessionState === "connecting" ? "Connecting…" :
    sessionState === "connected"  ? "Connected" :
    sessionState === "error"      ? "Error" : "Voice";

  const statusSub =
    sessionState === "idle"       ? "Tap to start a voice session" :
    sessionState === "connecting" ? "Opening WebSocket…" :
    sessionState === "connected"  ? "Sarvam AI · Google Gemini" : errorMsg;

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "24px 20px 20px",
      overflowY: "auto",
      fontFamily: "var(--font-sans, 'Geist', sans-serif)",
    }}>

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        width: "100%",
      }}>

        {/* Orb */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "18px" }}>
          {isActive && (<>
            <div className="agent-ring" />
            <div className="agent-ring agent-ring-2" />
            <div className="agent-ring agent-ring-3" />
          </>)}

          <div
            onClick={sessionState === "idle" ? handleStart : undefined}
            className={isActive ? "voice-orb-active" : ""}
            style={{
              width: "96px",
              height: "96px",
              borderRadius: "50%",
              background: isActive ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.04)",
              border: isActive
                ? "1px solid rgba(255,255,255,0.18)"
                : "1px solid rgba(255,255,255,0.09)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
              position: "relative",
              zIndex: 1,
              cursor: sessionState === "idle" ? "pointer" : "default",
              backdropFilter: "blur(8px)",
            }}
          >
            {!isActive ? (
              <Bot size={36} color="rgba(255,255,255,0.45)" strokeWidth={1.5} />
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "28px" }}>
                {bars.map((_, i) => (
                  <div key={i} className={`voice-bar voice-bar-${i + 1}`} style={{
                    width: "3px",
                    borderRadius: "2px",
                    background: "rgba(255,255,255,0.75)",
                    animationPlayState: isConnected ? "running" : "paused",
                    height: `${6 + i * 4}px`,
                    transition: "height 0.3s",
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div style={{ textAlign: "center", maxWidth: "220px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginBottom: "5px",
            }}>
              {isConnected && (
                <div style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  background: "#22c55e",
                  boxShadow: "0 0 6px rgba(34,197,94,0.4)",
                }} />
              )}
              <p style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 500,
                color: sessionState === "error" ? "#ff4444" : "rgba(255,255,255,0.82)",
                letterSpacing: "-0.01em",
              }}>
                {statusLabel}
              </p>
            </div>
            <p style={{
              margin: 0,
              fontSize: "11px",
              lineHeight: 1.5,
              color: sessionState === "error" ? "rgba(255,68,68,0.6)" : "rgba(255,255,255,0.28)",
            }}>
              {statusSub}
            </p>
          </div>
        </div>

        {/* Thinking pill */}
        <div style={{
          height: "32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: thinkingLabel ? 1 : 0,
          transition: "opacity 0.22s",
          pointerEvents: "none",
        }}>
          {thinkingLabel && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 14px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "30px",
            }}>
              <Loader2 size={11} color="rgba(255,255,255,0.45)"
                style={{ flexShrink: 0, animation: "vaSpin 1s linear infinite" }} />
              <span style={{
                fontSize: "11px",
                fontWeight: 400,
                color: "rgba(255,255,255,0.50)",
                whiteSpace: "nowrap",
              }}>
                {thinkingLabel}
              </span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {isActive && (<>
            <button
              onClick={handleMute}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: "pointer",
                background: isMuted ? "rgba(255,68,68,0.08)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${isMuted ? "rgba(255,68,68,0.20)" : "rgba(255,255,255,0.09)"}`,
                color: isMuted ? "#ff4444" : "rgba(255,255,255,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s",
              }}
            >
              {isMuted ? <MicOff size={15} /> : <Mic size={15} />}
            </button>

            <button
              onClick={handleEnd}
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background: "rgba(255,68,68,0.08)",
                border: "1px solid rgba(255,68,68,0.18)",
                color: "#ff4444",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,68,68,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,68,68,0.08)"; }}
            >
              <X size={18} />
            </button>

            <button
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: "default",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "rgba(255,255,255,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Volume2 size={15} />
            </button>
          </>)}

          {sessionState === "idle" && (
            <button
              onClick={handleStart}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 22px",
                borderRadius: "30px",
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.80)",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 500,
                fontFamily: "var(--font-sans, 'Geist', sans-serif)",
                transition: "all 0.18s",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.11)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
              }}
            >
              <Mic size={14} strokeWidth={1.5} /> Start session
            </button>
          )}

          {sessionState === "error" && (
            <button
              onClick={() => { setSessionState("idle"); setErrorMsg(""); }}
              style={{
                padding: "9px 20px",
                borderRadius: "30px",
                background: "rgba(255,68,68,0.06)",
                border: "1px solid rgba(255,68,68,0.16)",
                color: "#ff4444",
                cursor: "pointer",
                fontSize: "12.5px",
                fontFamily: "var(--font-sans, 'Geist', sans-serif)",
                fontWeight: 500,
              }}
            >
              Try again
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 12px",
        borderRadius: "30px",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        marginTop: "18px",
      }}>
        {isActive
          ? <Wifi size={11} color="rgba(255,255,255,0.22)" />
          : <Clock size={11} color="rgba(255,255,255,0.18)" />
        }
        <span style={{
          fontSize: "10px",
          color: "rgba(255,255,255,0.20)",
          fontFamily: "var(--font-sans, 'Geist', sans-serif)",
          fontWeight: 400,
          letterSpacing: "0.02em",
        }}>
          {isActive ? "WebSocket · Gemini Live" : "Ready to connect"}
        </span>
      </div>

      <style>{`@keyframes vaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}