"""
Fristine Infotech — Expense Agent Server
Port 8000
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import traceback
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import requests as _requests
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from google.adk.agents import LlmAgent
from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from composio import Composio
from composio_google_adk import GoogleAdkProvider

load_dotenv()

from vision_agent import vision_router, vision_agent
from input_refiner_agent import input_refiner_agent
from audit_agent import audit_agent
from chatbot_agent import chatbot_agent
from category_backend import category_backend_router

try:
    print("[Voice] Attempting to import voice_agent...", flush=True)
    import voice_agent as _voice_agent
    _voice_agent_available = True
    print("[Voice] voice_agent imported successfully.", flush=True)
except Exception as _voice_import_err:
    _voice_agent = None
    _voice_agent_available = False
    print(f"[Voice] Failed to load voice_agent: {_voice_import_err}", flush=True)
    traceback.print_exc()


# ─────────────────────────────────────────────────────────────────────────────
# COMPOSIO AUTH CONFIG MAP
# ─────────────────────────────────────────────────────────────────────────────

def _get_auth_configs() -> Dict[str, str]:
    """Load auth config IDs from environment variables."""
    mapping = {
        "gmail":          "COMPOSIO_GMAIL_AUTH_CONFIG",
        "slack":          "COMPOSIO_SLACK_AUTH_CONFIG",
        "googlecalendar": "COMPOSIO_CALENDAR_AUTH_CONFIG",
        "googlesheets":   "COMPOSIO_SHEETS_AUTH_CONFIG",
        "googledrive":    "COMPOSIO_DRIVE_AUTH_CONFIG",
        "notion":         "COMPOSIO_NOTION_AUTH_CONFIG",
        "hubspot":        "COMPOSIO_HUBSPOT_AUTH_CONFIG",
    }
    return {toolkit: os.getenv(env_key, "") for toolkit, env_key in mapping.items() if os.getenv(env_key, "")}


from tool_utils import SanitizedTool, _load_composio_tools


# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC ENTERPRISE AGENT BUILDER
# Called fresh per request so Composio tools are scoped to the requesting admin.
# ─────────────────────────────────────────────────────────────────────────────

def _build_enterprise_agent(admin_user_id: str) -> LlmAgent:
    """Build a fresh EnterpriseAgent with this admin's Composio tools."""
    from enterprise_agent import (
        enterprise_before_agent, enterprise_before_model, enterprise_after_model,
        resolve_user, get_user_stats, compare_two_users,
        semantic_search_expenses, get_applications, get_policies,
        set_policy_override, clear_policy_override, get_duplicate_receipts,
        get_mismatch_breakdown, search_expenses_by_amount, get_chat_history,
        get_users, get_flagged_expenses, get_expenses_detail,
        generate_dashboard, save_dashboard,
    )

    base_tools = [
        resolve_user, get_user_stats, compare_two_users,
        semantic_search_expenses, get_applications, get_policies,
        set_policy_override, clear_policy_override, get_duplicate_receipts,
        get_mismatch_breakdown, search_expenses_by_amount, get_chat_history,
        get_users, get_flagged_expenses, get_expenses_detail,
        generate_dashboard, save_dashboard,
    ]

    composio_tools = _load_composio_tools(admin_user_id) if admin_user_id else []

    return LlmAgent(
        name="EnterpriseAgent",
        model="gemini-2.5-flash",
        instruction="""
            You are the Enterprise Data Intelligence Agent for Fristine Infotech.
            Help admins and employees query expense data, user stats, policies,
            and audit findings. Follow RBAC rules strictly.
            Always resolve names to UUIDs before querying user-specific data.
            When Gmail or other external tools are available, use them when asked.
        """,
        tools=base_tools + composio_tools,
        before_agent_callback=enterprise_before_agent,
        before_model_callback=enterprise_before_model,
        after_model_callback=enterprise_after_model,
    )


# ─────────────────────────────────────────────────────────────────────────────
# STATIC AGENT WRAPPERS
# ─────────────────────────────────────────────────────────────────────────────

adk_refiner_agent = ADKAgent(
    adk_agent=input_refiner_agent,
    user_id="refiner_user",
    session_timeout_seconds=300,
    use_in_memory_services=True,
)

