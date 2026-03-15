"""
Fristine Infotech — Expense Agent Server
Port 8000 — Three agents:
  POST /            ProverbsAgent     (general assistant)
  POST /vision/analyse  VisionAgent   (receipt & image analysis)
  POST /refine/     InputRefinerAgent (date & amount normalisation)
  GET  /health      health check
"""

from __future__ import annotations

import json
import sys
from typing import Dict, Optional

from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from google.adk.agents import LlmAgent
from google.adk.agents.callback_context import CallbackContext
from google.adk.models.llm_request import LlmRequest
from google.adk.models.llm_response import LlmResponse
from google.adk.tools import ToolContext
from google.genai import types
from pydantic import BaseModel, Field

from vision_agent import vision_router, vision_agent
from input_refiner_agent import input_refiner_agent
from audit_agent import audit_agent

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()


# Agents are imported from separate files

# ─────────────────────────────────────────────────────────────────────────────
# WRAP ALL AGENTS
# ─────────────────────────────────────────────────────────────────────────────

# Wrapper definitions

adk_refiner_agent = ADKAgent(
    adk_agent=input_refiner_agent,
    user_id="refiner_user",
    session_timeout_seconds=300,   # Short — refine calls are stateless
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

# ─────────────────────────────────────────────────────────────────────────────
# FASTAPI APP
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Fristine Infotech — Expense Agent Server")

# Agent endpoints (ADK)

# Agent 2: Vision — plain REST (bypasses ag_ui_adk multimodal limitation)
app.include_router(vision_router)

# Agent 3: Input refiner
add_adk_fastapi_endpoint(app, adk_refiner_agent, path="/refine/")

# Agent 4: Audit agent
add_adk_fastapi_endpoint(app, adk_audit_agent, path="/audit/")

# Agent 5: Vision agent (ADK version)
add_adk_fastapi_endpoint(app, adk_vision_agent, path="/vision-agent/")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"[Server] {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"[Server] -> {response.status_code}")
    return response


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agents": {
            "vision":  "VisionAgent       @ POST /vision/analyse",
            "refiner": "InputRefinerAgent @ POST /refine/",
            "audit":   "AuditAgent        @ POST /audit/",
            "vision_adk": "VisionAgent     @ POST /vision-agent/",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# ENTRYPOINT
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    import uvicorn

    if not os.getenv("GOOGLE_API_KEY"):
        print("Warning: GOOGLE_API_KEY not set!")

    port = int(os.getenv("PORT", 8000))
    print(f"Starting Fristine Agent Server on port {port}")
    print(f"  Agent 2 (Vision)  -> POST http://localhost:{port}/vision/analyse")
    print(f"  Agent 3 (Refiner) -> POST http://localhost:{port}/refine/")
    print(f"  Agent 4 (Audit)   -> POST http://localhost:{port}/audit/")
    print(f"  Health            -> GET  http://localhost:{port}/health")
    uvicorn.run(app, host="0.0.0.0", port=port)
