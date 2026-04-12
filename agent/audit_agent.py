"""
Audit Agent (Agent 4) — 9-rule mismatch engine
Pre-flight checks (policy fetch, UTR duplicate, date range) run in Python
BEFORE the LLM call so results are injected as authoritative facts.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import ToolContext, google_search, AgentTool
from google.genai import types
from embedding_service import embed_expense_after_audit

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def safe_print(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE HELPERS  (pre-flight — called before LLM, not by LLM)
# ─────────────────────────────────────────────────────────────────────────────

def _supabase_url() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")

def _headers() -> Dict[str, str]:
    """Anon key is sufficient — all cross-user queries use SECURITY DEFINER RPCs."""
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def fetch_user_id_by_phone(phone: str) -> Optional[str]:
    """Get user UUID from public.users by phone number."""
    if not phone or not _supabase_url():
        return None
    try:
        r = requests.get(
            f"{_supabase_url()}/rest/v1/users?select=id&phone=eq.{phone}&limit=1",
            headers=_headers(), timeout=5,
        )
        data = r.json()
        if isinstance(data, list) and data:
            return data[0].get("id")
    except Exception as e:
        safe_print(f"[AuditAgent] fetch_user_id error: {e}")
    return None


def fetch_all_policies_summary() -> str:
    """
    Fetch all rows from public.policies (with overrides) and return a
    formatted summary for the audit system prompt.
    Falls back to hardcoded company defaults if Supabase is unavailable.
    """
    defaults_text = (
        "Company defaults (Supabase unavailable):\n"
        "  Meal Tier I: ₹900/day | Tier II: ₹700/day | Tier III: ₹450/day\n"
        "  Travel: allowed (no cap) | Hotel: allowed (no cap)\n"
        "  Receipt required: Yes | Reimbursement cycle: 15–25 of month"
    )

    if not _supabase_url():
        return defaults_text

    try:
        r = requests.get(
            f"{_supabase_url()}/rest/v1/policies"
            "?select=user_name,meal_tier1_limit,meal_tier2_limit,meal_tier3_limit,"
            "travel_allowed,travel_daily_limit,hotel_allowed,hotel_daily_limit,"
            "requires_receipt,reimbursement_cycle,is_active,"
            "override_meal_tier1_limit,override_meal_tier2_limit,override_meal_tier3_limit,"
            "override_travel_daily_limit,override_hotel_daily_limit,"
            "override_valid_from,override_valid_until,override_reason"
            "&is_active=eq.true&order=user_name.asc",
            headers=_headers(),
            timeout=5,
        )
        rows = r.json()
        if not isinstance(rows, list) or not rows:
            return defaults_text

        lines = ["Company Policy Table (live from Supabase — active users only):"]
        lines.append(f"  Standard limits: Meal Tier I ₹{rows[0].get('meal_tier1_limit', 900)}/day | "
                     f"Tier II ₹{rows[0].get('meal_tier2_limit', 700)}/day | "
                     f"Tier III ₹{rows[0].get('meal_tier3_limit', 450)}/day")
        lines.append(f"  Receipt required: {rows[0].get('requires_receipt', True)} | "
                     f"Reimbursement cycle: {rows[0].get('reimbursement_cycle', '15-25 of month')}")
        lines.append("")

        overridden = [p for p in rows if p.get("override_meal_tier1_limit") or
                      p.get("override_travel_daily_limit") or p.get("override_hotel_daily_limit")]
        if overridden:
            lines.append("  Active overrides:")
            for p in overridden:
                valid_from = (p.get("override_valid_from") or "")[:10]
                valid_until = (p.get("override_valid_until") or "")[:10]
                parts = []
                if p.get("override_meal_tier1_limit"):
                    parts.append(f"Meal Tier I → ₹{p['override_meal_tier1_limit']}/day")
                if p.get("override_travel_daily_limit"):
                    parts.append(f"Travel → ₹{p['override_travel_daily_limit']}/day")
                if p.get("override_hotel_daily_limit"):
                    parts.append(f"Hotel → ₹{p['override_hotel_daily_limit']}/day")
                lines.append(
                    f"    {p.get('user_name', 'Unknown')}: {', '.join(parts)} "
                    f"({valid_from} – {valid_until}) reason: {p.get('override_reason', '—')}"
                )

        return "\n".join(lines)

    except Exception as e:
        safe_print(f"[AuditAgent] fetch_all_policies_summary error: {e}")
        return defaults_text


def fetch_user_effective_policy(
    user_phone: str,
    user_id_override: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch user's effective policy via the get_effective_policy(UUID) RPC.
    The RPC is SECURITY DEFINER so the anon key is sufficient.

    user_id_override: UUID passed directly in the audit prompt (preferred).
    Falls back to phone lookup only when override is absent.
    Falls back to global defaults (900/700/450) if user not found.
    """
    defaults: Dict[str, Any] = {
        "found": False,
        "meal_tier1_limit": 900,
        "meal_tier2_limit": 700,
        "meal_tier3_limit": 450,
        "travel_allowed": True,
        "hotel_allowed": True,
        "travel_daily_limit": None,
        "hotel_daily_limit": None,
        "has_active_override": False,
        "override_reason": None,
    }

    if not _supabase_url():
        return defaults

    # Prefer direct UUID (no extra DB round-trip, no RLS issues)
    user_id = user_id_override
    if not user_id:
        if not user_phone:
            return defaults
        user_id = fetch_user_id_by_phone(user_phone)

    if not user_id:
        safe_print(f"[AuditAgent] No user found for phone {user_phone} — using global defaults")
        return defaults

    try:
        # Call the SECURITY DEFINER function (not the view directly)
        # This bypasses RLS so the anon key can read any user's policy
        r = requests.post(
            f"{_supabase_url()}/rest/v1/rpc/get_effective_policy",
            headers=_headers(),
            json={"p_user_id": user_id},
            timeout=5,
        )
        data = r.json()
        # RPC returns a list of rows
        if isinstance(data, list) and data:
            p = data[0]
            return {
                "found": True,
                "meal_tier1_limit":   float(p.get("effective_meal_tier1_limit") or 900),
                "meal_tier2_limit":   float(p.get("effective_meal_tier2_limit") or 700),
                "meal_tier3_limit":   float(p.get("effective_meal_tier3_limit") or 450),
                "travel_allowed":     bool(p.get("travel_allowed", True)),
                "hotel_allowed":      bool(p.get("hotel_allowed", True)),
                "travel_daily_limit": p.get("effective_travel_daily_limit"),
                "hotel_daily_limit":  p.get("effective_hotel_daily_limit"),
                "has_active_override": bool(p.get("has_active_override", False)),
                "override_reason":    p.get("override_reason"),
            }
        elif isinstance(data, dict):
            # Some Supabase versions return a single object for set-returning functions
            p = data
            return {
                "found": True,
                "meal_tier1_limit":   float(p.get("effective_meal_tier1_limit") or 900),
                "meal_tier2_limit":   float(p.get("effective_meal_tier2_limit") or 700),
                "meal_tier3_limit":   float(p.get("effective_meal_tier3_limit") or 450),
                "travel_allowed":     bool(p.get("travel_allowed", True)),
                "hotel_allowed":      bool(p.get("hotel_allowed", True)),
                "travel_daily_limit": p.get("effective_travel_daily_limit"),
                "hotel_daily_limit":  p.get("effective_hotel_daily_limit"),
                "has_active_override": bool(p.get("has_active_override", False)),
                "override_reason":    p.get("override_reason"),
            }
    except Exception as e:
        safe_print(f"[AuditAgent] fetch_user_effective_policy error: {e}")

    return defaults