adk_audit_agent = ADKAgent(
    adk_agent=audit_agent,
    user_id="audit_user",
    session_timeout_seconds=3600,
    use_in_memory_services=True,
)

adk_vision_agent = ADKAgent(
    adk_agent=vision_agent,
    user_id="vision_user",
    session_timeout_seconds=3600,
    use_in_memory_services=True,
)

adk_chatbot_agent = ADKAgent(
    adk_agent=chatbot_agent,
    user_id="chatbot_user",
    session_timeout_seconds=3600,
    use_in_memory_services=True,
)


# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    from embedding_service import embed_all_existing_expenses, embed_all_existing_receipts

    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    anon_key     = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")

    if not supabase_url or not anon_key:
        print("[Startup] Supabase env vars missing — skipping embedding backfill.")
    else:
        def _count_null(table: str) -> int:
            try:
                r = _requests.get(
                    f"{supabase_url}/rest/v1/{table}",
                    headers={"apikey": anon_key, "Authorization": f"Bearer {anon_key}", "Prefer": "count=exact"},
                    params={"select": "id", "embedding": "is.null", "limit": "1"},
                    timeout=10,
                )
                cr = r.headers.get("Content-Range", "")
                return int(cr.split("/")[-1]) if "/" in cr else 0
            except Exception as exc:
                print(f"[Startup] Count check for {table} failed: {exc}")
                return 0

        exp_null = _count_null("expenses")
        rec_null = _count_null("receipts")

        async def run_backfill():
            if exp_null > 0:
                print(f"[Startup] {exp_null} expenses missing embeddings — backfilling.")
                await embed_all_existing_expenses()
            else:
                print("[Startup] All expenses already embedded.")
            if rec_null > 0:
                print(f"[Startup] {rec_null} receipts missing embeddings — backfilling.")
                await embed_all_existing_receipts()
            else:
                print("[Startup] All receipts already embedded.")

        if exp_null > 0 or rec_null > 0:
            asyncio.create_task(run_backfill())
        else:
            print("[Startup] All embeddings up to date — skipping backfill.")

    yield


app = FastAPI(title="Fristine Infotech — Expense Agent Server", lifespan=lifespan)


# ─────────────────────────────────────────────────────────────────────────────
# AGENT ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

print("[Main] Including vision_router...", flush=True)
app.include_router(vision_router)
print("[Main] ✓ vision_router included", flush=True)

print("[Main] Including category_backend_router...", flush=True)
app.include_router(category_backend_router)
print("[Main] ✓ category_backend_router included", flush=True)

add_adk_fastapi_endpoint(app, adk_refiner_agent,  path="/refine/")
add_adk_fastapi_endpoint(app, adk_audit_agent,    path="/audit/")
add_adk_fastapi_endpoint(app, adk_chatbot_agent,  path="/chatbot_agent/")
add_adk_fastapi_endpoint(app, adk_vision_agent,   path="/vision-agent/")

if _voice_agent_available:
    print("[Main] Mounting voice_agent.app at /voice...", flush=True)
    app.mount("/voice", _voice_agent.app)
    print("[Main] ✓ voice_agent.app mounted", flush=True)

# CORS must be added AFTER add_adk_fastapi_endpoint calls so it becomes the
# outermost middleware layer and handles OPTIONS preflight before any inner
# middleware or route sees it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────
# DEBUG: Print all registered routes
# ─────────────────────────────────────────────────────────────────────────
print("\n[Main] ═════════════════════════════════════════ REGISTERED ROUTES ═════════════════════════════════════════", flush=True)
for route in app.routes:
    if hasattr(route, "path"):
        methods = getattr(route, "methods", ["*"])
        print(f"[Main]   {str(methods):20} {route.path}", flush=True)
print("[Main] ═════════════════════════════════════════════════════════════════════════════════════════════════════\n", flush=True)


