"""
Chatbot Agent — always calls showQuickOptions after first greeting.
"""

from __future__ import annotations

import json
import os
import re
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

def strip_embeddings(data: Any) -> Any:
    """Recursively remove keys named 'embedding' from dicts and lists."""
    if isinstance(data, dict):
        return {k: strip_embeddings(v) for k, v in data.items() if k != "embedding"}
    elif isinstance(data, list):
        return [strip_embeddings(item) for item in data]
    return data


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
MISMATCH TAG GUIDE — use this when explaining any flagged expense:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. amount_mismatch
   What it means: The amount you claimed does not match the amount shown on the receipt (difference ≥ ₹1).
   What to do: Re-upload the correct receipt or raise a correction request.

2. date_mismatch
   What it means: The date on your uploaded receipt screenshot does not match the expense date you entered.
   What to do: Verify the receipt corresponds to the expense date, or re-enter the correct date.

3. date_range_mismatch
   What it means: Your receipt date falls outside the authorised trip/visit window for this application.
   What to do: Ensure the expense happened within the approved visit period, or create a new application for the correct dates.

4. policy_exceeded
   What it means: The claimed amount is above your approved spending limit for that category and city tier.
   What to do: Only the policy-allowed amount will be reimbursed. Contact your manager if you need a temporary limit increase.

5. failed_screenshot
   What it means: The payment screenshot shows status FAILED — meaning the transaction was never completed and no money was debited.
   What to do: Re-upload a SUCCESS screenshot for the actual payment you made.

6. duplicate_receipt
   What it means: The UTR (transaction reference) on this receipt was already used in a previous expense submission.
   What to do: This is likely a duplicate submission. If it was a genuine separate expense, contact admin to resolve.

7. receipt_quality_issue
   What it means: The payment status on the screenshot is PENDING or UNKNOWN — the transaction has not been confirmed yet.
   What to do: Wait for the payment to succeed and re-upload a SUCCESS screenshot.

8. category_policy_violation
   What it means: The expense category (e.g., Travel, Hotel) is not permitted under your current policy.
   What to do: Contact admin if you believe this should be approved as an exception.

9. per_person_limit_exceeded
   What it means: When the total meal amount is divided across all participants, the per-person share exceeds the meal policy limit for your city tier.
   What to do: Only the policy-allowed per-person amount will be reimbursed for each participant.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVAILABLE TOOLS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- `getSummaryReport`      — Call when user asks for a full summary. Pass total_claimed, total_reimbursable, flagged_count, clean_count, flag_types.

Always prefer calling a tool to render a card over writing plain-text tables or lists for structured data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTITY & TONE:
- Professional, helpful, precise.
- Keep responses extremely concise.
- **CRITICAL**: If you call a tool that renders a card (explainMismatch, getAuditTimeline, getReimbursableAmount, getSummaryReport), do NOT send any follow-up text or summary. Let the card speak for itself.
- Never hallucinate audit data — only use what is provided in context.
"""

    # ── 1. Clean llm_request.contents (messages) ──────────────────────────
    # The frontend often sends 'Copilot Readable' data which includes huge
    # 768-dim embeddings. We strip these to save tokens and prevent LLM failure.
    for content in (llm_request.contents or []):
        for part in (content.parts or []):
            if hasattr(part, "text") and part.text:
                try:
                    # If it's pure JSON, parse, strip, and re-serialize
                    obj = json.loads(part.text)
                    part.text = json.dumps(strip_embeddings(obj))
                except (json.JSONDecodeError, TypeError):
                    # If it's text containing JSON fragments, use regex replacement for the "embedding": [...] pattern
                    # Handle both "embedding":[...] and "embedding": [...]
                    part.text = re.sub(
                        r'"embedding"\s*:\s*\[[^\]]*\]',
                        '"embedding": []',
                        part.text
                    )

    # ── 2. Inject system prompt ───────────────────────────────────────────
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
    sources: Optional[dict[str, str]] = None,
) -> str:
    """
    Renders a formatted mismatch explanation card for an expense.
    sources is a dict mapping each mismatch tag to its evidence string,
    e.g. {"duplicate_receipt": "UTR 123 already used in EXP-ABCD on 15 Mar 2026"}.
    """
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
    ],
    before_agent_callback=chatbot_before_agent,
    before_model_callback=chatbot_before_model,
    after_model_callback=chatbot_after_model,
)