def check_duplicate_utr(utr_number: str, current_expense_id: str) -> Dict[str, Any]:
    """
    Call check_utr_duplicate RPC (SECURITY DEFINER) — searches ALL users' receipts.
    The anon key is sufficient because the function bypasses RLS server-side.
    """
    result: Dict[str, Any] = {
        "is_duplicate": False,
        "existing_expense_id": None,
        "existing_created_at": None,
    }

    if not utr_number or utr_number.strip() in ("", "None", "null", "—", "not provided"):
        return result
    if not _supabase_url():
        return result

    try:
        r = requests.post(
            f"{_supabase_url()}/rest/v1/rpc/check_utr_duplicate",
            headers=_headers(),
            json={
                "p_utr_number":         utr_number,
                "p_current_expense_id": current_expense_id,
            },
            timeout=5,
        )
        data = r.json()
        # RPC returns a list of rows
        rows = data if isinstance(data, list) else ([data] if isinstance(data, dict) else [])
        if rows:
            row = rows[0]
            result["is_duplicate"]        = bool(row.get("is_duplicate", False))
            result["existing_expense_id"] = row.get("existing_expense_id")
            result["existing_created_at"] = row.get("existing_created_at")
            if result["is_duplicate"]:
                safe_print(
                    f"[AuditAgent] Duplicate UTR {utr_number} found in "
                    f"expense {result['existing_expense_id']}"
                )
    except Exception as e:
        safe_print(f"[AuditAgent] check_duplicate_utr error: {e}")

    return result


