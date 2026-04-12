import { useState, useRef, useEffect, useCallback } from "react";
import {
  IconSend,
  IconDotsVertical,
  IconRobot,
  IconChecks,
  IconMaximize,
  IconMinimize,
  IconPhoto,
  IconTableImport,
  IconX,
  IconSparkles,
  IconLoader2,
  IconMicrophone,
  IconPlayerStop,
} from "@tabler/icons-react";
import { toast } from "sonner";
import type { WebCapturedMsg } from "@/app/api/whatsapp/whatsapp";
import type { ParsedExcelRow } from "@/app/api/expenses/parse-excel/route";
import { cn } from "@/lib/utils";

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

const uid = () => Math.random().toString(36).slice(2);
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

// WhatsApp SVG background pattern (inline, no external dependency)
const WA_BG_STYLE: React.CSSProperties = {
  backgroundColor: "#e5ddd5",
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23b2a99e' fill-opacity='0.18' fill-rule='evenodd'%3E%3Ccircle cx='10' cy='10' r='3'/%3E%3Ccircle cx='50' cy='10' r='3'/%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3Ccircle cx='70' cy='30' r='2'/%3E%3Ccircle cx='10' cy='50' r='3'/%3E%3Ccircle cx='50' cy='50' r='3'/%3E%3Ccircle cx='30' cy='70' r='2'/%3E%3Ccircle cx='70' cy='70' r='2'/%3E%3C/g%3E%3C/svg%3E")`,
};

// ── Excel import modal ────────────────────────────────────────────────────────

interface ExcelImportModalProps {
  rows: ParsedExcelRow[];
  onConfirm: (details: { clientName: string; city: string; visitDuration: string }) => void;
  onCancel: () => void;
}

