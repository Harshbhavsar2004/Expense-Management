"""
Enterprise Agent — cross-table data intelligence for admins and employees.
Read + write access: admins can query all tables and update temporary policy
overrides. RBAC enforcement: employees see only their own data.

NOTE ON COMPOSIO:
  Composio tools are injected at AGENT CONSTRUCTION TIME in main.py.
  This file does NOT inject Composio tools in any callback — that caused:
  "Unable to serialize unknown type: <class 'google.adk.tools.function_tool.FunctionTool'>"
  because ADK's telemetry serializer cannot handle FunctionTool objects
  added to llm_request.config.tools at runtime.
"""

from __future__ import annotations

import builtins
import json
import os
import sys
import warnings
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import ToolContext
from google.genai import types

from embedding_service import generate_query_embedding

warnings.filterwarnings("ignore", message=".*BaseAuthenticatedTool.*")

if hasattr(sys.stdout, "reconfigure") and sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def safe_print(msg: str) -> None:
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def _debug(section: str, **kwargs) -> None:
    safe_print(f"\n{'='*60}")
    safe_print(f"[EnterpriseAgent] DEBUG — {section}")
    for k, v in kwargs.items():
        v_str = str(v)
        if len(v_str) > 400:
            v_str = v_str[:400] + f"... (truncated, len={len(v_str)})"
        safe_print(f"  {k}: {v_str}")
    safe_print(f"{'='*60}\n")


# ─────────────────────────────────────────────────────────────────────────────
# SUPABASE HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _supabase_url() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")


def _headers() -> Dict[str, str]:
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _service_headers() -> Dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _rpc_write(fn: str, payload: Dict[str, Any]) -> Any:
    url = f"{_supabase_url()}/rest/v1/rpc/{fn}"
    _debug(f"_rpc_write({fn})", url=url, payload_keys=list(payload.keys()))
    r = requests.post(url, headers=_service_headers(), json=payload, timeout=15)
    _debug(f"_rpc_write({fn}) response", status=r.status_code, body=r.text[:500])
    if not r.ok:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:400]}")
    return r.text