def is_date_in_visit_range(receipt_date_str: str, visit_duration: str) -> Optional[bool]:
    """
    Return True/False if receipt_date falls inside visit_duration range.
    Returns None if dates cannot be parsed.
    """
    if not receipt_date_str or not visit_duration:
        return None

    DATE_FORMATS = ["%d %b %Y", "%d %B %Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"]

    def parse(s: str) -> Optional[datetime]:
        s = s.strip()
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                pass
        return None

    parts = re.split(r"\s*[-–—]\s*", visit_duration.strip())
    if len(parts) < 2:
        return None

    start = parse(parts[0])
    end   = parse(parts[-1])
    rdate = parse(receipt_date_str)

    if not start or not end or not rdate:
        return None

    return start.date() <= rdate.date() <= end.date()


# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE UPDATE  (called after LLM produces verdict)
# ─────────────────────────────────────────────────────────────────────────────

def update_supabase_expense(expense_id: str, data: Dict[str, Any]) -> None:
    """Persist audit results back to public.expenses."""
    if not _supabase_url():
        safe_print("[AuditAgent] Supabase URL missing — cannot save audit result.")
        return

    update_payload = {
        "verified":           data.get("verified"),
        "mismatches":         data.get("mismatches"),
        "amount_match":       not data.get("mismatch"),
        "audit_explanation":  data.get("explanation"),
        "audit_timeline":     data.get("timeline"),
        "audit_sources":      data.get("sources"),
        "reimbursable_amount": data.get("reimbursable_amount"),
    }
    try:
        r = requests.patch(
            f"{_supabase_url()}/rest/v1/expenses?id=eq.{expense_id}",
            headers=_headers(),
            json=update_payload,
        )
        if 200 <= r.status_code < 300:
            safe_print(f"[AuditAgent] Saved audit for expense {expense_id}")
        else:
            safe_print(f"[AuditAgent] Supabase update failed {r.status_code}: {r.text}")
    except Exception as e:
        safe_print(f"[AuditAgent] update_supabase_expense error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# TOOL  (called by LLM once it has analysed all facts)
# ─────────────────────────────────────────────────────────────────────────────

def set_audit_result(
    tool_context: ToolContext,
    expense_id: str,
    is_verified: bool,
    has_mismatch: bool,
    mismatches: list[str],
    explanation: str,
    timeline: list[str],
    sources: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """
    Set the final audit verdict and persist to Supabase.

    Args:
        expense_id:   UUID of the expense being audited.
        is_verified:  True only if ALL checks pass.
        has_mismatch: True if ANY mismatch found.
        mismatches:   List of mismatch tags from the set below.
        explanation:  Human-readable explanation for the employee.
        timeline:     Step-by-step reasoning list for UI display.
        sources:      Dict mapping each mismatch tag to its evidence string.
                      Example:
                      {
                        "duplicate_receipt": "UTR 123456 already used in Expense EXP-ABCD (15 Mar 2026)",
                        "policy_exceeded":   "Meal limit Tier III: ₹450/day. Claimed: ₹900 (over by ₹450)",
                        "date_range_mismatch": "Receipt: 17 Feb 2026. Visit window: 10 Mar – 15 Mar 2026"
                      }

    Accepted mismatch tags:
        amount_mismatch           — Claimed ≠ receipt total
        date_mismatch             — Receipt date ≠ claimed date
        date_range_mismatch       — Receipt outside application visit window
        policy_exceeded           — Amount > user-specific policy limit
        failed_screenshot         — Receipt status is FAILED
        duplicate_receipt         — UTR already used in another expense
        receipt_quality_issue     — Status UNKNOWN/PENDING (not confirmed)
        category_policy_violation — Expense type disallowed by user policy
        per_person_limit_exceeded — Meal per person > policy limit
    """
    # Use pre-computed reimbursable from Python (authoritative).
    # Override to ₹0 if any blocking tag is present.
    # amount_mismatch is included: if the receipt doesn't match what was claimed,
    # neither figure can be trusted — the employee must resubmit with the correct receipt.
    BLOCKING = {
        "duplicate_receipt",
        "failed_screenshot",
        "receipt_quality_issue",
        "amount_mismatch",
    }
    pre_computed = float(tool_context.state.get("_computed_reimbursable") or 0)
    if any(t in BLOCKING for t in mismatches):
        final_reimbursable = 0.0
    else:
        final_reimbursable = pre_computed

    result = {
        "verified":           is_verified,
        "mismatch":           has_mismatch,
        "mismatches":         mismatches,
        "explanation":        explanation,
        "timeline":           timeline,
        "sources":            sources or {},
        "reimbursable_amount": final_reimbursable,
    }
    tool_context.state["audit_output"] = result
    safe_print(
        f"[AuditAgent] Result: verified={is_verified}, tags={mismatches}, "
        f"reimbursable=₹{final_reimbursable:.2f}"
    )
    update_supabase_expense(expense_id, result)
    embed_expense_after_audit(expense_id)
    return {"status": "success", "data": result}


# ─────────────────────────────────────────────────────────────────────────────
# CALLBACKS
# ─────────────────────────────────────────────────────────────────────────────

def audit_before_agent(callback_context: CallbackContext) -> None:
    callback_context.state["audit_output"] = None
    return None


def audit_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "AuditAgent":
        return None

    # Audit already completed (set_audit_result was called) — skip pre-flight on
    # subsequent LLM calls (ADK loops back with tool result before ending invocation).
    if callback_context.state.get("audit_output") is not None:
        safe_print("[AuditAgent] on_before_model — audit already done, skipping pre-flight")
        return None

    safe_print("[AuditAgent] on_before_model — running pre-flight checks")

    # ── Extract fields from the user prompt ───────────────────────────────
    prompt_text = ""
    for content in (llm_request.contents or []):
        if hasattr(content, "parts"):
            for part in content.parts:
                if hasattr(part, "text") and part.text:
                    prompt_text += part.text + "\n"

    def extract(label: str, default: str = "") -> str:
        m = re.search(rf"^{label}:\s*(.+)$", prompt_text, re.MULTILINE | re.IGNORECASE)
        return m.group(1).strip() if m else default

    expense_id     = extract("Expense ID")
    user_id_direct = extract("User ID")         # passed directly from agent.ts — no DB lookup needed
    user_phone     = extract("User Phone")
    utr_number     = extract("UTR Number", "not provided")
    receipt_status = extract("Receipt Status", "UNKNOWN")
    visit_duration = extract("Visit Duration")
    receipt_date   = extract("Receipt Date")
    claimed_str    = extract("Claimed Amount", "0")
    participants   = extract("Participants", "1")
    city_tier      = extract("City Tier", "Tier - III")
    expense_type   = extract("Category", "")

    # ── PRE-FLIGHT 1: User-specific policy ────────────────────────────────
    # Prefer user_id_direct (already in prompt, no extra DB call needed).
    # Fall back to phone lookup only if user_id was not passed.
    policy = fetch_user_effective_policy(user_phone, user_id_override=user_id_direct or None)

    tier_norm = city_tier.lower().replace("-", " ").strip()
    if "tier i" in tier_norm and "tier ii" not in tier_norm and "tier iii" not in tier_norm:
        applicable_meal_limit = policy["meal_tier1_limit"]
        tier_label = "Tier I"
    elif "tier ii" in tier_norm and "tier iii" not in tier_norm:
        applicable_meal_limit = policy["meal_tier2_limit"]
        tier_label = "Tier II"
    else:
        applicable_meal_limit = policy["meal_tier3_limit"]
        tier_label = "Tier III"

    travel_limit_str = f"₹{policy['travel_daily_limit']}/day" if policy["travel_daily_limit"] else "No cap"
    hotel_limit_str  = f"₹{policy['hotel_daily_limit']}/day"  if policy["hotel_daily_limit"]  else "No cap"

    policy_block = f"""PRE-FLIGHT: USER POLICY (from DB — authoritative)
  Source            : {'User-specific' if policy['found'] else 'Global default (user not in policies table)'}
  Temporary override: {policy['has_active_override']} {('(reason: ' + policy['override_reason'] + ')') if policy['override_reason'] else ''}
  Meal limit Tier I : ₹{policy['meal_tier1_limit']}/day
  Meal limit Tier II: ₹{policy['meal_tier2_limit']}/day
  Meal limit Tier III: ₹{policy['meal_tier3_limit']}/day
  Applicable limit  : ₹{applicable_meal_limit}/day ({tier_label})
  Travel allowed    : {policy['travel_allowed']} | Limit: {travel_limit_str}
  Hotel allowed     : {policy['hotel_allowed']} | Limit: {hotel_limit_str}"""

    # ── PRE-FLIGHT 2: UTR duplicate check (service-role — sees all users) ─
    utr_result     = check_duplicate_utr(utr_number, expense_id)
    dup_exp_id     = utr_result.get("existing_expense_id") or "N/A"
    dup_created_at = utr_result.get("existing_created_at") or "unknown date"
    utr_block      = f"""PRE-FLIGHT: UTR DUPLICATE CHECK  (searched ALL expenses system-wide)
  UTR Number       : {utr_number}
  Is duplicate     : {utr_result['is_duplicate']}
  Duplicate in     : {dup_exp_id}
  First submitted  : {dup_created_at}"""

    # ── PRE-FLIGHT 3: Date range check ────────────────────────────────────
    in_range      = is_date_in_visit_range(receipt_date, visit_duration)
    in_range_str  = str(in_range) if in_range is not None else "Could not determine (parse error)"
    date_block    = f"""PRE-FLIGHT: DATE RANGE CHECK
  Receipt Date     : {receipt_date or 'Not provided'}
  Visit Duration   : {visit_duration or 'Not provided'}
  In visit window  : {in_range_str}"""

    # ── PRE-FLIGHT 4: Per-person meal limit + reimbursable amount ─────────
    BLOCKING_TAGS = {"duplicate_receipt", "failed_screenshot", "receipt_quality_issue"}
    MEAL_KEYWORDS  = ["food", "meal", "breakfast", "lunch", "dinner", "dining",
                      "restaurant", "cafe", "snack", "tiffin", "canteen"]
    TRAVEL_KEYWORDS = ["travel", "transport", "cab", "taxi", "auto", "bus", "train",
                       "flight", "fuel", "petrol", "diesel", "conveyance", "uber", "ola"]
    HOTEL_KEYWORDS  = ["hotel", "stay", "lodging", "accommodation", "room", "hostel"]

    expense_type_lower = expense_type.lower()
    is_meal_expense   = any(k in expense_type_lower for k in MEAL_KEYWORDS)
    is_travel_expense = any(k in expense_type_lower for k in TRAVEL_KEYWORDS)
    is_hotel_expense  = any(k in expense_type_lower for k in HOTEL_KEYWORDS)

    try:
        pcount     = max(1, int(re.sub(r"\D", "", participants) or "1"))
        claimed_n  = float(re.sub(r"[^0-9.]", "", claimed_str) or "0")
        per_person = claimed_n / pcount if pcount > 0 else claimed_n

        receipt_is_failed  = receipt_status.upper() in ("FAILED", "FAILURE")
        receipt_is_pending = receipt_status.upper() in ("PENDING", "UNKNOWN", "")

        # Determine applicable cap based on expense type:
        # - Meal/food → daily meal limit × participants
        # - Travel    → travel_daily_limit if set, else no cap
        # - Hotel     → hotel_daily_limit  if set, else no cap
        # - Other     → no cap (cannot apply meal limit to office supplies etc.)
        if is_meal_expense:
            policy_cap_per_day = applicable_meal_limit * pcount
            pp_exceeds = per_person > applicable_meal_limit
            cap_label  = f"Meal cap: ₹{applicable_meal_limit}/person × {pcount} = ₹{policy_cap_per_day}"
        elif is_travel_expense and policy["travel_daily_limit"]:
            policy_cap_per_day = float(policy["travel_daily_limit"])
            pp_exceeds = claimed_n > policy_cap_per_day
            cap_label  = f"Travel cap: ₹{policy_cap_per_day}/day"
        elif is_hotel_expense and policy["hotel_daily_limit"]:
            policy_cap_per_day = float(policy["hotel_daily_limit"])
            pp_exceeds = claimed_n > policy_cap_per_day
            cap_label  = f"Hotel cap: ₹{policy_cap_per_day}/day"
        else:
            # No cap for this expense type
            policy_cap_per_day = None
            pp_exceeds = False
            cap_label  = "No daily cap for this expense type"

        # Compute reimbursable (authoritative — stored before LLM runs)
        if receipt_is_failed:
            computed_reimbursable = 0.0
            reimb_reason = "FAILED receipt → ₹0"
        elif claimed_n <= 0:
            computed_reimbursable = 0.0
            reimb_reason = "No claimed amount → ₹0"
        elif policy_cap_per_day is not None and claimed_n > policy_cap_per_day:
            computed_reimbursable = policy_cap_per_day
            reimb_reason = f"Claimed ₹{claimed_n} > cap ₹{policy_cap_per_day} → capped"
        else:
            computed_reimbursable = claimed_n
            reimb_reason = f"Within policy → full ₹{claimed_n}"

        pp_block = f"""PRE-FLIGHT: POLICY CAP CHECK
  Expense type     : {expense_type} ({'meal' if is_meal_expense else 'travel' if is_travel_expense else 'hotel' if is_hotel_expense else 'other — NO meal cap applies'})
  Participants     : {pcount}
  Total claimed    : ₹{claimed_n}
  Per person       : ₹{per_person:.2f}
  Cap applied      : {cap_label}
  Over cap         : {pp_exceeds}
  Computed reimb.  : ₹{computed_reimbursable:.2f}  ({reimb_reason})"""

    except Exception:
        computed_reimbursable = 0.0
        pp_block = "PRE-FLIGHT: POLICY CAP CHECK: Could not compute."

    # ── Fetch global policy summary live from Supabase ───────────────────
    global_policy = fetch_all_policies_summary()
    safe_print(f"[AuditAgent] Policy summary fetched ({len(global_policy)} chars)")

    system_prompt = f"""You are the AI Audit Agent for Fristine Infotech.
Analyse the expense claim using the PRE-COMPUTED FACTS below. Do NOT call any external API or guess data — use only what is provided.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPANY POLICY (live from Supabase — user-specific limits below override these):
{global_policy}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{policy_block}

{utr_block}

{date_block}

{pp_block}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MISMATCH RULES — check every one, tag ALL that apply:

1. amount_mismatch
   Trigger: Claimed Amount ≠ Receipt Total (difference ≥ ₹1).

2. date_mismatch
   Trigger: Receipt date on screenshot ≠ the claimed expense date field.

3. date_range_mismatch  ← CRITICAL
   Trigger: "In visit window: False" in DATE RANGE CHECK above.
   The employee submitted a receipt dated outside their authorised trip window.

4. policy_exceeded  ← CRITICAL
   MEAL/FOOD categories ONLY: Claimed Amount > applicable meal limit × participants from USER POLICY.
   TRAVEL categories: ONLY trigger if travel_allowed = False OR amount > travel_daily_limit (if set).
   HOTEL categories:  ONLY trigger if hotel_allowed  = False OR amount > hotel_daily_limit (if set).
   OTHER categories (Office Supplies, stationery, etc.): DO NOT apply meal cap. No policy_exceeded unless travel/hotel check applies.
   IMPORTANT: "Over cap: True" in POLICY CAP CHECK already tells you if this applies. Trust it.

5. failed_screenshot  ← CRITICAL
   Trigger: Receipt Status = "FAILED".
   A FAILED payment screenshot means the money was never debited — not reimbursable.

6. duplicate_receipt  ← CRITICAL
   Trigger: "Is duplicate: True" in UTR DUPLICATE CHECK above.
   This UTR was already used in a previous expense submission.

7. receipt_quality_issue
   Trigger: Receipt Status = "UNKNOWN" or "PENDING".
   Payment not confirmed — cannot approve without a SUCCESS screenshot.

8. category_policy_violation
   Trigger: Expense category is Travel but travel_allowed = False,
            OR category is Hotel but hotel_allowed = False.

9. per_person_limit_exceeded
   MEAL/FOOD categories ONLY: "Over cap: True" in POLICY CAP CHECK and expense_type is a meal category.
   DO NOT trigger for Travel, Hotel, or Office Supplies — those are NOT per-person meal expenses.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERDICT:
- verified = True ONLY if zero mismatches.
- has_mismatch = True if ANY mismatch found.
- List every applicable mismatch tag.
- Write a clear, professional explanation for the employee (mention each issue).
- Include a timeline[] of your step-by-step reasoning (minimum 4 steps).

SOURCES — for every mismatch tag you include, add a corresponding entry in sources{{}}:
  duplicate_receipt         → "UTR {{utr}} was already submitted in Expense {{dup_id}} on {{dup_date}}"
  policy_exceeded           → "Limit: ₹{{limit}}/day ({{tier}}). Claimed: ₹{{amount}} (over by ₹{{diff}})"
  per_person_limit_exceeded → "Per person: ₹{{per_person}} / limit ₹{{limit}} ({{pcount}} participants)"
  date_range_mismatch       → "Receipt: {{receipt_date}}. Approved window: {{visit_duration}}"
  date_mismatch             → "Receipt date: {{receipt_date}}. Claimed date: {{claimed_date}}"
  amount_mismatch           → "Claimed: ₹{{claimed}}. Receipt shows: ₹{{receipt_total}}"
  failed_screenshot         → "Receipt status: FAILED — payment did not complete"
  receipt_quality_issue     → "Receipt status: {{status}} — payment outcome not confirmed"
  category_policy_violation → "Category '{{category}}' is not permitted under current policy"

You MUST call set_audit_result exactly once. Extract 'Expense ID' from the prompt.
"""

    # Persist for set_audit_result (which runs after LLM tool call)
    callback_context.state["_computed_reimbursable"] = computed_reimbursable
    callback_context.state["_claimed_amount"]        = claimed_n if "claimed_n" in dir() else 0.0

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

    # End as soon as audit_output is set (tool was called) OR model returns text
    audit_done = bool(callback_context.state.get("audit_output"))
    has_text   = (
        llm_response.content
        and llm_response.content.parts
        and llm_response.content.role == "model"
        and any(getattr(p, "text", None) for p in llm_response.content.parts)
    )
    if audit_done or has_text:
        safe_print("[AuditAgent] on_after_model — ending invocation")
        callback_context._invocation_context.end_invocation = True
    return None


# ─────────────────────────────────────────────────────────────────────────────
# AGENT
# ─────────────────────────────────────────────────────────────────────────────

# Sub-agent dedicated to Google Search (single-tool requirement)
_audit_search_agent = LlmAgent(
    name="AuditSearchAgent",
    model="gemini-2.5-flash",
    instruction="Search the web using Google Search and return the results. Always cite sources.",
    tools=[google_search],
)

audit_agent = LlmAgent(
    name="AuditAgent",
    model="gemini-2.5-flash",
    instruction="""
        Audit expense claims using the pre-computed facts in the system prompt.
        Apply all 9 mismatch rules. Call set_audit_result exactly once with your final verdict.
    """,
    tools=[set_audit_result, AgentTool(agent=_audit_search_agent)],
    before_agent_callback=audit_before_agent,
    before_model_callback=audit_before_model,
    after_model_callback=audit_after_model,
)
