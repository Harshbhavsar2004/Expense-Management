"""
Audit Agent (Agent 4)
Verifies expense claims by comparing claimed data with receipt data.
"""

from __future__ import annotations

import json
import sys
from typing import Any, Dict, Optional

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
# TOOLS
# ─────────────────────────────────────────────────────────────────────────────

import os
import requests

def update_supabase_expense(expense_id: str, data: Dict[str, Any]) -> None:
    """Updates the expense record in Supabase."""
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_key:
        safe_print("[AuditAgent] Supabase credentials missing from environment.")
        return

    url = f"{supabase_url}/rest/v1/expenses?id=eq.{expense_id}"
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    }
    
    # Map agent output to DB fields
    update_data = {
        "verified": data.get("verified"),
        "mismatches": data.get("mismatches"),
        "amount_match": not data.get("mismatch"),
        "audit_explanation": data.get("explanation"),
        "audit_timeline": data.get("timeline")
    }

    try:
        response = requests.patch(url, headers=headers, json=update_data)
        if response.status_code >= 200 and response.status_code < 300:
            safe_print(f"[AuditAgent] Successfully updated Supabase for expense {expense_id}")
        else:
            safe_print(f"[AuditAgent] Failed to update Supabase: {response.status_code} - {response.text}")
    except Exception as e:
        safe_print(f"[AuditAgent] Error updating Supabase: {e}")

def set_audit_result(
    tool_context: ToolContext,
    expense_id: str,
    is_verified: bool,
    has_mismatch: bool,
    mismatches: list[str],
    explanation: str,
    timeline: list[str],
) -> Dict[str, Any]:
    """
    Set the final audit result for an expense claim and save to database.

    Args:
        expense_id: The unique ID of the expense record being audited. (Found in the prompt).
        is_verified: True if the claim is valid and matches receipts.
        has_mismatch: True if any discrepancies were found.
        mismatches: List of specific mismatch tags (e.g. ["amount_mismatch", "date_mismatch", "policy_mismatch"])
        explanation: A detailed explanation of why the audit reached this verdict.
        timeline: A list of thoughts/steps taken by the agent during analysis for UI display.
    """
    result = {
        "verified": is_verified,
        "mismatch": has_mismatch,
        "mismatches": mismatches,
        "explanation": explanation,
        "timeline": timeline,
    }
    tool_context.state["audit_output"] = result
    safe_print(f"[AuditAgent] Result for {expense_id}: {json.dumps(result)}")

    # Persist to Supabase
    update_supabase_expense(expense_id, result)

    return {"status": "success", "data": result}


# ─────────────────────────────────────────────────────────────────────────────
# CALLBACKS
# ─────────────────────────────────────────────────────────────────────────────

def audit_before_agent(callback_context: CallbackContext) -> None:
    # Safely get session/session_id
    session = getattr(callback_context, 'session', 'unknown')
    safe_print(f"[AuditAgent] on_before_agent called for session {session}")
    callback_context.state["audit_output"] = None
    return None


def audit_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "AuditAgent":
        return None

    safe_print(f"[AuditAgent] on_before_model called")
    
    # Read knowledge base
    kb_path = os.path.join(os.path.dirname(__file__), "knowledgebase.md")
    policy = "No policy found."
    if os.path.exists(kb_path):
        with open(kb_path, "r", encoding="utf-8") as f:
            policy = f.read()

    system_prompt = f"""You are the AI Audit Agent for Fristine Infotech.
Your task is to verify individual expense claims against their associated receipt data AND the company's reimbursement policy.

REIMBURSEMENT POLICY:
{policy}

VERIFICATION RULES:
1. AMOUNT MATCH: If Claimed Amount != Receipt Total, it's a "mismatch". Tag: "amount_mismatch".
2. DATE MATCH: If the transaction date on the receipt differs from the claim date, it's a "mismatch". Tag: "date_mismatch".
3. POLICY COMPLIANCE: 
    - MEALS: Check city category (Tier I, II, III). 
    - If Claimed Amount > Maximum Capping for that city tier, it's a "policy_mismatch".
    - Rule: Reimbursed least of Actual vs Limit.
4. VERDICT: 
    - If all matches and compliant, set verified=True, mismatch=False.
    - If any discrepancy or policy violation, set verified=False, mismatch=True.

You MUST call set_audit_result with your findings.
You MUST extract the 'Expense ID' from the user's prompt and pass it as 'expense_id'.
Include a 'timeline' which is a list of your thought process steps (e.g. ["Checking meal limit for Tier-I...", "Comparing receipt total with claimed..."]).
Provide a concise but professional explanation for the user.
"""

    original = llm_request.config.system_instruction or types.Content(role="system", parts=[])
    if not isinstance(original, types.Content):
        original = types.Content(role="system", parts=[types.Part(text=str(original))])
    if not original.parts:
        original.parts = [types.Part(text="")]
    original.parts[0].text = system_prompt + (original.parts[0].text or "")
    llm_request.config.system_instruction = original
    return None


def audit_after_model(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "AuditAgent":
        return None
    
    safe_print(f"[AuditAgent] on_after_model called")

    if (
        llm_response.content
        and llm_response.content.parts
        and llm_response.content.role == "model"
        and llm_response.content.parts[0].text
    ):
        callback_context._invocation_context.end_invocation = True
    return None


# ─────────────────────────────────────────────────────────────────────────────
# AGENT
# ─────────────────────────────────────────────────────────────────────────────

audit_agent = LlmAgent(
    name="AuditAgent",
    model="gemini-2.5-flash",
    instruction="""
        Audit expense claims by comparing human input with extracted receipt data.
        Always call set_audit_result once you have analyzed the discrepancies.
    """,
    tools=[set_audit_result],
    before_agent_callback=audit_before_agent,
    before_model_callback=audit_before_model,
    after_model_callback=audit_after_model,
)
