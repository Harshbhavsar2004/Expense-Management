from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import traceback
import urllib.parse
from collections import Counter
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx
from google import genai
from google.genai import types
from loguru import logger
from embedding_service import generate_query_embedding
from tool_utils import _load_composio_tools, SanitizedTool
from google.adk.tools import ToolContext
from types import SimpleNamespace

print("[voice_agent] Module loading...", flush=True)

# ─────────────────────────────────────────────────────────────────────────────
# Model constants
# ─────────────────────────────────────────────────────────────────────────────

GEMINI_MODEL        = "gemini-3.1-flash-live-preview"   # ← updated model
SEND_SAMPLE_RATE    = 16_000   # PCM input:  16 kHz, 16-bit, mono
RECEIVE_SAMPLE_RATE = 24_000   # PCM output: 24 kHz, 16-bit, mono

# gemini-3.1-flash-live-preview is on v1beta with GOOGLE_API_KEY (same as before)
_genai_client = genai.Client(
    http_options=types.HttpOptions(api_version="v1beta"),
    api_key=os.getenv("GOOGLE_API_KEY", ""),
)

print("[voice_agent] Constants OK.", flush=True)


def get_mock_tool_context(admin_id: str | None = None) -> ToolContext:
    """
    Creates a minimal ToolContext (google.adk.agents.context.Context) 
    that satisfies the constructor requirements for dynamic tool execution.
    """
    mock_invocation = SimpleNamespace(
        session=SimpleNamespace(id="voice-session", state={}),
        agent=SimpleNamespace(name="VoiceAgent"),
        invocation_id="voice-inv-" + datetime.now().strftime("%Y%m%d%H%M%S"),
        user_id=admin_id or "voice-user",
        user_content=None,
        run_config=None,
        # Required for some internal ADK checks
        app_name="VoiceAgentApp"
    )
    # The ADK Context constructor requires an invocation_context
    return ToolContext(invocation_context=mock_invocation)


# ─────────────────────────────────────────────────────────────────────────────
# Persistent HTTP client for Supabase
# ─────────────────────────────────────────────────────────────────────────────

_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=45.0, write=10.0, pool=5.0),
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
        )
    return _http_client


# ─────────────────────────────────────────────────────────────────────────────
# Supabase helpers
# ─────────────────────────────────────────────────────────────────────────────

def _supabase_url() -> str:
    return os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")


def _supabase_headers() -> Dict[str, str]:
    key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _supabase_service_headers() -> Dict[str, str]:
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
        or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    )
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


async def _rpc_write(fn: str, payload: Dict[str, Any]) -> Any:
    url = f"{_supabase_url()}/rest/v1/rpc/{fn}"
    r = await _get_http_client().post(
        url, headers=_supabase_service_headers(), json=payload
    )
    if not r.is_success:
        raise RuntimeError(f"HTTP {r.status_code}: {r.text[:400]}")
    return r.text


async def _get(table: str, params: Any) -> Any:
    r = await _get_http_client().get(
        f"{_supabase_url()}/rest/v1/{table}",
        headers={**_supabase_headers(), "Prefer": "return=representation"},
        params=params,
    )
    r.raise_for_status()
    return r.json()


async def _rpc(fn: str, payload: Dict[str, Any]) -> Any:
    r = await _get_http_client().post(
        f"{_supabase_url()}/rest/v1/rpc/{fn}",
        headers=_supabase_headers(),
        json=payload,
    )
    r.raise_for_status()
    return r.json()


def _ok(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, default=str)


def _err(msg: str) -> str:
    return json.dumps({"error": msg})


# ─────────────────────────────────────────────────────────────────────────────
# Tool implementations  (logic identical to original)
# ─────────────────────────────────────────────────────────────────────────────

async def resolve_user(
    name=None, phone=None, user_id=None, organization=None, team=None
) -> str:
    """Find users by name, phone, UUID, organization, or team."""
    logger.debug(f"resolve_user: name={name} phone={phone} user_id={user_id}")
    try:
        select_cols = "id,full_name,role,phone,email,created_at,organization,team"
        client = _get_http_client()
        if name:
            safe = name.replace("*", "").strip()
            encoded = urllib.parse.quote(f"ilike.*{safe}*", safe=".*")
            url = f"{_supabase_url()}/rest/v1/users?select={select_cols}&full_name={encoded}"
            if phone:
                url += f"&phone=eq.{phone}"
            if user_id:
                url += f"&id=eq.{user_id}"
            if organization:
                url += f"&organization=eq.{urllib.parse.quote(organization)}"
            if team:
                url += f"&team=eq.{urllib.parse.quote(team)}"
            r = await client.get(url, headers=_supabase_headers())
        elif phone or user_id or organization or team:
            params = [("select", select_cols)]
            if phone:
                params.append(("phone", f"eq.{phone}"))
            if user_id:
                params.append(("id", f"eq.{user_id}"))
            if organization:
                params.append(("organization", f"eq.{organization}"))
            if team:
                params.append(("team", f"eq.{team}"))
            r = await client.get(
                f"{_supabase_url()}/rest/v1/users",
                headers=_supabase_headers(),
                params=params,
            )
        else:
            return _err("Provide at least name, phone, user_id, organization, or team.")

        if not r.is_success:
            return _err(f"Supabase error {r.status_code}: {r.text[:200]}")
        rows = r.json()
        if not rows:
            return _ok({"found": False, "message": f"No user found matching '{name or phone}'."})
        return _ok({"found": True, "count": len(rows), "users": rows})
    except Exception as exc:
        return _err(str(exc))


