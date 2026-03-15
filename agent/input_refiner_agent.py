"""
Input Refiner Agent (Agent 3)
Normalises free-text user input into structured values.

Examples:
  "today"        → "07 Mar 2026"
  "1000 rs"      → { amount: "Rs. 1,000.00", amountNumeric: 1000.0 }
  "this week"    → "03 Mar 2026 - 07 Mar 2026"
  "1.5k"         → { amount: "Rs. 1,500.00", amountNumeric: 1500.0 }

Mounted at /refine/ on the same FastAPI app (port 8000).
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta
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

def output_normalized_date(
    tool_context: ToolContext,
    normalized_date: str,
    date_range: str,
    original_input: str,
) -> Dict[str, Any]:
    """
    Output a normalized date from free-text user input.

    Args:
        normalized_date: Single date in DD MMM YYYY format (e.g. 07 Mar 2026)
        date_range: Full range string (e.g. "01 Mar 2026 - 07 Mar 2026"),
                    same as normalized_date if single date
        original_input: The raw user input before normalization
    """
    result = {
        "normalizedDate": normalized_date,
        "dateRange": date_range,
        "originalInput": original_input,
    }
    tool_context.state["refined_output"] = result
    safe_print(f"[RefinerAgent] Date: {json.dumps(result)}")
    return {"status": "success", "data": result}


def output_normalized_amount(
    tool_context: ToolContext,
    amount: str,
    amount_numeric: float,
    original_input: str,
) -> Dict[str, Any]:
    """
    Output a normalized monetary amount from free-text user input.

    Args:
        amount: Formatted amount string (e.g. "Rs. 1,500.00")
        amount_numeric: Numeric float value (e.g. 1500.0)
        original_input: The raw user input before normalization
    """
    result = {
        "amount": amount,
        "amountNumeric": amount_numeric,
        "originalInput": original_input,
    }
    tool_context.state["refined_output"] = result
    safe_print(f"[RefinerAgent] Amount: {json.dumps(result)}")
    return {"status": "success", "data": result}


# ─────────────────────────────────────────────────────────────────────────────
# CALLBACKS
# ─────────────────────────────────────────────────────────────────────────────

def refiner_before_agent(callback_context: CallbackContext) -> None:
    callback_context.state["refined_output"] = None
    return None


def refiner_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "InputRefinerAgent":
        return None

    today = datetime.now()
    today_str = today.strftime("%d %b %Y")
    yesterday_str = (today - timedelta(days=1)).strftime("%d %b %Y")
    week_start = (today - timedelta(days=today.weekday())).strftime("%d %b %Y")
    week_end = today_str

    system_prompt = f"""You are the Input Normalisation Agent for Fristine Infotech's expense management system.

Today's date is: {today_str}

Your ONLY job is to call ONE of the two tools:
1. output_normalized_date  — for date/date-range inputs
2. output_normalized_amount — for monetary amount inputs

DATE RULES:
- "today" = {today_str}
- "yesterday" = {yesterday_str}
- "this week" = {week_start} - {week_end}
- "last week" = the full Mon-Sun of the previous week
- "this month" = 01 {today.strftime('%b %Y')} - {today_str}
- If the user gives a specific date, parse it into DD MMM YYYY format
- If a range like "1 march to 5 march" is given, fill both start and end
- Always call output_normalized_date

AMOUNT RULES:
- Strip currency words: rs, rs., rupees, inr, INR
- "1k" = 1000, "1.5k" = 1500, "2.5k" = 2500
- Format as "Rs. X,XXX.XX" (Indian numbering)
- Always call output_normalized_amount

Never respond with plain text. Always call the appropriate tool first, then give a one-line confirmation."""

    original = llm_request.config.system_instruction or types.Content(role="system", parts=[])
    if not isinstance(original, types.Content):
        original = types.Content(role="system", parts=[types.Part(text=str(original))])
    if not original.parts:
        original.parts = [types.Part(text="")]
    original.parts[0].text = system_prompt + (original.parts[0].text or "")
    llm_request.config.system_instruction = original
    return None


def refiner_after_model(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "InputRefinerAgent":
        return None
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

input_refiner_agent = LlmAgent(
    name="InputRefinerAgent",
    model="gemini-2.5-flash",
    instruction="""
        Normalise user-provided dates and amounts into structured output.
        Always call output_normalized_date for dates.
        Always call output_normalized_amount for amounts.
        Never skip calling a tool.
    """,
    tools=[output_normalized_date, output_normalized_amount],
    before_agent_callback=refiner_before_agent,
    before_model_callback=refiner_before_model,
    after_model_callback=refiner_after_model,
)
