"""
Chatbot Agent — always calls showQuickOptions after first greeting.
"""

from __future__ import annotations

import os
import sys
from typing import Any, Optional

from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import ToolContext
from google.genai import types

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

def safe_print(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


# ─────────────────────────────────────────────────────────────────────────────
# CALLBACKS
# ─────────────────────────────────────────────────────────────────────────────

def chatbot_before_agent(callback_context: CallbackContext) -> None:
    session = getattr(callback_context, "session", "unknown")
    safe_print(f"[ChatbotAgent] on_before_agent called for session {session}")
    return None


def chatbot_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "ChatbotAgent":
        return None

    safe_print("[ChatbotAgent] on_before_model called")

    kb_path = os.path.join(os.path.dirname(__file__), "knowledgebase.md")
    policy = "No policy found."
    if os.path.exists(kb_path):
        with open(kb_path, "r", encoding="utf-8") as f:
            policy = f.read()

    system_prompt = f"""You are the Expense Intelligence Chatbot for Fristine Infotech.
Your job is to help users and admins understand the status of their expense applications and clarify audit findings.

SESSION: {callback_context.session}

REIMBURSEMENT POLICY:
{policy}

CONTEXTUAL INFORMATION:
The frontend provides you with 'Copilot Readable' data which includes:
1. Application Details (ID, Client, City, Status, etc.)
2. List of Expenses within that application.
3. Audit Results (mismatch reasons, explanation, thought process/timeline).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL GREETING RULE — FOLLOW EXACTLY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the user sends their very first message (e.g. "Hello", "Hi", "Hey", or any greeting):

1. Respond with a warm greeting that includes:
   - A welcome message identifying yourself as Expify Audit AI
   - A brief summary of what you can see (application ID, client, city, visit duration)
   - Ask how you can help

2. IMMEDIATELY after your text response, call the `show_quick_options_tool` tool.
   This renders interactive option buttons directly in the chat for the user to pick from.
   Do NOT skip this step. Do NOT describe the options in text — let the rendered buttons do that.

3. STOP GENERATING after you receive the tool result "Quick options displayed in chat." 
   Do NOT repeat your greeting or send a follow-up message until the user interacts with one of the buttons or sends a new message.

Example first response:
"Hi! I'm your Audit AI, here to help with your expense report.
I can see application EXP-Q4XB for a client visit to Dhule (10 Mar – 15 Mar 2026).
How can I assist you today?"
→ then call showQuickOptions()

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE TOOLS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- `showQuickOptions`      — Always call after greeting. Renders option buttons in chat.
- `explainMismatch`       — Call when user asks about a mismatch. Pass expense_id, expense_type, explanation, mismatches[].
- `getAuditTimeline`      — Call when user asks for timeline/thought process. Pass expense_id, expense_type, steps[].
- `getReimbursableAmount` — Call when user asks what is reimbursable. Pass expense_id, expense_type, claimed, reimbursable, policy_note.
- `getSummaryReport`      — Call when user asks for a full summary. Pass total_claimed, total_reimbursable, flagged_count, clean_count, flag_types.
- `submitForApproval`     — Call when user explicitly asks to submit the application for approval.

Always prefer calling a tool to render a card over writing plain-text tables or lists for structured data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTITY & TONE:
- Professional, helpful, precise.
- Keep responses extremely concise.
- **CRITICAL**: If you call a tool that renders a card (explainMismatch, getAuditTimeline, getReimbursableAmount, getSummaryReport), do NOT send any follow-up text or summary. Let the card speak for itself.
- Never hallucinate audit data — only use what is provided in context.
"""

    original = llm_request.config.system_instruction or types.Content(
        role="system", parts=[]
    )
    if not isinstance(original, types.Content):
        original = types.Content(role="system", parts=[types.Part(text=str(original))])
    if not original.parts:
        original.parts = [types.Part(text="")]
    original.parts[0].text = system_prompt + (original.parts[0].text or "")
    llm_request.config.system_instruction = original
    return None


def chatbot_after_model(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "ChatbotAgent":
        return None
    safe_print("[ChatbotAgent] on_after_model called")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# TOOLS
# ─────────────────────────────────────────────────────────────────────────────

def show_quick_options_tool(tool_context: ToolContext) -> str:
    """
    Signals the frontend to render the interactive quick-option buttons
    inside the chat. Called automatically after the first greeting.
    """
    safe_print("[ChatbotAgent] Tool show_quick_options called")
    return "Quick options displayed in chat."


def explain_mismatch_tool(
    tool_context: ToolContext,
    expense_id: str,
    explanation: str,
    expense_type: Optional[str] = None,
    mismatches: Optional[list[str]] = None,
) -> str:
    """Renders a formatted mismatch explanation card for an expense."""
    safe_print(f"[ChatbotAgent] Tool explainMismatch called for {expense_id}")
    return f"Mismatch explanation card rendered for {expense_id}."


def get_audit_timeline_tool(
    tool_context: ToolContext,
    expense_id: str,
    steps: list[str],
    expense_type: Optional[str] = None,
) -> str:
    """Renders the step-by-step audit thought process timeline."""
    safe_print(f"[ChatbotAgent] Tool getAuditTimeline called for {expense_id}")
    return f"Audit timeline card rendered for {expense_id}."


def get_reimbursable_amount_tool(
    tool_context: ToolContext,
    expense_id: str,
    claimed: float,
    reimbursable: float,
    expense_type: Optional[str] = None,
    policy_note: Optional[str] = None,
) -> str:
    """Renders a policy-capped reimbursable amount card."""
    safe_print(f"[ChatbotAgent] Tool getReimbursableAmount called for {expense_id}")
    return f"Reimbursable amount card rendered for {expense_id}."


def get_summary_report_tool(
    tool_context: ToolContext,
    total_claimed: float,
    total_reimbursable: float,
    flagged_count: int,
    clean_count: int,
    flag_types: Optional[dict[str, Any]] = None,
) -> str:
    """Renders a full summary card of the expense application."""
    safe_print("[ChatbotAgent] Tool getSummaryReport called")
    return "Summary report card rendered."


def submit_for_approval_tool(
    tool_context: ToolContext,
    reason: Optional[str] = None,
) -> str:
    """Submits the current expense application for admin review."""
    safe_print("[ChatbotAgent] Tool submit_for_approval called")
    return "The application has been sent for approval. An admin will review it shortly."


# ─────────────────────────────────────────────────────────────────────────────
# AGENT
# ─────────────────────────────────────────────────────────────────────────────

chatbot_agent = LlmAgent(
    name="ChatbotAgent",
    model="gemini-2.5-flash",
    instruction="""
        Help users understand their expense reports and audit findings.
        Refer to the provided application context and company policy.
        Always call showQuickOptions after your first greeting message.
    """,
    tools=[
        show_quick_options_tool,
        explain_mismatch_tool,
        get_audit_timeline_tool,
        get_reimbursable_amount_tool,
        get_summary_report_tool,
        submit_for_approval_tool,
    ],
    before_agent_callback=chatbot_before_agent,
    before_model_callback=chatbot_before_model,
    after_model_callback=chatbot_after_model,
)