function ExcelImportModal({ rows, onConfirm, onCancel }: ExcelImportModalProps) {
  const [clientName,    setClientName]    = useState("");
  const [city,          setCity]          = useState("");
  const [visitDuration, setVisitDuration] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !city.trim() || !visitDuration.trim()) return;
    onConfirm({ clientName: clientName.trim(), city: city.trim(), visitDuration: visitDuration.trim() });
  };

  return (
    <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-7 w-full max-w-md shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-300">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-zinc-900 tracking-tight">Import Expenses</h3>
            <p className="text-sm text-zinc-500 mt-0.5">
              Found <strong className="text-zinc-900">{rows.length}</strong> items in the sheet
            </p>
          </div>
          <button onClick={onCancel} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors">
            <IconX size={18} />
          </button>
        </div>

        <div className="bg-zinc-50 rounded-2xl border border-zinc-100 p-2 space-y-1 mb-6 max-h-36 overflow-y-auto">
          {rows.slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-zinc-100">
              <div className="min-w-0 flex-1 mr-3">
                <div className="text-[13px] font-bold text-zinc-800 truncate">{r.description || "No description"}</div>
                <div className="text-[11px] text-zinc-400 font-medium">{r.date}</div>
              </div>
              <div className="text-[13px] font-bold text-zinc-900">₹{r.amount}</div>
            </div>
          ))}
          {rows.length > 5 && (
            <div className="text-center py-1.5 text-[11px] font-bold text-zinc-400">
              +{rows.length - 5} more
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: "Client Name", value: clientName, set: setClientName, placeholder: "e.g. ABC Pharmaceuticals" },
            { label: "City", value: city, set: setCity, placeholder: "e.g. Mumbai" },
            { label: "Date Range", value: visitDuration, set: setVisitDuration, placeholder: "e.g. 20 Nov – 30 Nov" },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">{label}</label>
              <input
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-teal-500 focus:ring-0 outline-none text-sm font-medium transition-colors"
                placeholder={placeholder}
                value={value}
                onChange={(e) => set(e.target.value)}
                required
              />
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 text-sm font-bold text-zinc-500 hover:bg-zinc-100 rounded-xl transition-colors">
              Cancel
            </button>
            <button type="submit" className="flex-[2] py-2.5 bg-[#075E54] text-white rounded-xl text-sm font-bold hover:bg-[#064d43] transition-all shadow-md active:scale-95">
              Confirm Import
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function WhatsAppChat({ userName = "User", phone: initialPhone = "" }: WhatsAppChatProps) {
  const [phone, setPhone]               = useState(initialPhone);
  const [inputText, setInputText]       = useState("");
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isListening, setIsListening]   = useState(false);

  // Excel import state
  const [excelRows,      setExcelRows]      = useState<ParsedExcelRow[]>([]);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [isImporting,    setIsImporting]    = useState(false);

  const scrollRef      = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const excelInputRef  = useRef<HTMLInputElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Sync phone prop
  useEffect(() => {
    if (initialPhone) {
      setPhone(initialPhone);
      if (messages.length === 0) {
        addMessage(
          "bot",
          "Hello! I'm your AI expense assistant. I can help you log expenses, generate reports, or audit your recent spending. How can I help you today?"
        );
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhone]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const addMessage = (role: MessageRole, content: string, type = "text", cardData?: any) => {
    const m: ChatMessage = { id: uid(), role, content, ts: new Date(), type, cardData };
    setMessages((prev) => [...prev, m]);
    return m.id;
  };

  const sendToBot = useCallback(
    async (payload: any) => {
      if (!phone) { setError("User phone not found."); return; }
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
          if (m.type === "text") addMessage("bot", m.body);
          else if (m.type === "card" || m.type === "image_card") addMessage("bot", m.body, m.type, m);
          else if (m.type === "list") addMessage("bot", m.body, "list", m);
        });
      } catch {
        setError("Could not reach the assistant.");
      } finally {
        setIsTyping(false);
      }
    },
    [phone, userName]
  );

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
    addMessage("user", `📎 ${file.name}`);
    setIsTyping(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await sendToBot({ type: "image", mediaBase64: base64, mediaMimeType: file.type });
      };
      reader.onerror = () => { setError("Failed to read file."); setIsTyping(false); };
      reader.readAsDataURL(file);
    } catch {
      setError("Upload error."); setIsTyping(false);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleExcelFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (excelInputRef.current) excelInputRef.current.value = "";
    const toastId = toast.loading("Reading Excel file…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/expenses/parse-excel", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Parse failed");
      const { rows } = await res.json();
      toast.dismiss(toastId);
      if (!rows?.length) { toast.error("No expense rows found."); return; }
      setExcelRows(rows);
      setShowExcelModal(true);
    } catch {
      toast.error("Could not read the Excel file.", { id: toastId });
    }
  };

  const processExcelImport = async (details: { clientName: string; city: string; visitDuration: string }) => {
    setShowExcelModal(false);
    setIsImporting(true);
    const rows = excelRows;
    const createToastId = toast.loading("Creating application…");
    let applicationId = "";
    let cityTier = "Tier - III";
    try {
      const res = await fetch("/api/applications/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(details),
      });
      if (!res.ok) throw new Error("Create failed");
      const data = await res.json();
      applicationId = data.applicationId;
      cityTier = data.cityTier;
      toast.success(`Application ${applicationId} created`, { id: createToastId });
    } catch {
      toast.error("Failed to create application.", { id: createToastId });
      setIsImporting(false);
      return;
    }
    let passed = 0, flagged = 0;
    const progressId = toast.loading(`Processing 1 of ${rows.length}…`);
    for (let i = 0; i < rows.length; i++) {
      toast.loading(`Processing ${i + 1} of ${rows.length} — ${rows[i].description}`, { id: progressId });
      try {
        const res = await fetch("/api/expenses/process-row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ row: rows[i], applicationId, clientName: details.clientName, city: details.city, cityTier, visitDuration: details.visitDuration }),
        });
        const data = await res.json();
        if (data.auditResult?.mismatches?.length) flagged++; else passed++;
      } catch { flagged++; }
    }
    toast.dismiss(progressId);
    toast.success(`Complete: ${applicationId} ready`, { duration: 8000 });
    addMessage("bot", `✅ Import complete!\n\nApplication *${applicationId}* created with ${rows.length} expenses.\n• ✔ Clean: ${passed}\n• ⚠ Flagged: ${flagged}\n\nYou can now review these in the applications section.`);
    setIsImporting(false);
    setExcelRows([]);
  };

  // ── Voice input ──────────────────────────────────────────────────────────────

  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition is not supported in this browser."); return; }
    const recognition = new SR();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      setInputText((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
      inputRef.current?.focus();
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend   = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {showExcelModal && (
        <ExcelImportModal
          rows={excelRows}
          onConfirm={processExcelImport}
          onCancel={() => { setShowExcelModal(false); setExcelRows([]); }}
        />
      )}

      <div
        className={cn(
          "flex flex-col h-full overflow-hidden transition-all duration-300",
          isFullScreen ? "fixed inset-0 z-[100]" : "relative"
        )}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: "#075E54" }}>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-[#128C7E] flex items-center justify-center shrink-0 ring-2 ring-white/20">
            <IconRobot className="text-white w-5 h-5" />
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-white leading-tight">Expify Assistant</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#25D366] animate-pulse" />
              <span className="text-[11px] text-white/60 font-medium">online</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              {isFullScreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
            </button>
            <button className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-all">
              <IconDotsVertical size={18} />
            </button>
          </div>
        </div>

        {/* ── Messages ── */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar"
          style={WA_BG_STYLE}
        >
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ background: "rgba(7,94,84,0.12)" }}
              >
                <IconRobot size={32} style={{ color: "#075E54" }} />
              </div>
              <p className="text-sm font-semibold text-[#54656f] max-w-[220px] leading-relaxed">
                Send a message to start chatting with your AI expense assistant.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "flex",
                m.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[78%] px-3 py-2 shadow-sm",
                  m.role === "user"
                    ? "rounded-[12px] rounded-tr-[3px] text-[#111b21]"
                    : "rounded-[12px] rounded-tl-[3px] text-[#111b21]"
                )}
                style={{
                  background: m.role === "user" ? "#dcf8c6" : "#ffffff",
                }}
              >
                <p className="text-[14.5px] leading-relaxed whitespace-pre-wrap break-words">
                  {m.content}
                </p>

                {/* AI Insight card */}
                {(m.type === "card" || m.type === "image_card") && m.cardData && (
                  <div className="mt-3 rounded-xl border border-[#e9edef] overflow-hidden" style={{ background: "#f0f2f5" }}>
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e9edef]">
                      <div className="p-1 rounded-md" style={{ background: "#25D36620" }}>
                        <IconSparkles size={12} style={{ color: "#128C7E" }} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#667781" }}>AI Insights</span>
                    </div>
                    <div className="px-3 py-2 text-[13px] leading-relaxed italic" style={{ color: "#3b4a54" }}>
                      "{m.cardData.body}"
                    </div>
                    {m.cardData.buttons?.map((btn: any) => (
                      <button
                        key={btn.id}
                        onClick={() => sendToBot({ type: "button_reply", buttonId: btn.id, buttonTitle: btn.label })}
                        className="w-full py-2.5 text-[13px] font-bold border-t border-[#e9edef] transition-all active:scale-[0.99]"
                        style={{ color: "#128C7E", background: "transparent" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#e9edef")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* List picker */}
                {m.type === "list" && m.cardData && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {m.cardData.sections?.[0]?.rows?.map((row: any) => (
                      <button
                        key={row.id}
                        onClick={() => sendToBot({ type: "list_reply", buttonId: row.id, buttonTitle: row.title })}
                        className="w-full text-left px-3 py-2.5 rounded-xl border border-[#e9edef] bg-white hover:border-[#128C7E] transition-all group"
                      >
                        <div className="text-[13px] font-bold text-[#111b21] group-hover:text-[#075E54] transition-colors">
                          {row.title}
                        </div>
                        {row.description && (
                          <div className="text-[11px] mt-0.5" style={{ color: "#667781" }}>{row.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Timestamp + ticks */}
                <div className={cn("flex items-center gap-1 mt-1", m.role === "user" ? "justify-end" : "justify-start")}>
                  <span className="text-[10px]" style={{ color: m.role === "user" ? "#667781" : "#667781" }}>
                    {fmtTime(m.ts)}
                  </span>
                  {m.role === "user" && (
                    <IconChecks size={14} style={{ color: "#53bdeb" }} stroke={2.5} />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="px-4 py-3 rounded-[12px] rounded-tl-[3px] shadow-sm bg-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-bounce bg-[#8696a0]" style={{ animationDuration: "700ms", animationDelay: "0ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce bg-[#8696a0]" style={{ animationDuration: "700ms", animationDelay: "150ms" }} />
                <span className="w-2 h-2 rounded-full animate-bounce bg-[#8696a0]" style={{ animationDuration: "700ms", animationDelay: "300ms" }} />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[12px] font-semibold bg-[#fff3cd] text-[#856404] border border-[#ffeaa7]">
                <IconX size={13} />
                {error}
              </div>
            </div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div className="px-3 py-2.5 shrink-0 flex items-end gap-2" style={{ background: "#f0f2f5" }}>
          {/* Attachment icons */}
          <div className="flex items-center gap-0.5 mb-0.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-full transition-all"
              style={{ color: "#54656f" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e9edef")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="Upload receipt image"
            >
              <IconPhoto size={22} stroke={1.8} />
            </button>
            <button
              onClick={() => excelInputRef.current?.click()}
              disabled={isImporting}
              className="p-2.5 rounded-full transition-all disabled:opacity-30"
              style={{ color: "#54656f" }}
              onMouseEnter={e => { if (!isImporting) e.currentTarget.style.background = "#e9edef"; }}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="Import Excel sheet"
            >
              {isImporting
                ? <IconLoader2 size={22} className="animate-spin" />
                : <IconTableImport size={22} stroke={1.8} />
              }
            </button>
          </div>

          <input type="file" ref={fileInputRef}  className="hidden" accept="image/*"          onChange={handleFileUpload} />
          <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx,.xls,.csv"  onChange={handleExcelFileSelect} />

          {/* Text input */}
          <div className="flex-1 flex items-center bg-white rounded-[24px] px-4 py-2.5 shadow-sm">
            <input
              ref={inputRef}
              type="text"
              placeholder={isListening ? "Listening…" : isImporting ? "Processing…" : "Type a message"}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-[15px] text-[#111b21] placeholder:text-[#8696a0]"
            />
            {/* Voice button */}
            <button
              onClick={toggleVoice}
              className={cn(
                "ml-2 p-1.5 rounded-full transition-all shrink-0",
                isListening
                  ? "bg-red-100 text-red-500 animate-pulse"
                  : "text-[#54656f] hover:bg-[#f0f2f5]"
              )}
              title={isListening ? "Stop recording" : "Voice input"}
            >
              {isListening
                ? <IconPlayerStop size={18} stroke={2} />
                : <IconMicrophone size={18} stroke={1.8} />
              }
            </button>
          </div>

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
            style={{ background: "#25D366" }}
          >
            <IconSend size={20} stroke={2} className="text-white ml-0.5" />
          </button>
        </div>
      </div>
    </>
  );
}
