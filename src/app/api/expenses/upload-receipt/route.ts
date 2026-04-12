import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { base64, mimeType, expenseId } = body as {
      base64: string;
      mimeType: string;
      expenseId: string;
    };

    if (!base64 || !mimeType || !expenseId) {
      return NextResponse.json({ error: "Missing base64, mimeType, or expenseId" }, { status: 400 });
    }

    // ── 1. Call Python vision agent ────────────────────────────────────
    const visionRes = await fetch(`${AGENT_URL}/vision/analyse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base64, mimeType, mode: "receipt", caption: "" }),
    });

    if (!visionRes.ok) {
      return NextResponse.json({ error: "Vision agent error" }, { status: 502 });
    }

    const visionJson = await visionRes.json();
    if (!visionJson.success) {
      return NextResponse.json({ error: visionJson.error || "Receipt analysis failed" }, { status: 422 });
    }

    const extracted = visionJson.data as {
      amount?: string;
      date?: string;
      time?: string;
      merchant?: string;
      status?: string;
      rawDescription?: string;
    };

    // ── 2. Category prediction based on merchant ───────────────────────
    let category = "Miscellaneous";
    if (extracted.merchant) {
      try {
        const catRes = await fetch(`${AGENT_URL}/category/predict`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            merchant: extracted.merchant,
            date: extracted.date || new Date().toISOString().split("T")[0],
            time: extracted.time || "12:00",
          }),
        });
        if (catRes.ok) {
          const catJson = await catRes.json();
          category = catJson.category || "Miscellaneous";
        }
      } catch { /* ignore, default to Miscellaneous */ }
    }

    // ── 3. Upload image to Supabase Storage ────────────────────────────
    const ext = mimeType.split("/")[1]?.split("+")[0] || "jpg";
    const filename = `cash_receipt_${user.id}_${Date.now()}.${ext}`;
    const imageBytes = Buffer.from(base64, "base64");

    let imageUrl: string | null = null;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("receipts")
      .upload(filename, imageBytes, { contentType: mimeType, upsert: false });

    if (!uploadError && uploadData) {
      const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(filename);
      imageUrl = publicUrl;
    }

    // ── 4. Insert receipt record ───────────────────────────────────────
    const amountNumeric = extracted.amount
      ? parseFloat(extracted.amount.replace(/[^0-9.]/g, "")) || null
      : null;

    const { data: receiptRow, error: receiptErr } = await supabase
      .from("receipts")
      .insert({
        expense_id: expenseId,
        image_url: imageUrl,
        extracted_amount: amountNumeric,
        transaction_date: extracted.date || null,
        transaction_time: extracted.time || null,
        merchant: extracted.merchant || null,
        utr_number: null, // cash payment — no UTR
      })
      .select()
      .single();

    if (receiptErr) {
      console.error("[upload-receipt] Receipt insert error:", receiptErr);
    }

    // ── 5. Update expense category if meaningful ───────────────────────
    if (category && category !== "Miscellaneous") {
      await supabase
        .from("expenses")
        .update({ expense_type: category })
        .eq("id", expenseId)
        .eq("user_id", user.id);
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      extracted,
      category,
      receiptId: receiptRow?.id ?? null,
    });
  } catch (err: any) {
    console.error("[upload-receipt]", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
