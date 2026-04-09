import { NextRequest, NextResponse } from "next/server";

const AGENT = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    const raw = await req.text();
    console.log("[voice/offer] Raw body length:", raw.length, "| first 200:", raw.slice(0, 200));
    body = JSON.parse(raw);
  } catch (parseErr) {
    console.error("[voice/offer] Failed to parse request body:", parseErr);
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const res = await fetch(`${AGENT}/voice/offer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log("[voice/offer] Python responded:", res.status, JSON.stringify(data).slice(0, 200));
    return NextResponse.json(data, { status: res.status });
  } catch (fetchErr) {
    console.error("[voice/offer] fetch to Python failed:", fetchErr);
    return NextResponse.json({ error: "Could not reach voice agent server." }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${AGENT}/voice/ice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[voice/ice] Error:", err);
    return NextResponse.json({ error: "Could not reach voice agent server." }, { status: 503 });
  }
}
