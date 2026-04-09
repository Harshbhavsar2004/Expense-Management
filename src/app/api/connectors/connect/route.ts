import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { toolkit } = await req.json();
    if (!toolkit) return NextResponse.json({ error: "Toolkit name required" }, { status: 400 });

    const res = await fetch(`${AGENT_URL}/connectors/connect/${toolkit}?admin_id=${user.id}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Connect API] Error:", error);
    return NextResponse.json({ error: "Failed to connect to agent" }, { status: 500 });
  }
}
