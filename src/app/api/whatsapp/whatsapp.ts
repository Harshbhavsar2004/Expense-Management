// ─────────────────────────────────────────────────────────────────────────────
// whatsapp.ts — All WhatsApp Cloud API helpers
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_ID    = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v22.0";
const BASE_URL    = `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`;

// ── Web-chat capture mode ─────────────────────────────────────────────────────
// When a phone number is registered here, outbound messages are stored
// instead of sent to WhatsApp. The web chat API reads them via popCapture().
export type WebCapturedMsg =
  | { type: "text"; body: string }
  | { type: "card"; header: string; body: string; footer: string; buttons: { id: string; label: string }[] }
  | { type: "image_card"; imageUrl: string; body: string; footer: string; buttons: { id: string; label: string }[] }
  | { type: "list"; header: string; body: string; footer: string; buttonLabel: string;
      sections: { title: string; rows: { id: string; title: string; description?: string }[] }[] };

const _captureStore = new Map<string, WebCapturedMsg[]>();

export function startCapture(phone: string): void {
  _captureStore.set(phone, []);
}
export function popCapture(phone: string): WebCapturedMsg[] {
  const msgs = _captureStore.get(phone) ?? [];
  _captureStore.delete(phone);
  return msgs;
}

// Small delay to prevent WhatsApp from jumping to the top of the chat
// when multiple messages are sent in rapid succession.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let _lastSend = 0;

async function post(payload: object): Promise<void> {
  // Rate-limit: ensure at least 1200 ms between consecutive sends
  const now = Date.now();
  const gap = now - _lastSend;
  if (gap < 1200) await sleep(1200 - gap);
  _lastSend = Date.now();

  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    console.error("[WA] API error:", JSON.stringify(err));
  }
}


// ── Plain text ────────────────────────────────────────────────────────────────
export async function sendText(to: string, body: string): Promise<void> {
  if (_captureStore.has(to)) { _captureStore.get(to)!.push({ type: "text", body }); return; }
  await post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: { body, preview_url: false },
  });
}

// ── Interactive card with IMAGE header ───────────────────────────────────────
export async function sendImageCard(
  to: string,
  imageUrl: string,
  body: string,
  footer: string,
  buttons: { id: string; label: string }[]
): Promise<void> {
  if (_captureStore.has(to)) { _captureStore.get(to)!.push({ type: "image_card", imageUrl, body, footer, buttons }); return; }
  await post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "image", image: { link: imageUrl } },
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.label },
        })),
      },
    },
  });
}

// ── Interactive card with TEXT header ────────────────────────────────────────
export async function sendCard(
  to: string,
  header: string,
  body: string,
  footer: string,
  buttons: { id: string; label: string }[]
): Promise<void> {
  if (_captureStore.has(to)) { _captureStore.get(to)!.push({ type: "card", header, body, footer, buttons }); return; }
  await post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      header: { type: "text", text: header },
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.label },
        })),
      },
    },
  });
}

// ── List picker (>3 options) ──────────────────────────────────────────────────
export async function sendList(
  to: string,
  header: string,
  body: string,
  footer: string,
  buttonLabel: string,
  sections: {
    title: string;
    rows: { id: string; title: string; description?: string }[];
  }[]
): Promise<void> {
  if (_captureStore.has(to)) { _captureStore.get(to)!.push({ type: "list", header, body, footer, buttonLabel, sections }); return; }
  await post({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: header },
      body: { text: body },
      footer: { text: footer },
      action: { button: buttonLabel, sections },
    },
  });
}

// ── Mark message as read ─────────────────────────────────────────────────────
// IMPORTANT: Call this as the FIRST thing when a message arrives.
// This tells WhatsApp the message was seen, which keeps the chat
// scrolled to the bottom instead of jumping back to the first message.
export async function markAsRead(messageId: string): Promise<void> {
  await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  });
  // Fire-and-forget — don't await errors, never block message handling
}

// ── Download WhatsApp media → base64 ─────────────────────────────────────────
export async function downloadMedia(
  mediaId: string
): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const metaRes = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${mediaId}`,
      { headers: { Authorization: `Bearer ${ACCESS_TOKEN}` } }
    );
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();

    const mediaRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });
    if (!mediaRes.ok) return null;

    const buf = await mediaRes.arrayBuffer();
    return {
      base64: Buffer.from(buf).toString("base64"),
      mimeType: meta.mime_type || "image/jpeg",
    };
  } catch (e) {
    console.error("[WA] Media download error:", e);
    return null;
  }
}