@app.post("/enterprise_agent/")
async def enterprise_agent_endpoint(request: Request):
    """
    Dynamic enterprise agent endpoint.
    Builds a fresh agent per request with this admin's Composio tools.
    Uses ag_ui_adk's RunAgentInput + EventEncoder pattern (same as add_adk_fastapi_endpoint).
    """
    body = await request.json()

    # ── Extract admin_user_id ─────────────────────────────────────────────────
    admin_user_id: Optional[str] = None

    # Source 1: state field (sent by enterprise-chat/route.ts)
    state = body.get("state") or {}
    if isinstance(state, dict):
        admin_user_id = state.get("admin_user_id") or state.get("user_id")

    # Source 2: [admin_id:uuid] tag embedded in message content
    if not admin_user_id:
        for msg in body.get("messages", []):
            content = msg.get("content", "")
            if "[admin_id:" in content:
                try:
                    start = content.index("[admin_id:") + len("[admin_id:")
                    end   = content.index("]", start)
                    admin_user_id = content[start:end].strip()
                    break
                except (ValueError, IndexError):
                    pass

    print(f"[Enterprise] admin_user_id={admin_user_id}")

    # ── Build fresh agent with this admin's tools ─────────────────────────────
    agent = _build_enterprise_agent(admin_user_id or "")

    # ── Wrap in ADKAgent and run ──────────────────────────────────────────────
    adk_agent = ADKAgent(
        adk_agent=agent,
        user_id=admin_user_id or "enterprise_user",
        session_timeout_seconds=3600,
        use_in_memory_services=True,
    )

    # Use ag_ui_adk's own RunAgentInput + EventEncoder — same path as add_adk_fastapi_endpoint
    try:
        from ag_ui.core import RunAgentInput
        from ag_ui.encoder import EventEncoder
    except ImportError:
        return JSONResponse({"error": "ag_ui package not installed"}, status_code=500)

    try:
        input_data = RunAgentInput(**body)
    except Exception as exc:
        return JSONResponse({"error": f"Invalid request body: {exc}"}, status_code=400)

    accept = request.headers.get("accept", "")
    encoder = EventEncoder(accept=accept)

    async def event_stream():
        try:
            async for event in adk_agent.run(input_data):
                yield encoder.encode(event)
        except Exception as exc:
            print(f"[Enterprise] Streaming error: {exc}")
            traceback.print_exc()

    return StreamingResponse(event_stream(), media_type=encoder.get_content_type())


# ─────────────────────────────────────────────────────────────────────────────
# LOGGING MIDDLEWARE
# ─────────────────────────────────────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[Server] {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"[Server] -> {response.status_code}")
    return response


# ─────────────────────────────────────────────────────────────────────────────
# VOICE ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

# voice_agent is now mounted at /voice. WebSocket: /voice/ws/{session_id}


# ─────────────────────────────────────────────────────────────────────────────
# EMBEDDING BACKFILL
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/admin/backfill-embeddings")
async def backfill_embeddings():
    from embedding_service import embed_all_existing_expenses, embed_all_existing_receipts
    exp_count = await embed_all_existing_expenses()
    rec_count = await embed_all_existing_receipts()
    return JSONResponse({"embedded_expenses": exp_count, "embedded_receipts": rec_count})