async def get_user_stats(user_id=None) -> str:
    """Get expense statistics for a user or all users."""
    try:
        params: Dict[str, Any] = {"select": "*"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return _ok(await _get("user_expense_stats", params))
    except Exception as exc:
        return _err(str(exc))


async def compare_two_users(user_id_a: str, user_id_b: str) -> str:
    """Compare expense stats for two users side-by-side."""
    try:
        rows = await _get(
            "user_expense_stats",
            {"select": "*", "user_id": f"in.({user_id_a},{user_id_b})"},
        )
        if not rows:
            return _err("No stats found.")
        by_id = {r["user_id"]: r for r in rows}
        a, b = by_id.get(user_id_a), by_id.get(user_id_b)
        if not a or not b:
            missing = [u for u in [user_id_a, user_id_b] if u not in by_id]
            return _err(f"Stats not found for: {', '.join(missing)}")

        def _f(r, k):
            try:
                return float(r.get(k) or 0)
            except Exception:
                return 0.0

        ca, cb = _f(a, "total_claimed"), _f(b, "total_claimed")
        ra, rb = _f(a, "reimbursement_rate_pct"), _f(b, "reimbursement_rate_pct")
        higher = (
            (a.get("full_name") or user_id_a)
            if ca >= cb
            else (b.get("full_name") or user_id_b)
        )
        return _ok({
            "user_a": a,
            "user_b": b,
            "deltas": {
                "claimed_diff": round(float(ca - cb), 2),
                "reimbursement_rate_diff_pct": round(float(ra - rb), 4),
                "note": f"{higher} claims more overall.",
            },
        })
    except Exception as exc:
        return _err(str(exc))


async def semantic_search_expenses(
    query: str, user_id=None, limit: int = 8
) -> str:
    """Search expenses using natural language (semantic / vector search)."""
    try:
        vector = generate_query_embedding(query)
        if vector is None:
            return _err("Could not generate embedding.")
        rows = await _rpc(
            "match_expenses",
            {"query_embedding": vector, "match_count": limit, "filter_user_id": user_id},
        )
        return _ok(rows)
    except Exception as exc:
        return _err(str(exc))


async def get_applications(
    user_id=None, status=None, organization=None, team=None, limit: int = 30,
) -> str:
    """Fetch expense applications with optional filters."""
    try:
        select_clause = "*"
        if organization or team:
            select_clause = "*,users!inner(organization,team)"
        params = [
            ("select", select_clause),
            ("order", "created_at.desc"),
            ("limit", str(limit)),
        ]
        if user_id:
            params.append(("user_id", f"eq.{user_id}"))
        if status:
            params.append(("status", f"eq.{status}"))
        if organization:
            params.append(("users.organization", f"eq.{organization}"))
        if team:
            params.append(("users.team", f"eq.{team}"))
        r = await _get_http_client().get(
            f"{_supabase_url()}/rest/v1/applications",
            headers=_supabase_headers(),
            params=params,
        )
        r.raise_for_status()
        return _ok(r.json())
    except Exception as exc:
        return _err(str(exc))


async def get_policies(user_id=None) -> str:
    """Fetch reimbursement policies for a user or all users."""
    try:
        params: Dict[str, Any] = {"select": "*"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        return _ok(await _get("policies", params))
    except Exception as exc:
        return _err(str(exc))


async def set_policy_override(
    user_id, set_by, valid_from, valid_until, reason,
    meal_tier1=None, meal_tier2=None, meal_tier3=None,
    travel_limit=None, hotel_limit=None,
) -> str:
    """Set a temporary policy override for a user. Admin only."""
    try:
        payload: Dict[str, Any] = {
            "p_user_id": user_id,
            "p_set_by": set_by,
            "p_valid_from": valid_from,
            "p_valid_until": valid_until,
            "p_reason": reason,
        }
        if meal_tier1 is not None: payload["p_meal_tier1"] = meal_tier1
        if meal_tier2 is not None: payload["p_meal_tier2"] = meal_tier2
        if meal_tier3 is not None: payload["p_meal_tier3"] = meal_tier3
        if travel_limit is not None: payload["p_travel_limit"] = travel_limit
        if hotel_limit is not None: payload["p_hotel_limit"] = hotel_limit
        await _rpc_write("set_temporary_override", payload)
        return _ok({"success": True, "message": f"Policy override set for {user_id}."})
    except Exception as exc:
        return _err(str(exc))


async def clear_policy_override(user_id: str) -> str:
    """Clear an active policy override for a user. Admin only."""
    try:
        await _rpc_write("clear_override", {"p_user_id": user_id})
        return _ok({"success": True, "message": f"Override cleared for {user_id}."})
    except Exception as exc:
        return _err(str(exc))


async def get_duplicate_receipts() -> str:
    """Find receipts submitted with duplicate UTR numbers (potential fraud)."""
    try:
        rows = await _get(
            "receipts",
            {"select": "utr_number,expense_id", "utr_number": "neq."},
        )
        groups: Dict[str, List[str]] = {}
        for r in rows:
            utr = (r.get("utr_number") or "").strip()
            if utr:
                groups.setdefault(utr, []).append(r.get("expense_id", ""))
        dups = [
            {"utr_number": u, "occurrences": len(ids), "expense_ids": ids}
            for u, ids in groups.items()
            if len(ids) > 1
        ]
        dups.sort(key=lambda x: x["occurrences"], reverse=True)
        return _ok(dups)
    except Exception as exc:
        return _err(str(exc))


async def get_mismatch_breakdown(user_id=None) -> str:
    """Count frequency of each mismatch tag across all expenses."""
    try:
        params: Dict[str, Any] = {"select": "mismatches"}
        if user_id:
            params["user_id"] = f"eq.{user_id}"
        rows = await _get("expenses", params)
        counter: Counter = Counter()
        for r in rows:
            tags = r.get("mismatches") or []
            if isinstance(tags, list):
                counter.update(tags)
        return _ok(dict(counter.most_common()))
    except Exception as exc:
        return _err(str(exc))


async def search_expenses_by_amount(
    min_amount=None, max_amount=None, user_id=None
) -> str:
    """Search expenses within a claimed amount range."""
    try:
        cols = (
            "id,user_name,expense_type,claimed_amount_numeric,"
            "reimbursable_amount,verified,mismatches,application_id,city_tier"
        )
        base = [
            ("select", cols),
            ("order", "claimed_amount_numeric.desc"),
            ("limit", "100"),
        ]
        if user_id:
            base.append(("user_id", f"eq.{user_id}"))
        if min_amount is not None:
            base.append(("claimed_amount_numeric", f"gte.{min_amount}"))
        if max_amount is not None:
            base.append(("claimed_amount_numeric", f"lte.{max_amount}"))
        r = await _get_http_client().get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            params=base,
        )
        r.raise_for_status()
        return _ok(r.json())
    except Exception as exc:
        return _err(str(exc))


async def get_chat_history(user_phone=None, limit: int = 20) -> str:
    """Fetch recent chat messages, optionally filtered by user phone."""
    try:
        params: Dict[str, Any] = {
            "select": "*",
            "order": "created_at.desc",
            "limit": str(limit),
        }
        if user_phone:
            params["phone"] = f"eq.{user_phone}"
        return _ok(await _get("chat_messages", params))
    except Exception as exc:
        return _err(str(exc))


async def get_users(role=None, organization=None, team=None) -> str:
    """List users with optional filters by role, organization, or team."""
    try:
        params = [
            ("select", "id,full_name,role,phone,email,created_at,organization,team")
        ]
        if role:
            params.append(("role", f"eq.{role}"))
        if organization:
            params.append(("organization", f"eq.{organization}"))
        if team:
            params.append(("team", f"eq.{team}"))
        r = await _get_http_client().get(
            f"{_supabase_url()}/rest/v1/users",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            params=params,
        )
        r.raise_for_status()
        return _ok({"count": len(r.json()), "users": r.json()})
    except Exception as exc:
        return _err(str(exc))


async def get_flagged_expenses(
    user_id=None, mismatch_type=None, application_id=None, limit: int = 50,
) -> str:
    """Fetch detailed flagged/mismatched expenses for auditing."""
    try:
        params = [
            (
                "select",
                (
                    "id,user_name,application_id,client_name,visit_duration,"
                    "expense_type,date_range,claimed_amount,claimed_amount_numeric,"
                    "reimbursable_amount,verified,mismatches,audit_explanation,"
                    "audit_sources,city,city_tier,created_at,participant_names,"
                    "participant_count"
                ),
            ),
            ("verified", "eq.false"),
            ("order", "created_at.desc"),
            ("limit", str(min(limit, 200))),
        ]
        if user_id:
            params.append(("user_id", f"eq.{user_id}"))
        if application_id:
            params.append(("application_id", f"eq.{application_id}"))
        r = await _get_http_client().get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            params=params,
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
                try:
                    sources = json.loads(sources)
                except Exception:
                    sources = {}
            enriched.append({
                "expense_id":      row.get("id"),
                "employee":        row.get("user_name"),
                "application_id":  row.get("application_id"),
                "client":          row.get("client_name") or "N/A",
                "visit_duration":  row.get("visit_duration") or "N/A",
                "expense_date":    row.get("date_range") or "N/A",
                "expense_type":    row.get("expense_type"),
                "claimed_amount":  row.get("claimed_amount"),
                "reimbursable_amount": row.get("reimbursable_amount") or 0,
                "city":            row.get("city") or "N/A",
                "city_tier":       row.get("city_tier") or "N/A",
                "participants":    row.get("participant_count"),
                "mismatch_flags":  mismatches,
                "mismatch_count":  len(mismatches),
                "mismatch_details": sources,
                "audit_explanation": row.get("audit_explanation") or "No explanation available",
                "submitted_at":    row.get("created_at"),
            })
        return _ok({"count": len(enriched), "flagged_expenses": enriched})
    except Exception as exc:
        return _err(str(exc))


async def get_expenses_detail(
    user_id=None, application_id=None, verified=None,
    organization=None, team=None, limit: int = 50,
) -> str:
    """Fetch expense records with comprehensive filters."""
    try:
        select_clause = (
            "id,user_name,application_id,client_name,visit_duration,expense_type,"
            "date_range,claimed_amount,claimed_amount_numeric,reimbursable_amount,"
            "verified,mismatches,audit_explanation,city,city_tier,created_at,"
            "participant_names,participant_count"
        )
        if organization or team:
            select_clause += ",users!inner(organization,team)"
        params = [
            ("select", select_clause),
            ("order", "created_at.desc"),
            ("limit", str(min(limit, 200))),
        ]
        if user_id:
            params.append(("user_id", f"eq.{user_id}"))
        if application_id:
            params.append(("application_id", f"eq.{application_id}"))
        if verified is not None:
            params.append(("verified", f"eq.{str(verified).lower()}"))
        if organization:
            params.append(("users.organization", f"eq.{organization}"))
        if team:
            params.append(("users.team", f"eq.{team}"))
        r = await _get_http_client().get(
            f"{_supabase_url()}/rest/v1/expenses",
            headers={**_supabase_headers(), "Prefer": "return=representation"},
            params=params,
        )
        r.raise_for_status()
        return _ok({"count": len(r.json()), "expenses": r.json()})
    except Exception as exc:
        return _err(str(exc))


async def generate_dashboard(title: str, charts_json: str) -> str:
    """Generate a visual dashboard and persist it. Returns [dashboard_id:uuid]Title."""
    try:
        charts = json.loads(charts_json)
        r = await _get_http_client().post(
            f"{_supabase_url()}/rest/v1/dashboards",
            headers={**_supabase_service_headers(), "Prefer": "return=representation"},
            json={"spec": {"type": "dashboard", "title": title, "charts": charts}},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return "Dashboard creation failed: No ID returned"
        return f"[dashboard_id:{rows[0].get('id')}]{title}"
    except Exception as exc:
        return f"Failed to create dashboard: {exc}"


# ─── Smart dashboard builder — fetches & formats data internally ──────────────

DASHBOARD_COLORS = ["#6366F1", "#8B5CF6", "#F472B6", "#34D399", "#F59E0B", "#60A5FA", "#FB923C", "#A78BFA"]


async def build_and_save_dashboard(
    title: str,
    chart_types: str,
    user_id: str = None,
    organization: str = None,
    team: str = None,
) -> str:
    """
    PREFERRED dashboard tool. Fetches real data and builds charts automatically.
    chart_types: comma-separated — any of:
      expenses_by_category, expenses_by_user, flagged_breakdown,
      user_stats, applications_summary, mismatch_breakdown
    Optional filters: user_id, organization, team.
    Returns [dashboard_id:uuid]Title.
    """
    charts = []
    requested = [r.strip().lower() for r in chart_types.split(",")]

    async def _fetch(table: str, params: Any) -> List[Dict]:
        r = await _get_http_client().get(
            f"{_supabase_url()}/rest/v1/{table}",
            headers=_supabase_headers(),
            params=params,
        )
        r.raise_for_status()
        return r.json()

    try:
        for req in requested:

            # ── expenses_by_category ─────────────────────────────────────────
            if req == "expenses_by_category":
                params: List = [
                    ("select", "expense_type,claimed_amount_numeric"),
                    ("order", "created_at.desc"), ("limit", "300"),
                ]
                if user_id:      params.append(("user_id",      f"eq.{user_id}"))
                if organization: params.append(("organization", f"eq.{organization}"))
                if team:         params.append(("team",         f"eq.{team}"))
                rows = await _fetch("expenses", params)

                totals: Dict[str, float] = {}
                for row in rows:
                    cat = (row.get("expense_type") or "other").lower().strip()
                    totals[cat] = totals.get(cat, 0.0) + float(row.get("claimed_amount_numeric") or 0)
                data = [{"label": k.title(), "value": round(v, 2)}
                        for k, v in sorted(totals.items(), key=lambda x: -x[1]) if v > 0]
                if data:
                    charts.append({"type": "donut", "title": "Expenses by Category",
                                   "unit": "₹", "category_key": "label", "value_key": "value",
                                   "colors": DASHBOARD_COLORS, "data": data})
                    charts.append({"type": "bar", "title": "Category Breakdown",
                                   "unit": "₹", "x_key": "label", "y_key": "value",
                                   "colors": DASHBOARD_COLORS, "data": data})

            # ── expenses_by_user / top_claimants ─────────────────────────────
            elif req in ("expenses_by_user", "top_claimants"):
                params = [
                    ("select", "user_name,claimed_amount_numeric,reimbursable_amount"),
                    ("order", "created_at.desc"), ("limit", "300"),
                ]
                if user_id:      params.append(("user_id",      f"eq.{user_id}"))
                if organization: params.append(("organization", f"eq.{organization}"))
                rows = await _fetch("expenses", params)

                claimed_map: Dict[str, float] = {}
                approved_map: Dict[str, float] = {}
                for row in rows:
                    name = row.get("user_name") or "Unknown"
                    claimed_map[name]  = claimed_map.get(name, 0.0)  + float(row.get("claimed_amount_numeric") or 0)
                    approved_map[name] = approved_map.get(name, 0.0) + float(row.get("reimbursable_amount") or 0)
                data = [
                    {"label": k, "claimed": round(claimed_map[k], 2), "approved": round(approved_map[k], 2)}
                    for k in sorted(claimed_map, key=lambda x: -claimed_map[x])
                ]
                if data:
                    charts.append({"type": "bar", "title": "Claimed vs Approved per Employee",
                                   "unit": "₹", "x_key": "label", "y_key": "claimed",
                                   "colors": DASHBOARD_COLORS, "data": data})

            # ── flagged_breakdown ────────────────────────────────────────────
            elif req == "flagged_breakdown":
                params = [
                    ("select", "mismatches,claimed_amount_numeric,user_name"),
                    ("verified", "eq.false"), ("order", "created_at.desc"), ("limit", "300"),
                ]
                if user_id: params.append(("user_id", f"eq.{user_id}"))
                rows = await _fetch("expenses", params)

                counts: Dict[str, int] = {}
                table_rows: List[Dict] = []
                for row in rows:
                    mismatches = row.get("mismatches") or []
                    for m in mismatches:
                        counts[m] = counts.get(m, 0) + 1
                    if mismatches:
                        table_rows.append({
                            "Employee": row.get("user_name") or "—",
                            "Flags":    ", ".join(mismatches),
                            "Claimed":  f"₹{round(float(row.get('claimed_amount_numeric') or 0)):,}",
                        })
                data = [{"label": k.replace("_", " ").title(), "value": v}
                        for k, v in sorted(counts.items(), key=lambda x: -x[1])]
                if data:
                    charts.append({"type": "donut", "title": "Flagged Expense Types",
                                   "category_key": "label", "value_key": "value",
                                   "colors": DASHBOARD_COLORS, "data": data})
                if table_rows:
                    charts.append({"type": "table", "title": "Flagged Expenses Detail",
                                   "columns": [{"key": "Employee", "label": "Employee"},
                                               {"key": "Flags",    "label": "Mismatch Flags"},
                                               {"key": "Claimed",  "label": "Claimed"}],
                                   "rows": table_rows[:50]})

            # ── user_stats ───────────────────────────────────────────────────
            elif req == "user_stats":
                stat_params: Dict[str, Any] = {"select": "*"}
                if user_id: stat_params["user_id"] = f"eq.{user_id}"
                rows = await _fetch("user_expense_stats", stat_params)

                bar_data: List[Dict] = []
                table_rows = []
                for row in rows:
                    name    = row.get("full_name") or "Unknown"
                    claimed = float(row.get("total_claimed") or 0)
                    appr    = float(row.get("total_approved") or 0)
                    rate    = float(row.get("reimbursement_rate_pct") or 0)
                    bar_data.append({"label": name, "claimed": round(claimed, 2), "approved": round(appr, 2)})
                    table_rows.append({
                        "Employee": name,
                        "Claimed":  f"₹{round(claimed):,}",
                        "Approved": f"₹{round(appr):,}",
                        "Rate":     f"{round(rate * 100, 1)}%",
                    })
                if bar_data:
                    charts.append({"type": "bar", "title": "Claimed vs Approved per Employee",
                                   "unit": "₹", "x_key": "label", "y_key": "claimed",
                                   "colors": DASHBOARD_COLORS, "data": bar_data})
                    charts.append({"type": "table", "title": "Employee Stats",
                                   "columns": [{"key": "Employee", "label": "Employee"},
                                               {"key": "Claimed",  "label": "Claimed"},
                                               {"key": "Approved", "label": "Approved"},
                                               {"key": "Rate",     "label": "Approval Rate"}],
                                   "rows": table_rows})

            # ── applications_summary ─────────────────────────────────────────
            elif req in ("applications_summary", "applications"):
                params = [("select", "status"), ("order", "created_at.desc"), ("limit", "300")]
                rows = await _fetch("applications", params)

                counts = {}
                for row in rows:
                    s = (row.get("status") or "unknown").lower()
                    counts[s] = counts.get(s, 0) + 1
                data = [{"label": k.title(), "value": v}
                        for k, v in sorted(counts.items(), key=lambda x: -x[1])]
                if data:
                    charts.append({"type": "donut", "title": "Applications by Status",
                                   "category_key": "label", "value_key": "value",
                                   "colors": DASHBOARD_COLORS, "data": data})

            # ── mismatch_breakdown ───────────────────────────────────────────
            elif req == "mismatch_breakdown":
                params = [("select", "mismatches"), ("verified", "eq.false"), ("limit", "300")]
                if user_id: params.append(("user_id", f"eq.{user_id}"))
                rows = await _fetch("expenses", params)

                counts = {}
                for row in rows:
                    for m in (row.get("mismatches") or []):
                        counts[m] = counts.get(m, 0) + 1
                data = [{"label": k.replace("_", " ").title(), "value": v}
                        for k, v in sorted(counts.items(), key=lambda x: -x[1])]
                if data:
                    charts.append({"type": "bar", "title": "Mismatch Type Frequency",
                                   "x_key": "label", "y_key": "value",
                                   "colors": DASHBOARD_COLORS, "data": data})

            # ── team_breakdown ───────────────────────────────────────────────
            elif req in ("team_breakdown", "team_comparison", "by_team"):
                # Join expenses → users to get team name per row
                params = [
                    ("select", "claimed_amount_numeric,reimbursable_amount,expense_type,users!inner(team,full_name)"),
                    ("order",  "created_at.desc"),
                    ("limit",  "500"),
                ]
                if organization: params.append(("users.organization", f"eq.{organization}"))
                if team:         params.append(("users.team",         f"eq.{team}"))
                rows = await _fetch("expenses", params)

                team_claimed:  Dict[str, float] = {}
                team_approved: Dict[str, float] = {}
                team_cat:      Dict[str, Dict[str, float]] = {}   # team → category → amount
                team_members:  Dict[str, set] = {}

                for row in rows:
                    t = (row.get("users") or {}).get("team") or "Unknown"
                    emp = (row.get("users") or {}).get("full_name") or "Unknown"
                    cat = (row.get("expense_type") or "other").lower().strip()
                    c   = float(row.get("claimed_amount_numeric") or 0)
                    a   = float(row.get("reimbursable_amount") or 0)

                    team_claimed[t]  = team_claimed.get(t, 0.0)  + c
                    team_approved[t] = team_approved.get(t, 0.0) + a
                    team_members.setdefault(t, set()).add(emp)
                    team_cat.setdefault(t, {})
                    team_cat[t][cat] = team_cat[t].get(cat, 0.0) + c

                if team_claimed:
                    # Bar chart — claimed vs approved per team
                    bar_data = [
                        {"label": t, "claimed": round(team_claimed[t], 2), "approved": round(team_approved[t], 2)}
                        for t in sorted(team_claimed, key=lambda x: -team_claimed[x])
                    ]
                    charts.append({"type": "bar", "title": "Expenses by Team",
                                   "unit": "₹", "x_key": "label", "y_key": "claimed",
                                   "colors": DASHBOARD_COLORS, "data": bar_data})

                    # Donut — share of total claimed per team
                    donut_data = [{"label": t, "value": round(v, 2)}
                                  for t, v in sorted(team_claimed.items(), key=lambda x: -x[1])]
                    charts.append({"type": "donut", "title": "Team Expense Share",
                                   "unit": "₹", "category_key": "label", "value_key": "value",
                                   "colors": DASHBOARD_COLORS, "data": donut_data})

                    # Table — summary per team
                    table_rows = []
                    for t in sorted(team_claimed, key=lambda x: -team_claimed[x]):
                        cl = team_claimed[t]
                        ap = team_approved[t]
                        rate = (ap / cl * 100) if cl > 0 else 0.0
                        top_cat = max(team_cat[t], key=lambda x: team_cat[t][x]) if team_cat.get(t) else "—"
                        table_rows.append({
                            "Team":        t,
                            "Members":     len(team_members.get(t, set())),
                            "Claimed":     f"₹{round(cl):,}",
                            "Approved":    f"₹{round(ap):,}",
                            "Rate":        f"{round(rate, 1)}%",
                            "Top Category": top_cat.title(),
                        })
                    charts.append({"type": "table", "title": "Team Summary",
                                   "columns": [
                                       {"key": "Team",         "label": "Team"},
                                       {"key": "Members",      "label": "Members"},
                                       {"key": "Claimed",      "label": "Claimed"},
                                       {"key": "Approved",     "label": "Approved"},
                                       {"key": "Rate",         "label": "Approval Rate"},
                                       {"key": "Top Category", "label": "Top Category"},
                                   ],
                                   "rows": table_rows})

        if not charts:
            return _err("No data found for the requested chart types.")

        r = await _get_http_client().post(
            f"{_supabase_url()}/rest/v1/dashboards",
            headers={**_supabase_service_headers(), "Prefer": "return=representation"},
            json={"spec": {"type": "dashboard", "title": title, "charts": charts}},
        )
        r.raise_for_status()
        saved = r.json()
        if not saved:
            return "Dashboard creation failed: no ID returned."
        return f"[dashboard_id:{saved[0].get('id')}]{title}"

    except Exception as exc:
        return _err(str(exc))


async def save_dashboard(spec: str) -> str:
    """Persist a raw dashboard specification JSON string."""
    try:
        r = await _get_http_client().post(
            f"{_supabase_url()}/rest/v1/dashboards",
            headers={**_supabase_service_headers(), "Prefer": "return=representation"},
            json={"spec": json.loads(spec)},
        )
        r.raise_for_status()
        rows = r.json()
        if not rows:
            return _err("No data returned after insert")
        return _ok({"id": rows[0].get("id")})
    except Exception as exc:
        return _err(str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# Tool dispatch map
# ─────────────────────────────────────────────────────────────────────────────

TOOL_MAP = {
    "resolve_user":              resolve_user,
    "get_user_stats":            get_user_stats,
    "compare_two_users":         compare_two_users,
    "semantic_search_expenses":  semantic_search_expenses,
    "get_applications":          get_applications,
    "get_policies":              get_policies,
    "set_policy_override":       set_policy_override,
    "clear_policy_override":     clear_policy_override,
    "get_duplicate_receipts":    get_duplicate_receipts,
    "get_mismatch_breakdown":    get_mismatch_breakdown,
    "search_expenses_by_amount": search_expenses_by_amount,
    "get_chat_history":          get_chat_history,
    "get_users":                 get_users,
    "get_flagged_expenses":      get_flagged_expenses,
    "get_expenses_detail":       get_expenses_detail,
    "generate_dashboard":        generate_dashboard,
    "save_dashboard":            save_dashboard,
    "build_and_save_dashboard":  build_and_save_dashboard,
}


def _thinking_label(name: str) -> str:
    n = name.lower()
    if "expense"   in n: return "Fetching expenses..."
    if "user"      in n: return "Searching users..."
    if "polic"     in n: return "Checking policies..."
    if "dashboard" in n: return "Building dashboard..."
    if "duplicate" in n: return "Checking for duplicates..."
    if "mismatch"  in n: return "Analysing mismatches..."
    return f"Using {name}..."


# ─────────────────────────────────────────────────────────────────────────────
# Gemini Live tool declarations
# ─────────────────────────────────────────────────────────────────────────────

GEMINI_TOOLS = [
    types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="resolve_user",
                description=(
                    "Find users by name, phone, UUID, organization, or team. "
                    "Always call this first if you only have a name."
                ),
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "name":         types.Schema(type=types.Type.STRING),
                        "phone":        types.Schema(type=types.Type.STRING),
                        "user_id":      types.Schema(type=types.Type.STRING),
                        "organization": types.Schema(type=types.Type.STRING),
                        "team":         types.Schema(type=types.Type.STRING),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_user_stats",
                description="Get expense statistics for a user or all users.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={"user_id": types.Schema(type=types.Type.STRING)},
                ),
            ),
            types.FunctionDeclaration(
                name="compare_two_users",
                description="Compare expense stats for two users side-by-side.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "user_id_a": types.Schema(type=types.Type.STRING),
                        "user_id_b": types.Schema(type=types.Type.STRING),
                    },
                    required=["user_id_a", "user_id_b"],
                ),
            ),
            types.FunctionDeclaration(
                name="semantic_search_expenses",
                description="Search expenses using natural language (semantic search).",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "query":   types.Schema(type=types.Type.STRING),
                        "user_id": types.Schema(type=types.Type.STRING),
                        "limit":   types.Schema(type=types.Type.INTEGER),
                    },
                    required=["query"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_applications",
                description="Fetch expense applications with optional filters.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "user_id":      types.Schema(type=types.Type.STRING),
                        "status":       types.Schema(type=types.Type.STRING),
                        "organization": types.Schema(type=types.Type.STRING),
                        "team":         types.Schema(type=types.Type.STRING),
                        "limit":        types.Schema(type=types.Type.INTEGER),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_policies",
                description="Fetch reimbursement policies.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={"user_id": types.Schema(type=types.Type.STRING)},
                ),
            ),
            types.FunctionDeclaration(
                name="set_policy_override",
                description="Set a temporary policy override. Admin only.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "user_id":      types.Schema(type=types.Type.STRING),
                        "set_by":       types.Schema(type=types.Type.STRING),
                        "valid_from":   types.Schema(type=types.Type.STRING),
                        "valid_until":  types.Schema(type=types.Type.STRING),
                        "reason":       types.Schema(type=types.Type.STRING),
                        "meal_tier1":   types.Schema(type=types.Type.NUMBER),
                        "meal_tier2":   types.Schema(type=types.Type.NUMBER),
                        "meal_tier3":   types.Schema(type=types.Type.NUMBER),
                        "travel_limit": types.Schema(type=types.Type.NUMBER),
                        "hotel_limit":  types.Schema(type=types.Type.NUMBER),
                    },
                    required=["user_id", "set_by", "valid_from", "valid_until", "reason"],
                ),
            ),
            types.FunctionDeclaration(
                name="clear_policy_override",
                description="Clear an active policy override. Admin only.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={"user_id": types.Schema(type=types.Type.STRING)},
                    required=["user_id"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_duplicate_receipts",
                description="Find receipts with duplicate UTR numbers.",
                parameters=types.Schema(type=types.Type.OBJECT, properties={}),
            ),
            types.FunctionDeclaration(
                name="get_mismatch_breakdown",
                description="Count frequency of mismatch tags.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={"user_id": types.Schema(type=types.Type.STRING)},
                ),
            ),
            types.FunctionDeclaration(
                name="search_expenses_by_amount",
                description="Search expenses by claimed amount range.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "min_amount": types.Schema(type=types.Type.NUMBER),
                        "max_amount": types.Schema(type=types.Type.NUMBER),
                        "user_id":    types.Schema(type=types.Type.STRING),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_chat_history",
                description="Fetch recent chat messages.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "user_phone": types.Schema(type=types.Type.STRING),
                        "limit":      types.Schema(type=types.Type.INTEGER),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_users",
                description="List users with optional filters.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "role":         types.Schema(type=types.Type.STRING),
                        "organization": types.Schema(type=types.Type.STRING),
                        "team":         types.Schema(type=types.Type.STRING),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_flagged_expenses",
                description="Fetch detailed flagged/mismatched expenses for auditing.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "user_id":        types.Schema(type=types.Type.STRING),
                        "mismatch_type":  types.Schema(type=types.Type.STRING),
                        "application_id": types.Schema(type=types.Type.STRING),
                        "limit":          types.Schema(type=types.Type.INTEGER),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="get_expenses_detail",
                description="Fetch expense records with comprehensive filters.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "user_id":        types.Schema(type=types.Type.STRING),
                        "application_id": types.Schema(type=types.Type.STRING),
                        "verified":       types.Schema(type=types.Type.BOOLEAN),
                        "organization":   types.Schema(type=types.Type.STRING),
                        "team":           types.Schema(type=types.Type.STRING),
                        "limit":          types.Schema(type=types.Type.INTEGER),
                    },
                ),
            ),
            types.FunctionDeclaration(
                name="generate_dashboard",
                description="Generate a visual dashboard. Returns [dashboard_id:uuid]Title.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "title":       types.Schema(type=types.Type.STRING),
                        "charts_json": types.Schema(
                            type=types.Type.STRING,
                            description="JSON array of chart objects",
                        ),
                    },
                    required=["title", "charts_json"],
                ),
            ),
            types.FunctionDeclaration(
                name="save_dashboard",
                description="Persist a dashboard specification.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "spec": types.Schema(
                            type=types.Type.STRING,
                            description="JSON string of dashboard spec",
                        )
                    },
                    required=["spec"],
                ),
            ),
            types.FunctionDeclaration(
                name="build_and_save_dashboard",
                description=(
                    "PREFERRED tool for ALL dashboard/chart/visualization requests. "
                    "Automatically fetches real data from the database and builds charts — "
                    "you only specify what to show. Returns [dashboard_id:uuid]Title."
                ),
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "title": types.Schema(
                            type=types.Type.STRING,
                            description="Dashboard title",
                        ),
                        "chart_types": types.Schema(
                            type=types.Type.STRING,
                            description=(
                                "Comma-separated chart types. Available values: "
                                "expenses_by_category, expenses_by_user, "
                                "flagged_breakdown, user_stats, "
                                "applications_summary, mismatch_breakdown, "
                                "team_breakdown"
                            ),
                        ),
                        "user_id": types.Schema(
                            type=types.Type.STRING,
                            description="Filter to a specific user UUID (optional)",
                        ),
                        "organization": types.Schema(
                            type=types.Type.STRING,
                            description="Filter by organization name (optional)",
                        ),
                        "team": types.Schema(
                            type=types.Type.STRING,
                            description="Filter by team name (optional)",
                        ),
                    },
                    required=["title", "chart_types"],
                ),
            ),
        ]
    )
]

