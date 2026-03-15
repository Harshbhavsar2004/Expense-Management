import { supabase } from "@/lib/supabase";
import { NextRequest, NextResponse } from "next/server";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:8000";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: expenseId } = await params;

    // 1. Fetch the expense from Supabase to get the payload
    const { data: expense, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", expenseId)
      .single();

    if (fetchError || !expense) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    // 2. Call the Audit Agent backend
    // The Audit agent expects a specific payload or just triggers based on ID?
    // Based on main.py, audit is at /audit/ and it's an ADK agent.
    // However, audit_agent.py expects "Expense ID" in the prompt.
    
    const response = await fetch(`${AGENT_URL}/audit/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Audit this expense: ${expenseId}`,
        stream: false
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        return NextResponse.json({ error: `Agent error: ${errText}` }, { status: 500 });
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      result: result.output
    });
  } catch (err) {
    console.error("[API] Audit trigger error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
