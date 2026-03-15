"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { 
  IconSend, 
  IconPlus, 
  IconDotsVertical, 
  IconSearch, 
  IconRobot, 
  IconChecks, 
  IconMaximize, 
  IconMinimize,
  IconPhoto
} from "@tabler/icons-react";
import type { WebCapturedMsg } from "@/app/api/whatsapp/whatsapp";

// ── Types ─────────────────────────────────────────────────────────────────────

type MessageRole = "user" | "bot";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  ts: Date;
  type: string;
  cardData?: any;
}

interface WhatsAppChatProps {
  userName?: string;
  phone?: string;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WhatsAppChat({ userName = "User", phone: initialPhone = "" }: WhatsAppChatProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync phone prop
  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone);
      // If we just got a phone and no messages, send welcome
      if (messages.length === 0) {
        addMessage("bot", "Hello! I'm your AI expense assistant. I can help you log expenses, generate reports, or audit your recent spending. How can I help you today?");
      }
    }
  }, [initialPhone]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const addMessage = (role: MessageRole, content: string, type: string = "text", cardData?: any) => {
    const m: ChatMessage = { id: uid(), role, content, ts: new Date(), type, cardData };
    setMessages((prev) => [...prev, m]);
    return m.id;
  };

  const sendToBot = useCallback(async (payload: any) => {
    if (!phone) {
        setError("User phone not found.");
        return;
    }
    setError(null);
    setIsTyping(true);

    try {
      const res = await fetch("/api/whatsapp/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, userName, ...payload }),
      });

      if (!res.ok) throw new Error("Request failed");
      const data: { messages: WebCapturedMsg[] } = await res.json();

      await new Promise((r) => setTimeout(r, 600));

      data.messages.forEach((m) => {
        if (m.type === "text") {
          addMessage("bot", m.body);
        } else if (m.type === "card" || m.type === "image_card") {
          addMessage("bot", m.body, m.type, m);
        } else if (m.type === "list") {
          addMessage("bot", m.body, "list", m);
        }
      });
    } catch (err) {
      setError("Could not reach the bot.");
    } finally {
      setIsTyping(false);
    }
  }, [phone, userName]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;
    setInputText("");
    addMessage("user", text);
    await sendToBot({ type: "text", text });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isTyping) return;

    // Show optimistic message
    addMessage("user", `Sent an image: ${file.name}`);
    setIsTyping(true);

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Strip the "data:image/x-base64;base64," header for the API
        const base64Data = base64.split(",")[1];
        await sendToBot({ 
          type: "image", 
          mediaBase64: base64Data,
          mediaMimeType: file.type 
        });
      };
      reader.onerror = () => {
        setError("Failed to read the file.");
        setIsTyping(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("File upload error:", err);
      setError("An error occurred during file upload.");
      setIsTyping(false);
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className={`flex flex-col h-full bg-(--bg-secondary) transition-all duration-300 ${isFullScreen ? 'fixed inset-0 z-50' : 'relative'}`}>
      {/* Chat header */}
      <div className="px-6 py-4 bg-(--bg-primary) flex items-center justify-between shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-lg">
            <IconRobot className="text-white w-7 h-7" />
          </div>
          <div>
            <h3 className="typo-h3 text-(--text-primary) leading-tight">Expify AI Bot</h3>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-(--color-success) rounded-full animate-pulse"></span>
                <p className="typo-caption text-(--color-success) font-semibold">online</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <button 
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="p-1 hover:bg-(--bg-tertiary) rounded-full transition-colors text-slate-400 group"
            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isFullScreen ? <IconMinimize size={20} stroke={1.5} className="group-hover:text-blue-500" /> : <IconMaximize size={20} stroke={1.5} className="group-hover:text-blue-500" />}
          </button>
          <IconSearch size={20} stroke={1.5} className="cursor-pointer text-slate-400 hover:text-emerald-500 transition-colors" />
          <IconDotsVertical size={20} stroke={1.5} className="cursor-pointer text-slate-400 hover:text-amber-500 transition-colors" />
        </div>
      </div>

      {/* Message area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-4 flex flex-col scroll-smooth custom-scrollbar"
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundBlendMode: 'overlay' }}
      >
        {messages.map((m) => (
          <div 
            key={m.id}
            className={`flex items-start gap-1 max-w-[85%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}
          >
            <div className={`
              px-3 py-2 shadow-sm relative rounded-lg
              ${m.role === 'user' 
                ? 'bg-blue-500 rounded-tr-none text-white' 
                : 'bg-(--bg-primary) rounded-tl-none text-(--text-primary)'}
            `}>
              <p className="typo-body-default leading-relaxed whitespace-pre-wrap wrap-break-word">{m.content}</p>
              
              {/* Special rendering for cards */}
              {(m.type === 'card' || m.type === 'image_card') && m.cardData && (
                 <div className="mt-3 bg-(--bg-tertiary) rounded-xl p-3 shadow-inner">
                    <div className="flex justify-between items-center mb-2">
                       <span className="typo-overline text-(--accent-primary)!">
                          {m.cardData.header || "DETAILS"}
                       </span>
                       {m.type === 'image_card' && <IconPhoto size={14} className="text-(--text-muted)" />}
                    </div>
                    <div className="typo-body-default text-(--text-secondary) whitespace-pre-line">
                       {m.cardData.body}
                    </div>
                    {m.cardData.buttons && m.cardData.buttons.length > 0 && (
                       <div className="mt-3 flex flex-wrap gap-2">
                          {m.cardData.buttons.map((btn: any) => (
                             <button 
                                key={btn.id}
                                onClick={() => sendToBot({ type: "button_reply", buttonId: btn.id, buttonTitle: btn.label })}
                                className="px-4 py-2 bg-(--accent-primary) text-white typo-button rounded-lg hover:bg-(--accent-primary-hover) active:scale-95 transition-all shadow-sm"
                             >
                                {btn.label}
                             </button>
                          ))}
                       </div>
                    )}
                 </div>
              )}

              {/* Special rendering for lists */}
              {m.type === 'list' && m.cardData && (
                 <div className="mt-3 space-y-2">
                    {m.cardData.sections?.[0]?.rows?.map((row: any) => (
                       <button
                          key={row.id}
                          onClick={() => sendToBot({ type: "list_reply", buttonId: row.id, buttonTitle: row.title })}
                          className="w-full text-left p-3 rounded-xl bg-(--bg-tertiary) hover:bg-(--bg-primary) transition-all shadow-sm group"
                       >
                          <div className="typo-label text-(--text-primary) group-hover:text-(--accent-primary) transition-colors">{row.title}</div>
                          {row.description && <div className="typo-caption text-(--text-muted) mt-0.5 leading-normal">{row.description}</div>}
                       </button>
                    ))}
                 </div>
              )}

              <div className="flex justify-end items-center gap-1 mt-1.5">
                <span className="typo-caption text-(--text-muted)!">{fmtTime(m.ts)}</span>
                {m.role === 'user' && <IconChecks className="text-(--accent-primary) w-3.5 h-3.5" stroke={2} />}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-start gap-1 max-w-[85%] animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="bg-(--bg-primary) rounded-lg rounded-tl-none px-4 py-2 shadow-sm text-(--text-muted) typo-body-small italic flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1 h-1 bg-(--text-muted) rounded-full animate-bounce"></span>
                <span className="w-1 h-1 bg-(--text-muted) rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1 h-1 bg-(--text-muted) rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </span>
              Expify is typing...
            </div>
          </div>
        )}
        {error && (
            <div className="self-center bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-full text-xs font-bold border border-red-100 dark:border-red-900/30 animate-shake">
                {error}
            </div>
        )}
      </div>

      {/* Input bar */}
      <div className="px-4 py-4 bg-(--bg-secondary) shrink-0">
        <div className="flex items-center gap-3 max-w-5xl mx-auto">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-emerald-500 hover:text-emerald-600 transition-all hover:bg-emerald-50 rounded-full shrink-0"
            title="Upload snapshot"
          >
            <IconPlus size={24} stroke={2} />
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*"
            onChange={handleFileUpload}
          />
          
          <div className="flex-1 flex items-center bg-(--bg-primary) rounded-xl px-4 py-2 shadow-sm transition-all outline-none">
            <input 
              type="text" 
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none typo-body-default text-(--text-primary) placeholder:text-(--text-muted)"
            />
          </div>

          <button 
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className={`
              w-11 h-11 rounded-full shadow-md flex items-center justify-center shrink-0 transition-all active:scale-90
              ${inputText.trim() 
                ? 'bg-(--accent-primary) text-white hover:bg-(--accent-primary-hover) shadow-lg' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
            `}
          >
            <IconSend size={20} stroke={2} className={inputText.trim() ? 'ml-0.5' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
