import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const res = await fetch(`${AGENT_URL}/connectors/status/${user.id}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Status API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 });
  }
}