# ─────────────────────────────────────────────────────────────────────────────
# System prompt
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are the Expify Voice Assistant for Fristine Infotech. Today: {date}.
You provide data intelligence and cross-table data management for admins and employees.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VOICE RESPONSE RULES (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Reply in 1-3 short spoken sentences only.
- NO markdown, bullets, or symbols. Say "rupees" not "₹".
- Speak naturally and warmly. Round amounts to nearest rupee.
- Even when performing complex tasks (like sending emails), keep the spoken reply brief (e.g., "I've sent that summary to Rahul.").
- NO formatting like tables or code blocks in voice — explain the data instead.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MULTILINGUAL SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- Automatically detect the language the user speaks in.
- ALWAYS reply in the SAME language the user is speaking.
- Supported languages: English, Hindi (हिंदी), Marathi (मराठी), Gujarati (ગુજરાતી), Tamil (தமிழ்), Telugu (తెలుగు), Kannada (ಕನ್ನಡ), Bengali (বাংলা), and other Indian languages.
- If the user switches language mid-conversation, switch your response language accordingly.
- Keep all tool calls/function arguments in English internally — only the spoken reply should be in the user's language.
- Example: If user says "सभी users दिखाओ", call get_users() in English, but reply in Hindi like "सिस्टम में तीन यूजर्स हैं."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IDENTITY & RBAC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The user's identity is cryptographically verified by Supabase auth.
- If context shows role = "admin", you have full cross-user access to all tables.
- If role = "employee", restrict ALL data queries to the requesting user's own data.
  Exception: Aggregated team/org insights without exposing private details.
- Context info provided in this session:
  Admin/User ID: {admin_id}
  Role: {role}
  Organization: {organization}
  Team: {team}

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
   get_mismatch_breakdown is ONLY for "how many of each type" counts.

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

8. DASHBOARDS:
   ALWAYS use build_and_save_dashboard — NEVER use generate_dashboard for voice requests.
   Steps:
   a. If user mentions a person by name, call resolve_user first to get their user_id.
   b. Pick chart_types from: expenses_by_category, expenses_by_user,
      flagged_breakdown, user_stats, applications_summary, mismatch_breakdown,
      team_breakdown.
   c. Call build_and_save_dashboard(title, chart_types, user_id?) — it handles all data fetching internally.
   d. Return the EXACT [dashboard_id:uuid]Title string from the tool output.

   Examples:
   - "Show all expenses dashboard"   → chart_types="expenses_by_category,expenses_by_user"
   - "Flagged expenses dashboard"    → chart_types="flagged_breakdown"
   - "Employee stats dashboard"      → chart_types="user_stats"
   - "Dashboard for Rahul"           → resolve_user("Rahul") first, then build_and_save_dashboard with user_id
   - "Team expenses dashboard"       → chart_types="team_breakdown"
   - "Engineering team dashboard"    → chart_types="team_breakdown", team="Engineering"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXTERNAL TOOL RULES (GMAIL/SLACK)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- GMAIL_SEND_EMAIL: Always use a professional HTML <table> (with inline CSS) for data summaries.
- SLACK_SEND_MESSAGE: Use the 'channel' (no #) and 'markdown_text' parameters.
- GMAIL_FETCH_EMAILS: query, max_results only.
- IMPORTANT: When a tool response contains "success": true, the action was completed successfully.
  Always confirm success to the user, e.g., "I've sent that email to [Name]."
  NEVER say you couldn't do it if the tool returned success.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POLICY UPDATE FLOW (ADMIN ONLY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Identify the user (resolve_user or [user_id:uuid]).
2. Gather: limits, values, dates, and reason.
3. Speak a brief summary and ask for confirmation.
4. Call set_policy_override only after receiving explicit confirmation.

Meal limits: 900 rupees Tier 1, 700 Tier 2, 450 Tier 3 per day.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GOOGLE SEARCH & GROUNDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
- You HAVE access to Google Search.
- Use it for breaking news, information outside your database, or general facts.
- If the user asks for information from the internet, always perform a search.
"""

# ─────────────────────────────────────────────────────────────────────────────
# FastAPI sub-app  (mounted at /voice by main.py)
# ─────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI as _FastAPI, WebSocket as _WebSocket, WebSocketDisconnect as _WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware as _CORSMiddleware

app = _FastAPI(title="Expify Voice Agent")

app.add_middleware(
    _CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "model": GEMINI_MODEL}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: _WebSocket, session_id: str):
    """
    Bidirectional voice WebSocket  (follows Google ADK sample pattern).

    Query params:
        admin_id  – UUID of the authenticated admin

    Client → Server:
        Binary frame  : raw PCM audio  (16 kHz, 16-bit LE, mono)
        Text frame    : JSON  {"type": "text", "data": "hello"}

    Server → Client  (all JSON text frames):
        {"type": "audio",          "data": "<base64 PCM 24 kHz>", "sampleRate": 24000}
        {"type": "transcript_in",  "text": "..."}
        {"type": "transcript_out", "text": "..."}
        {"type": "tool_thinking",  "label": "..."}
        {"type": "dashboard_ready","id": "uuid", "title": "..."}
        {"type": "turn_complete"}
        {"type": "error",          "message": "..."}
    """
    await ws.accept()
    admin_id = ws.query_params.get("admin_id", "")
    role = ws.query_params.get("role", "admin" if admin_id else "employee")
    user_id = ws.query_params.get("user_id", admin_id)
    org = ws.query_params.get("organization", "")
    team = ws.query_params.get("team", "")

    logger.info(f"[WS] Connected session={session_id} user_id={user_id!r} role={role!r}")

    system_msg = SYSTEM_PROMPT.format(
        date=datetime.now(timezone.utc).strftime("%B %Y"),
        admin_id=user_id or "unknown",
        role=role,
        organization=org or "Fristine Infotech",
        team=team or "Executive",
    )

    # ── Tool compilation ─────────────────────────────────────────────────────
    all_decls = []
    # 1. Add static tools from GEMINI_TOOLS
    for t_obj in GEMINI_TOOLS:
        if t_obj.function_declarations:
            all_decls.extend(t_obj.function_declarations)
            
    # 2. Load dynamic tools if admin_id is present
    dynamic_tools: Dict[str, SanitizedTool] = {}
    if admin_id:
        try:
            logger.info(f"[WS] Loading dynamic tools for admin_id={admin_id}")
            composio_tools = _load_composio_tools(admin_id)
            if composio_tools:
                dynamic_tools = {t.name: t for t in composio_tools}
                logger.info(f"[WS] Found {len(composio_tools)} dynamic tools: {list(dynamic_tools.keys())}")
                for t in composio_tools:
                    decl = t._get_declaration()
                    if decl:
                        all_decls.append(decl)
            else:
                logger.warning(f"[WS] No dynamic tools loaded for admin_id={admin_id}")
        except Exception as exc:
            logger.exception(f"[WS] Failed to load dynamic tools: {exc}")

    # 3. Create a single Tool with the combined declarations
    # We use GoogleSearch() which is the standard for Gemini API grounding
    total_tools = [
        types.Tool(function_declarations=all_decls),
        types.Tool(google_search=types.GoogleSearch())
    ]
    logger.info(f"[WS] Configuration: tools={total_tools}")
    
    if not admin_id:
        # Prompt the model to explain why tools are restricted
        system_msg += "\n\nCRITICAL: The current session is NOT authenticated with an Admin ID. External tools (Gmail, Slack) and Data retrieval are restricted. Explain this to the user if they ask for these features."
        logger.warning(f"[WS] Starting session {session_id} WITHOUT admin_id. Tools available: {len(all_decls)}")
    else:
        logger.info(f"[WS] Starting session {session_id} with {len(all_decls)} tools for admin {admin_id}")

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=system_msg,
        tools=total_tools,
        output_audio_transcription=types.AudioTranscriptionConfig(),
        input_audio_transcription=types.AudioTranscriptionConfig(),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name="Charon"
                )
            )
        ),
        thinking_config=types.ThinkingConfig(thinking_level="minimal"),
    )

    try:
        async with _genai_client.aio.live.connect(
            model=GEMINI_MODEL, config=config
        ) as session:
            logger.info("[WS] Gemini Live session ready — waiting for user.")

            # ── Upstream: client → Gemini ─────────────────────────────
            _audio_chunk_count = 0

            async def client_to_gemini():
                nonlocal _audio_chunk_count
                try:

                    while True:
                        message = await ws.receive()

                        if "bytes" in message:
                            _audio_chunk_count += 1
                            if _audio_chunk_count <= 3 or _audio_chunk_count % 200 == 0:
                                logger.info(
                                    f"[WS] Received audio chunk #{_audio_chunk_count}: "
                                    f"{len(message['bytes'])} bytes"
                                )
                            # Binary frame = raw PCM audio
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=message["bytes"],
                                    mime_type=f"audio/pcm;rate={SEND_SAMPLE_RATE}",
                                )
                            )

                        elif "text" in message:
                            data = json.loads(message["text"])
                            if data.get("type") == "text":
                                logger.info(f"[WS] Received text: {data.get('data', '')[:80]}")
                                await session.send_realtime_input(
                                    text=data.get("data", "")
                                )

                except _WebSocketDisconnect:
                    logger.info(f"[WS] Client disconnected: {session_id}")
                except Exception as exc:
                    logger.error(f"[WS] upstream error: {exc}")

            # ── Downstream: Gemini → client ───────────────────────────
            async def gemini_to_client(admin_id: str | None = None):
                _event_count = 0
                try:
                    logger.info("[WS] gemini_to_client: starting receive loop")
                    while True:
                        async for response in session.receive():
                            _event_count += 1
                            if response is None:
                                continue

                            sc = getattr(response, "server_content", None)

                            # ── Audio + text parts ────────────────────────
                            if sc and sc.model_turn:
                                for part in (sc.model_turn.parts or []):
                                    # Audio bytes → base64 JSON
                                    if part.inline_data and part.inline_data.data:
                                        if _event_count <= 5 or _event_count % 50 == 0:
                                            logger.info(f"[WS] Sending audio to client: {len(part.inline_data.data)} bytes")
                                        await ws.send_json({
                                            "type": "audio",
                                            "data": base64.b64encode(
                                                part.inline_data.data
                                            ).decode(),
                                            "sampleRate": RECEIVE_SAMPLE_RATE,
                                        })
                                    # Inline text (rare with AUDIO modality)
                                    if part.text:
                                        logger.info(f"[WS] Text from model: {part.text[:100]}")
                                        await ws.send_json({
                                            "type": "text_out",
                                            "text": part.text,
                                        })
                                    
                                    # ── GROUNDING DEBUG ───────────────────────────
                                    # grounding_metadata is typically in server_content (sc)
                                    gm = getattr(sc, "grounding_metadata", None)
                                    if gm:
                                        logger.info(f"[WS] [GROUNDING] Grounding results found!")
                                        if getattr(gm, "search_entry_point", None):
                                            sep = gm.search_entry_point
                                            rendered = getattr(sep, "rendered_content", "")
                                            logger.info(f"[WS] [GROUNDING] Search entry point: {rendered[:100]}...")
                                        
                                        chunks = getattr(gm, "grounding_chunks", []) or []
                                        if chunks:
                                            logger.info(f"[WS] [GROUNDING] Found {len(chunks)} chunks from search.")
                                        
                                        supports = getattr(gm, "grounding_supports", []) or []
                                        if supports:
                                            logger.info(f"[WS] [GROUNDING] Found {len(supports)} supports/citations.")

                            if sc:
                                # Output transcription (assistant speech → text)
                                ot = getattr(sc, "output_transcription", None)
                                if ot and getattr(ot, "text", None):
                                    text = ot.text.strip()
                                    if text:
                                        logger.info(f"[WS] Transcript out: {text[:80]}")
                                        await ws.send_json({
                                            "type": "transcript_out",
                                            "text": text,
                                        })

                                # Input transcription (user speech → text)
                                it = getattr(sc, "input_transcription", None)
                                if it and getattr(it, "text", None):
                                    text = it.text.strip()
                                    if text:
                                        logger.info(f"[WS] Transcript in: {text[:80]}")
                                        await ws.send_json({
                                            "type": "transcript_in",
                                            "text": text,
                                        })

                                # Turn complete
                                if getattr(sc, "turn_complete", False):
                                    logger.info("[WS] Turn complete — waiting for next input")
                                    await ws.send_json({"type": "turn_complete"})

                            # ── Tool calls ────────────────────────────────
                            if response.tool_call:
                                await _handle_tool_call(session, response.tool_call, ws, dynamic_tools, admin_id=admin_id)

                        # If the generator finishes naturally, wait a bit and restart
                        # unless the session is closed.
                        await asyncio.sleep(0.1)

                except _WebSocketDisconnect:
                    logger.info("[WS] gemini_to_client: client disconnected")
                except Exception as exc:
                    logger.error(f"[WS] downstream error: {exc}")
                    traceback.print_exc()
                    try:
                        await ws.send_json({"type": "error", "message": str(exc)})
                    except Exception:
                        pass

            # Run both directions concurrently
            await asyncio.gather(client_to_gemini(), gemini_to_client(admin_id=admin_id))

    except _WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected: {session_id}")
    except Exception as exc:
        logger.error(f"[WS] Session error: {exc}")
        traceback.print_exc()

    logger.info(f"[WS] Session ended: {session_id}")


# ─────────────────────────────────────────────────────────────────────────────
# Tool call handler
# ─────────────────────────────────────────────────────────────────────────────

async def _handle_tool_call(session, tool_call, ws: _WebSocket, dynamic_tools: Dict[str, SanitizedTool] = None, admin_id: str | None = None) -> None:
    """Execute tool calls and send results back to Gemini."""
    if dynamic_tools is None:
        dynamic_tools = {}
        
    function_calls = getattr(tool_call, "function_calls", []) or []
    if not function_calls:
        return

    function_responses = []

    for fc in function_calls:
        call_id = getattr(fc, "id", "") or ""
        name = getattr(fc, "name", "") or ""
        args = dict(getattr(fc, "args", {}) or {})

        try:
            await ws.send_json({
                "type": "tool_thinking",
                "label": _thinking_label(name),
            })
        except Exception:
            pass

        logger.info(f"[Tool] {name} args={args}")

        func = TOOL_MAP.get(name)
        dtool = dynamic_tools.get(name)
        
        if func:
            try:
                result = await func(**args)
            except Exception as exc:
                logger.error(f"[Tool] {name} error: {exc}")
                result = _err(str(exc))
        elif dtool:
            try:
                logger.info(f"[Tool] Running dynamic {name}...")
                # Composio/ADK tools need a ToolContext
                # We provide a mock context that satisfies the constructor requirements
                tctx = get_mock_tool_context(admin_id=admin_id)
                raw_result = await dtool.run_async(args=args, tool_context=tctx)
                logger.info(f"[Tool] Dynamic {name} success!")
                # Wrap with explicit success metadata so the model doesn't 
                # misinterpret short responses (e.g. "ok") as failures
                result = json.dumps({
                    "success": True,
                    "action": name,
                    "message": f"{name} completed successfully.",
                    "raw_result": str(raw_result)[:500],
                }, ensure_ascii=False)
            except Exception as exc:
                logger.exception(f"[Tool] dynamic {name} error: {exc}")
                result = json.dumps({
                    "success": False,
                    "action": name,
                    "error": str(exc),
                }, ensure_ascii=False)
        else:
            logger.warning(f"[Tool] Unknown tool: {name}. Available dynamic tools: {list(dynamic_tools.keys())}")
            result = _err(f"Unknown tool: {name}")

        logger.info(f"[Tool] {name} → {len(result)} chars")

        # Relay dashboard ID to frontend
        result_str = str(result)
        if name in ("generate_dashboard", "build_and_save_dashboard") and "[dashboard_id:" in result_str:
            match = re.search(r"\[dashboard_id:([^\]]+)\](.*)", result_str)
            if match:
                try:
                    await ws.send_json({
                        "type": "dashboard_ready",
                        "id": match.group(1).strip(),
                        "title": match.group(2).strip(),
                    })
                except Exception:
                    pass

        function_responses.append(
            types.FunctionResponse(
                name=call_id,
                id=call_id,
                response={"output": result},
            )
        )

    await session.send_tool_response(function_responses=function_responses)

