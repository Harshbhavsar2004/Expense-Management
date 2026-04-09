import { NextResponse } from "next/server";

export async function POST() {
  try {
    const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";
    const res = await fetch(`${agentUrl}/voice/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach the voice agent server. Is it running?" },
      { status: 503 }
    );
  }
}