def _get(table: str, params: Any) -> Any:
    url = f"{_supabase_url()}/rest/v1/{table}"
    r = requests.get(
        url,
        headers={**_headers(), "Prefer": "return=representation"},
        params=params,
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def _rpc(fn: str, payload: Dict[str, Any]) -> Any:
    url = f"{_supabase_url()}/rest/v1/rpc/{fn}"
    r = requests.post(url, headers=_headers(), json=payload, timeout=15)
    r.raise_for_status()
    return r.json()


def _ok(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _err(msg: str) -> str:
    return json.dumps({"error": msg})


# ─────────────────────────────────────────────────────────────────────────────
# TOOLS
# ─────────────────────────────────────────────────────────────────────────────

def resolve_user(
    tool_context: ToolContext,
    name: Optional[str] = None,
    phone: Optional[str] = None,
    user_id: Optional[str] = None,
    organization: Optional[str] = None,
    team: Optional[str] = None,
) -> str:
    """
    Find users by name (ilike), phone (exact), UUID (user_id), organization, or team.
    Returns JSON with id, full_name, role, phone, organization, team.
    Always call this before using any user_id if you need metadata.
    """
    _debug("resolve_user CALLED", name=name, phone=phone, user_id=user_id, organization=organization, team=team)
    try:
        base = _supabase_url()
        key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        # --- [NEW] Multi-column select including org/team ---
        select_cols = "id,full_name,role,phone,email,created_at,organization,team"
        
        if name:
            import urllib.parse
            safe_name = name.replace("*", "").strip()
            encoded = urllib.parse.quote(f"ilike.*{safe_name}*", safe=".*")
            url = f"{base}/rest/v1/users?select={select_cols}&full_name={encoded}"
            
            # Append other filters
            if phone:        url += f"&phone=eq.{phone}"
            if user_id:      url += f"&id=eq.{user_id}"
            if organization: url += f"&organization=eq.{urllib.parse.quote(organization)}"
            if team:         url += f"&team=eq.{urllib.parse.quote(team)}"
            
            r = requests.get(url, headers=headers, timeout=15)
        elif phone or user_id or organization or team:
            params = [("select", select_cols)]
            if phone:        params.append(("phone", f"eq.{phone}"))
            if user_id:      params.append(("id", f"eq.{user_id}"))
            if organization: params.append(("organization", f"eq.{organization}"))
            if team:         params.append(("team", f"eq.{team}"))
            
            r = requests.get(f"{base}/rest/v1/users", headers=headers, params=params, timeout=15)
        else:
            return _err("Provide at least name, phone, user_id, organization, or team.")
        if not r.ok:
            return _err(f"Supabase error {r.status_code}: {r.text[:200]}")
        rows = r.json()
        if not rows:
            return _ok({"found": False, "message": f"No user found matching '{name or phone}'."})
        return _ok({"found": True, "count": len(rows), "users": rows})
    except Exception as exc:
        return _err(str(exc))


def get_user_stats(tool_context: ToolContext, user_id: Optional[str] = None) -> str:
    """Query the user_expense_stats materialized view."""
    try:
        params: Dict[str, Any] = {"select": "*"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return _ok(_get("user_expense_stats", params))
    except Exception as exc:
        return _err(str(exc))


def compare_two_users(tool_context: ToolContext, user_id_a: str, user_id_b: str) -> str:
    """Fetch stats for two users and return a side-by-side comparison."""
    try:
        rows = _get("user_expense_stats", {"select": "*", "user_id": f"in.({user_id_a},{user_id_b})"})
        if not rows:
            return _err("No stats found for either user.")
        by_id = {r["user_id"]: r for r in rows}
        a, b = by_id.get(user_id_a), by_id.get(user_id_b)
        if a is None or b is None:
            missing = [uid for uid in [user_id_a, user_id_b] if uid not in by_id]
            return _err(f"Stats not found for: {', '.join(missing)}")

        def _f(r: dict, key: str) -> float:
            try: return float(r.get(key) or 0)
            except: return 0.0

        ca, cb = _f(a, "total_claimed"), _f(b, "total_claimed")
        ra, rb = _f(a, "reimbursement_rate_pct"), _f(b, "reimbursement_rate_pct")
        higher = (a.get("full_name") or user_id_a) if ca >= cb else (b.get("full_name") or user_id_b)
        return _ok({
            "user_a": a, "user_b": b,
            "deltas": {
                "claimed_diff": builtins.round(float(ca - cb), 2),
                "reimbursement_rate_diff_pct": builtins.round(float(ra - rb), 4),
                "note": f"{higher} claims more overall.",
            },
        })
    except Exception as exc:
        return _err(str(exc))


def semantic_search_expenses(
    tool_context: ToolContext, query: str, user_id: Optional[str] = None, limit: int = 8
) -> str:
    """Semantic similarity search across expenses using pgvector."""
    try:
        vector = generate_query_embedding(query)
        if vector is None:
            return _err("Could not generate embedding for query.")
        rows = _rpc("match_expenses", {"query_embedding": vector, "match_count": limit, "filter_user_id": user_id})
        return _ok(rows)
    except Exception as exc:
        return _err(str(exc))


def get_applications(
    tool_context: ToolContext,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    organization: Optional[str] = None,
    team: Optional[str] = None,
    limit: int = 30,
) -> str:
    """Fetch expense applications. Can filter by user, status, organization, or team."""
    try:
        # If filtering by org/team, we need to join with users table
        select_clause = "*"
        if organization or team:
            select_clause = "*,users!inner(organization,team)"
            
        params: List[tuple] = [
            ("select", select_clause),
            ("order", "created_at.desc"),
            ("limit", str(limit))
        ]
        
        if user_id: params.append(("user_id", f"eq.{user_id}"))
        if status:  params.append(("status", f"eq.{status}"))
        if organization: params.append(("users.organization", f"eq.{organization}"))
        if team:         params.append(("users.team", f"eq.{team}"))
        
        base_url = f"{_supabase_url()}/rest/v1/applications"
        r = requests.get(base_url, headers=_headers(), params=params, timeout=15)
        r.raise_for_status()
        return _ok(r.json())
    except Exception as exc:
        return _err(str(exc))


def get_policies(tool_context: ToolContext, user_id: Optional[str] = None) -> str:
    """Fetch reimbursement policies."""
    try:
        params: Dict[str, Any] = {"select": "*"}
        if user_id: params["user_id"] = f"eq.{user_id}"
        return _ok(_get("policies", params))
    except Exception as exc:
        return _err(str(exc))


def set_policy_override(
    tool_context: ToolContext,
    user_id: str, set_by: str, valid_from: str, valid_until: str, reason: str,
    meal_tier1: Optional[float] = None, meal_tier2: Optional[float] = None,
    meal_tier3: Optional[float] = None, travel_limit: Optional[float] = None,
    hotel_limit: Optional[float] = None,
) -> str:
    """Set a temporary policy override for a user. valid_from/valid_until: ISO 8601."""
    try:
        payload: Dict[str, Any] = {
            "p_user_id": user_id, "p_set_by": set_by,
            "p_valid_from": valid_from, "p_valid_until": valid_until, "p_reason": reason,
        }
        if meal_tier1   is not None: payload["p_meal_tier1"]   = meal_tier1
        if meal_tier2   is not None: payload["p_meal_tier2"]   = meal_tier2
        if meal_tier3   is not None: payload["p_meal_tier3"]   = meal_tier3
        if travel_limit is not None: payload["p_travel_limit"] = travel_limit
        if hotel_limit  is not None: payload["p_hotel_limit"]  = hotel_limit
        _rpc_write("set_temporary_override", payload)
        return _ok({"success": True, "message": f"Policy override set for {user_id} from {valid_from} to {valid_until}."})
    except Exception as exc:
        return _err(str(exc))


def clear_policy_override(tool_context: ToolContext, user_id: str) -> str:
    """Clear the active temporary policy override for a user."""
    try:
        _rpc_write("clear_override", {"p_user_id": user_id})
        return _ok({"success": True, "message": f"Override cleared for {user_id}."})
    except Exception as exc:
        return _err(str(exc))


def get_duplicate_receipts(tool_context: ToolContext) -> str:
    """Find receipts where the same UTR number appears more than once."""
    try:
        rows = _get("receipts", {"select": "utr_number,expense_id", "utr_number": "neq."})
        groups: Dict[str, List[str]] = {}
        for r in rows:
            utr = (r.get("utr_number") or "").strip()
            if utr:
                groups.setdefault(utr, []).append(r.get("expense_id", ""))
        duplicates = [
            {"utr_number": utr, "occurrences": len(ids), "expense_ids": ids}
            for utr, ids in groups.items() if len(ids) > 1
        ]
        duplicates.sort(key=lambda x: x["occurrences"], reverse=True)
        return _ok(duplicates)
    except Exception as exc:
        return _err(str(exc))


def get_mismatch_breakdown(tool_context: ToolContext, user_id: Optional[str] = None) -> str:
    """Count frequency of each mismatch tag."""
    try:
        params: Dict[str, Any] = {"select": "mismatches"}
        if user_id: params["user_id"] = f"eq.{user_id}"
        rows = _get("expenses", params)
        counter: Counter = Counter()
        for r in rows:
            tags = r.get("mismatches") or []
            if isinstance(tags, list):
                counter.update(tags)
        return _ok(dict(counter.most_common()))
    except Exception as exc:
        return _err(str(exc))


def search_expenses_by_amount(
    tool_context: ToolContext,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    user_id: Optional[str] = None,
) -> str:
    """Find expenses within a claimed amount range."""
    try:
        cols = "id,user_name,expense_type,claimed_amount_numeric,reimbursable_amount,verified,mismatches,application_id,city_tier"
        base = [("select", cols), ("order", "claimed_amount_numeric.desc"), ("limit", "100")]
        if user_id: base.append(("user_id", f"eq.{user_id}"))
        if min_amount is not None: base.append(("claimed_amount_numeric", f"gte.{min_amount}"))
        if max_amount is not None: base.append(("claimed_amount_numeric", f"lte.{max_amount}"))
        r = requests.get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_headers(), "Prefer": "return=representation"},
            params=base, timeout=15,
        )
        r.raise_for_status()
        return _ok(r.json())
    except Exception as exc:
        return _err(str(exc))


def get_chat_history(tool_context: ToolContext, user_phone: Optional[str] = None, limit: int = 20) -> str:
    """Fetch recent chat messages."""
    try:
        params: Dict[str, Any] = {"select": "*", "order": "created_at.desc", "limit": str(limit)}
        if user_phone: params["phone"] = f"eq.{user_phone}"
        return _ok(_get("chat_messages", params))
    except Exception as exc:
        return _err(str(exc))


def get_users(
    tool_context: ToolContext,
    role: Optional[str] = None,
    organization: Optional[str] = None,
    team: Optional[str] = None,
) -> str:
    """List users. Filter by role, organization, or team."""
    try:
        params = [("select", "id,full_name,role,phone,email,created_at,organization,team")]
        if role:         params.append(("role", f"eq.{role}"))
        if organization: params.append(("organization", f"eq.{organization}"))
        if team:         params.append(("team", f"eq.{team}"))
        
        r = requests.get(
            f"{_supabase_url()}/rest/v1/users",
            headers={**_headers(), "Prefer": "return=representation"},
            params=params,
            timeout=15,
        )
        r.raise_for_status()
        return _ok({"count": len(r.json()), "users": r.json()})
    except Exception as exc:
        return _err(str(exc))


def get_flagged_expenses(
    tool_context: ToolContext,
    user_id: Optional[str] = None,
    mismatch_type: Optional[str] = None,
    application_id: Optional[str] = None,
    limit: int = 50,
) -> str:
    """Fetch full details of flagged/mismatched expenses."""
    try:
        params = [
            ("select", "id,user_name,application_id,client_name,visit_duration,expense_type,"
                       "date_range,claimed_amount,claimed_amount_numeric,reimbursable_amount,"
                       "verified,mismatches,audit_explanation,audit_sources,city,city_tier,"
                       "created_at,participant_names,participant_count"),
            ("verified", "eq.false"),
            ("order", "created_at.desc"),
            ("limit", str(min(limit, 200))),
        ]
        if user_id: params.append(("user_id", f"eq.{user_id}"))
        if application_id: params.append(("application_id", f"eq.{application_id}"))
        r = requests.get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_headers(), "Prefer": "return=representation"},
            params=params, timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        if mismatch_type:
            rows = [row for row in rows if mismatch_type in (row.get("mismatches") or [])]
        if not rows:
            return _ok({"count": 0, "message": "No flagged expenses found.", "flagged_expenses": []})
        enriched = []
        for row in rows:
            mismatches = row.get("mismatches") or []
            sources = row.get("audit_sources") or {}
            if isinstance(sources, str):
                try: sources = json.loads(sources)
                except: sources = {}
            enriched.append({
                "expense_id":          row.get("id"),
                "employee":            row.get("user_name"),
                "application_id":      row.get("application_id"),
                "client":              row.get("client_name") or "N/A",
                "visit_duration":      row.get("visit_duration") or "N/A",
                "expense_date":        row.get("date_range") or "N/A",
                "expense_type":        row.get("expense_type"),
                "claimed_amount":      row.get("claimed_amount"),
                "reimbursable_amount": row.get("reimbursable_amount") or 0,
                "city":                row.get("city") or "N/A",
                "city_tier":           row.get("city_tier") or "N/A",
                "participants":        row.get("participant_count"),
                "mismatch_flags":      mismatches,
                "mismatch_count":      len(mismatches),
                "mismatch_details":    sources,
                "audit_explanation":   row.get("audit_explanation") or "No explanation available",
                "submitted_at":        row.get("created_at"),
            })
        return _ok({"count": len(enriched), "flagged_expenses": enriched})
    except Exception as exc:
        return _err(str(exc))