# ─────────────────────────────────────────────────────────────────────────────
# COMPOSIO CONNECTOR ENDPOINTS
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/connectors/connect/{toolkit_name}")
async def connect_toolkit(toolkit_name: str, admin_id: str):
    """Start OAuth flow. Returns redirect_url — frontend opens in popup."""
    key = os.getenv("COMPOSIO_API_KEY")
    if not key:
        return JSONResponse({"error": "COMPOSIO_API_KEY not set"}, status_code=500)

    auth_config_id = _get_auth_configs().get(toolkit_name.lower())
    if not auth_config_id:
        return JSONResponse(
            {"error": f"No auth config for '{toolkit_name}'. Add COMPOSIO_{toolkit_name.upper()}_AUTH_CONFIG to agent/.env."},
            status_code=400,
        )

    redirect_url = os.getenv("COMPOSIO_REDIRECT_URL", "http://localhost:3000/admin/connectors?connected=true")

    try:
        composio = Composio(api_key=key)
        connection_request = composio.connected_accounts.link(
            user_id=admin_id,
            auth_config_id=auth_config_id,
            callback_url=redirect_url,
        )
        print(f"[Composio] OAuth URL generated for toolkit={toolkit_name} admin={admin_id}")
        return {"connection_url": connection_request.redirect_url, "connection_id": connection_request.id}
    except Exception as exc:
        print(f"[Composio] connect error toolkit={toolkit_name} admin={admin_id}: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.get("/connectors/status/{admin_id}")
async def get_connectors_status(admin_id: str):
    """Returns all toolkit connections for this admin."""
    key = os.getenv("COMPOSIO_API_KEY")
    if not key:
        return {"connections": [], "connected_toolkits": []}

    try:
        composio = Composio(api_key=key)
        response = composio.connected_accounts.list(user_ids=[admin_id])

        connections = []
        for c in response.items:
            tk = getattr(c, "toolkit", None)
            slug = getattr(tk, "slug", None) if tk else None
            if slug:
                connections.append({
                    "toolkit": slug.lower(),
                    "status":  getattr(c, "status", "UNKNOWN").upper(),
                    "id":      getattr(c, "id", None),
                })

        active = [c["toolkit"] for c in connections if c["status"] == "ACTIVE"]
        print(f"[Composio] status admin={admin_id}: {active}")
        return {"connections": connections, "connected_toolkits": active}

    except Exception as exc:
        print(f"[Composio] status error admin={admin_id}: {exc}")
        return {"connections": [], "connected_toolkits": []}


@app.delete("/connectors/disconnect/{toolkit_name}")
async def disconnect_toolkit(toolkit_name: str, admin_id: str):
    """Removes a toolkit connection for this admin."""
    key = os.getenv("COMPOSIO_API_KEY")
    if not key:
        return JSONResponse({"error": "COMPOSIO_API_KEY not set"}, status_code=500)

    try:
        composio = Composio(api_key=key)
        response = composio.connected_accounts.list(user_ids=[admin_id])

        for c in response.items:
            tk = getattr(c, "toolkit", None)
            slug = getattr(tk, "slug", None) if tk else None
            if slug and slug.lower() == toolkit_name.lower():
                conn_id = getattr(c, "id", None)
                if conn_id:
                    composio.connected_accounts.delete(connected_account_id=conn_id)
                    print(f"[Composio] Disconnected toolkit={toolkit_name} admin={admin_id}")
                    return {"success": True}

        return JSONResponse({"error": f"{toolkit_name} not connected"}, status_code=404)

    except Exception as exc:
        print(f"[Composio] disconnect error toolkit={toolkit_name} admin={admin_id}: {exc}")
        return JSONResponse({"error": str(exc)}, status_code=500)


# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    """Root endpoint for quick debugging."""
    return {
        "status": "running",
        "message": "Fristine Infotech Expense Agent Server",
        "port": 8000,
        "check_health": "GET /health",
        "check_vision": "GET /vision/health",
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "message": "Fristine Infotech Expense Agent Server is healthy",
        "composio": {
            "configured": bool(os.getenv("COMPOSIO_API_KEY")),
            "auth_configs_loaded": list(_get_auth_configs().keys()),
        },
        "agents": {
            "refiner":    "InputRefinerAgent @ POST /refine/",
            "audit":      "AuditAgent        @ POST /audit/",
            "chatbot":    "ChatbotAgent      @ POST /chatbot_agent/",
            "vision":     "VisionAgent       @ POST /vision/analyse (direct REST API)",
            "vision_adk": "VisionAgent (ADK) @ POST /vision-agent/",
            "enterprise": "EnterpriseAgent   @ POST /enterprise_agent/",
        },
        "vision_endpoints": {
            "health": "GET /vision/health",
            "analyze_receipt": "POST /vision/analyse (mode=receipt)",
            "analyze_image": "POST /vision/analyse (mode=general)",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    if not os.getenv("GOOGLE_API_KEY"):
        print("Warning: GOOGLE_API_KEY not set!")
    if not os.getenv("COMPOSIO_API_KEY"):
        print("Warning: COMPOSIO_API_KEY not set — connector endpoints will not work!")
    port = int(os.getenv("PORT", 8000))
    print(f"Starting Fristine Agent Server on port {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)