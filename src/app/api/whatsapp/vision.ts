// ─────────────────────────────────────────────────────────────────────────────
// vision.ts — Calls the VisionAgent REST endpoint on the Python server
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtractedReceiptData } from "./types";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export async function analyseReceipt(
  base64: string,
  mimeType: string
): Promise<ExtractedReceiptData> {
  console.log("[Vision] Sending receipt to /vision/analyse");
  try {
    const res = await fetch(`${AGENT_URL}/vision/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType, mode: "receipt", caption: "" }),
    });

    if (!res.ok) {
      console.error(`[Vision] HTTP ${res.status}:`, await res.text());
      return { rawDescription: "Could not analyse receipt.", status: "UNKNOWN" };
    }

    const json = await res.json();
    if (!json.success) {
      console.error("[Vision] Error:", json.error);
      return { rawDescription: "Receipt analysis failed.", status: "UNKNOWN" };
    }

    // Attach numeric amount for arithmetic
    const data = json.data as ExtractedReceiptData;
    if (data.amount) {
      data.amountNumeric = parseFloat(data.amount.replace(/[^0-9.]/g, "")) || 0;
    }
    console.log("[Vision] Receipt extracted:", JSON.stringify(data, null, 2));
    return data;
  } catch (e) {
    console.error("[Vision] Unexpected error:", e);
    return { rawDescription: "Vision agent unreachable.", status: "UNKNOWN" };
  }
}

export async function analyseGeneralImage(
  base64: string,
  mimeType: string,
  caption?: string
): Promise<string> {
  console.log("[Vision] Sending general image to /vision/analyse");
  try {
    const res = await fetch(`${AGENT_URL}/vision/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType, mode: "general", caption: caption ?? "" }),
    });

    if (!res.ok) return "Could not analyse the image.";
    const json = await res.json();
    return json.data?.description ?? "Image analysed.";
  } catch (e) {
    console.error("[Vision] General image error:", e);
    return "Vision agent unreachable.";
  }
}

export async function predictCategory(
  merchant: string,
  date: string,
  time: string
): Promise<{ category: string; reasoning: string }> {
  console.log("[Vision] Predicting category for:", merchant);
  try {
    const res = await fetch(`${AGENT_URL}/category/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchant, date, time }),
    });

    if (!res.ok) return { category: "Miscellaneous", reasoning: "Agent error" };
    const json = await res.json();
    return {
      category: json.category || "Miscellaneous",
      reasoning: json.reasoning || ""
    };
  } catch (e) {
    console.error("[Vision] Prediction error:", e);
    return { category: "Miscellaneous", reasoning: "Agent unreachable" };
  }
}