def get_expenses_detail(
    tool_context: ToolContext,
    user_id: Optional[str] = None,
    application_id: Optional[str] = None,
    verified: Optional[bool] = None,
    organization: Optional[str] = None,
    team: Optional[str] = None,
    limit: int = 50,
) -> str:
    """Fetch expense records. Can filter by user, app, organization, or team."""
    try:
        select_clause = "id,user_name,application_id,client_name,visit_duration,expense_type," \
                        "date_range,claimed_amount,claimed_amount_numeric,reimbursable_amount," \
                        "verified,mismatches,audit_explanation,city,city_tier,created_at," \
                        "participant_names,participant_count"
                        
        if organization or team:
            select_clause += ",users!inner(organization,team)"

        params = [
            ("select", select_clause),
            ("order", "created_at.desc"),
            ("limit", str(min(limit, 200))),
        ]
        
        if user_id: params.append(("user_id", f"eq.{user_id}"))
        if application_id: params.append(("application_id", f"eq.{application_id}"))
        if verified is not None: params.append(("verified", f"eq.{str(verified).lower()}"))
        if organization: params.append(("users.organization", f"eq.{organization}"))
        if team:         params.append(("users.team", f"eq.{team}"))
        
        r = requests.get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_headers(), "Prefer": "return=representation"},
            params=params, timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        return _ok({"count": len(rows), "expenses": rows})
    except Exception as exc:
        return _err(str(exc))


def generate_dashboard(tool_context: ToolContext, title: str, charts_json: str) -> str:
    """
    Generate a Zoho Analytics-style dashboard. charts_json: JSON array of chart objects.
    Returns [dashboard_id:uuid]Title — the UI renders this as a button.
    """
    try:
        charts = json.loads(charts_json)
        r = requests.post(
            f"{_supabase_url()}/rest/v1/dashboards",
            headers={**_service_headers(), "Prefer": "return=representation"},
            json={"spec": {"type": "dashboard", "title": title, "charts": charts}},
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return "Dashboard creation failed: No ID returned"
        return f"[dashboard_id:{rows[0].get('id')}]{title}"
    except Exception as exc:
        return f"Failed to create dashboard: {exc}"


def save_dashboard(tool_context: ToolContext, spec: str) -> str:
    """Persist a dashboard specification to the database."""
    try:
        r = requests.post(
            f"{_supabase_url()}/rest/v1/dashboards",
            headers={**_service_headers(), "Prefer": "return=representation"},
            json={"spec": json.loads(spec)},
            timeout=15,
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return _err("No data returned after insert")
        return _ok({"id": rows[0].get("id")})
    except Exception as exc:
        return _err(str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# CALLBACKS
# ─────────────────────────────────────────────────────────────────────────────

def enterprise_before_agent(callback_context: CallbackContext) -> None:
    _debug("enterprise_before_agent FIRED", agent=getattr(callback_context, "agent_name", "unknown"))
    return None


def enterprise_before_model(
    callback_context: CallbackContext,
    llm_request: LlmRequest,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "EnterpriseAgent":
        return None

    _debug("enterprise_before_model FIRED")

    # ── 1. Log messages ───────────────────────────────────────────────────────
    try:
        msgs = getattr(llm_request, "messages", []) or []
        _debug("messages", count=len(msgs), last=str(msgs[-1])[:200] if msgs else "NONE")
    except Exception:
        msgs = []

    # ── 2. Inject system prompt ONLY ─────────────────────────────────────────
    # IMPORTANT: Do NOT touch llm_request.config.tools here.
    # Composio FunctionTool objects added at callback time cause:
    # PydanticSerializationError: Unable to serialize unknown type: FunctionTool
    # Composio tools are added to LlmAgent(tools=[...]) in main.py instead.
    today = datetime.now(timezone.utc).strftime("%A, %d %B %Y %H:%M UTC")

    system_prompt = f"""You are the Enterprise Data Intelligence Agent for Fristine Infotech.
Today is {today}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTITY RULE — READ FIRST, ALWAYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The requesting user's identity is injected at the start of every
conversation via the instructions prop from the frontend. It is
cryptographically verified by Supabase auth.
NEVER ask the user to confirm or declare their own role.
NEVER say you cannot verify who they are.
If you see "Role: admin" in context, treat them as admin immediately.
If you see "Role: employee" in context, restrict to their user_id only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESPONSE STYLE & COMPREHENSIVENESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Be thorough and helpful. Don't just give the bare minimum.
- For data queries, provide a brief analysis or insight after the table. 
- Explain "why" an expense was flagged (e.g., "This meal expense exceeds the ₹900 limit for Tier 1 cities").
- If the user asks for a comparison, explain the key differences, don't just show the numbers.
- Maintain a professional, executive tone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROLE & ACCESS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
You have read-only access to all Fristine Infotech expense management tables:
  - public.users
  - public.expenses
  - public.receipts
  - public.applications
  - public.policies
  - public.chat_messages
  - public.user_expense_stats (materialized view)

You must NEVER modify, insert, update, or delete any data directly.
Exception: set_policy_override and clear_policy_override are allowed for admins.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RBAC — ROLE-BASED ACCESS CONTROL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If role = "employee":
  - Generally restrict data to that employee's own user_id.
  - NEW: If the employee asks specifically for "team" or "organization" related 
    stats/expenses, you may query using their organization and team filters to 
    provide aggregate or team-level insights, while still respecting privacy 
    (do not reveal private phone/email of others unless necessary).

If role = "admin":
  - Full cross-user access.
  - May query any employee's data, run comparisons, and view all tables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
USER ID INJECTION RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
When the user's message contains [user_id:some-uuid], extract that UUID
and use it DIRECTLY as user_id in tool calls. Do NOT call resolve_user.

When the user's message contains [admin_id:some-uuid], that is the
current admin's own UUID — use it as set_by in policy overrides.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CHAIN RULES — ALWAYS FOLLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. NAME → UUID RULE:
   For any person mentioned by name WITHOUT a [user_id:...] tag,
   call resolve_user first. NEVER guess a UUID.

2. COMPARISON RULE:
   "compare X and Y" → resolve_user for each → compare_two_users.

3. FLAGGED/MISMATCH DETAILS RULE:
   Admin asks for flagged or problem expenses → call get_flagged_expenses.
   get_mismatch_breakdown is ONLY for "how many of each type" questions.

4. EXPENSE DRILL-DOWN RULE:
   Admin asks for a specific person's expenses:
   → resolve_user to get user_id
   → get_expenses_detail with user_id and/or application_id

5. USER LISTING RULE:
   Admin asks to list users → call get_users directly.

6. SEMANTIC SEARCH RULE:
   Natural language expense searches → prefer semantic_search_expenses.

7. TEAM & ORGANIZATION RULE:
   When asked about "team expenses" or "org stats", look up the requesting 
   user's organization/team first (if not in context) and use them as 
   parameters in get_users, get_expenses_detail, or get_applications.

8. FORMAT RULE:
   - Always start with a 1-2 sentence professional summary of your findings.
   - Present data as clean markdown tables in chat. (EXCEPTION: After sending an email or Slack message, only show a success confirmation).
   - Applications: # | ID | Client | Period | City | Status | Claimed | Reimbursable
   - Expenses: Employee | App ID | Client | Date | Type | Claimed | Reimbursable | Issues
   - Status: **draft**, **submitted**, **approved**, **rejected**.
   - Monetary: ₹X,XXX.XX. If ₹0.00, show as —.

   - OUTGOING MESSAGES (GMAIL/SLACK):
     When sending summaries via GMAIL_SEND_EMAIL or SLACK_SEND_MESSAGE:
     1. Use a clean tabular format.
     2. GMAIL: You MUST use a professional HTML <table>. Never use markdown tables for Gmail.
        Include inline CSS for borders, 8px padding, and a light gray background (#f2f2f2) for headers.
        Columns: # | ID | Client | Period | City | Status | Claimed | Reimbursable | Payout Status
     3. SLACK: Use a markdown table.
     4. Ensure currency is formatted as ₹X,XXX.XX.
     5. Include a professional greeting and sign-off.

   - EMAIL DISPLAY (When reading/displaying in chat):
     1. Use ### [Subject] for the subject line.
     2. Add a horizontal rule (---) after the headers.
     3. Use **From:** [Name] <email>, **To:** [Name] <email>, **Date:** [Date].
     4. Present the body text clearly. Avoid excessively large fonts (### is max).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL & EXTERNAL TOOLS (GMAIL etc.)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If Gmail, Slack, or other Composio tools are available in your tool list:
  - Send emails to employees about flagged expenses
  - Post Slack alerts to #finance or #hr channels
  - Create calendar events for follow-ups
  - Export data to Google Sheets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPOSIO SLACK TOOL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Use SLACK_SEND_MESSAGE (NOT the deprecated SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL).
2. Required parameters:
  - channel: channel name WITHOUT # symbol (e.g. "general", "finance")
  - markdown_text: PREFERRED. Write your message in markdown for nice formatting. 
    Use \n for line breaks (e.g. "Line 1\nLine 2").
  - text: Use this for very simple raw text messages if needed.

CORRECT: SLACK_SEND_MESSAGE(channel="general", markdown_text="Hello! 🎉\nStatus: **Online**")
WRONG:   SLACK_SEND_MESSAGE(channel="#general", ...)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMPOSIO GMAIL TOOL RULES — READ CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. The user_id in state (e.g. uuid) is your Composio identity.
   Composio uses it to find the correct Gmail OAuth token automatically.
   You NEVER need an email address to call Gmail tools.
2. For GMAIL_FETCH_EMAILS — do NOT pass user_id as a parameter.
   Just pass: query, max_results, include_payload.
3. For GMAIL_SEND_EMAIL — pass only: to, subject, body.
   Never pass user_id or from fields.
4. Never ask the admin for their email address to use Gmail tools.

CORRECT: GMAIL_FETCH_EMAILS(query="is:unread", max_results=5)
WRONG:   GMAIL_FETCH_EMAILS(user_id="someone@gmail.com", ...)

FLOW for sending an email:
  1. Call get_users to find the employee's email address.
  2. Compose a professional email with Fristine Infotech letterhead tone. Use an HTML table for summaries.
  3. Call GMAIL_SEND_EMAIL with to, subject, and body.
  4. RESPONSE RULE: In your chat response to the user, ONLY output "✅ Email sent to [name] at [email]". Do NOT repeat the table, HTML content, or the email body in the chat bubble.

IMPORTANT: Only use external tools when the admin explicitly asks.
Never send emails or post messages automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POLICY UPDATE RULES (ADMIN ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FLOW for a policy update:
  Step 1 — Identify the user (resolve_user or [user_id:uuid] tag).
  Step 2 — Gather: which limits, new values, start date, end date, reason.
  Step 3 — Show summary and ask for confirmation.
  Step 4 — On "yes" → call set_policy_override.
  Step 5 — Confirm: "✅ Policy override applied for [Name]."

CLEAR OVERRIDE: resolve_user → clear_policy_override → confirm.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DASHBOARDS — ZOHO ANALYTICS STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For dashboard/chart/visualization requests:
1. Always include 2-3 visual charts (Bar, Donut, Line) + a table at the end.
2. FETCH DATA FIRST before calling generate_dashboard.
3. Pass actual data objects in the data field — never use tool_code.
4. Return the EXACT [dashboard_id:uuid]Title string from the tool.
5. Colors: #6366F1 #8B5CF6 #F472B6 #34D399 #F59E0B #60A5FA #FB923C #A78BFA

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRIVACY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Never surface another employee's email or phone to an employee-role caller.
- Never expose raw tokens, keys, or system config.
"""

    original = llm_request.config.system_instruction or types.Content(role="system", parts=[])
    if not isinstance(original, types.Content):
        original = types.Content(role="system", parts=[types.Part(text=str(original))])
    if not original.parts:
        original.parts = [types.Part(text="")]
    original.parts[0].text = system_prompt + (original.parts[0].text or "")
    llm_request.config.system_instruction = original

    _debug("system prompt injected", prompt_length=len(system_prompt))
    return None


def enterprise_after_model(
    callback_context: CallbackContext,
    llm_response: LlmResponse,
) -> Optional[LlmResponse]:
    if callback_context.agent_name != "EnterpriseAgent":
        return None
    try:
        _debug("enterprise_after_model FIRED", response_preview=str(llm_response)[:200])
    except Exception:
        pass
    return None


# ─────────────────────────────────────────────────────────────────────────────
# AGENT DEFINITION
# Note: Composio tools (Gmail, Slack, etc.) are NOT listed here.
# They are added dynamically per-admin in main.py → build_enterprise_agent_with_tools()
# ─────────────────────────────────────────────────────────────────────────────

enterprise_agent = LlmAgent(
    name="EnterpriseAgent",
    model="gemini-2.5-flash",
    instruction="""
        You are the Enterprise Data Intelligence Agent for Fristine Infotech.
        Help admins and employees query expense data, user stats, policies,
        and audit findings. Follow RBAC rules strictly.
        Always resolve names to UUIDs before querying user-specific data.
        When Gmail or other external tools are available, use them when asked.
    """,
    tools=[
        resolve_user,
        get_user_stats,
        compare_two_users,
        semantic_search_expenses,
        get_applications,
        get_policies,
        set_policy_override,
        clear_policy_override,
        get_duplicate_receipts,
        get_mismatch_breakdown,
        search_expenses_by_amount,
        get_chat_history,
        get_users,
        get_flagged_expenses,
        get_expenses_detail,
        generate_dashboard,
        save_dashboard,
    ],
    before_agent_callback=enterprise_before_agent,
    before_model_callback=enterprise_before_model,
    after_model_callback=enterprise_after_model,
)