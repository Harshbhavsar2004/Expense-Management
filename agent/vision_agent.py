"""
Vision Agent - Receipt & Image Analysis
Standalone Gemini Vision agent called directly via REST API from route.ts.

WHY DIRECT API CALL INSTEAD OF AG-UI:
The current released version of ag_ui_adk does NOT support multimodal messages
(images as inline_data). Multimodal support is an open proposal (GitHub Issue #847)
and is available only in an unmerged fork. Until it lands in the official package,
we call the Gemini REST API directly from route.ts and return structured JSON.

This file defines the prompt, schema, and response parser used by route.ts.
It also exports a FastAPI router so it can be mounted on the same app at /vision/
for health checks and future use once ag_ui_adk supports multimodal.
"""

from __future__ import annotations

import base64
import json
import os
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from google.adk.agents import LlmAgent

# -----------------------------------------------------------------------------
# RECEIPT EXTRACTION PROMPT
# Used by route.ts when calling Gemini Vision directly
# -----------------------------------------------------------------------------

RECEIPT_EXTRACTION_PROMPT = """You are a specialized payment receipt extraction agent for Fristine Infotech's expense management system.

Your ONLY job is to extract structured data from UPI payment screenshots, bank receipts, payment confirmations, or invoices.

Analyse this image carefully and return ONLY a valid JSON object with NO markdown fences, NO explanation, NO extra text.

JSON format (return exactly this structure):
{
  "amount": "exact amount with currency symbol if visible, e.g. Rs.1500.00 - null if not found",
  "utrNumber": "UTR or UPI reference number if present (typically 12-22 digits) - null if not found",
  "transactionId": "transaction ID or reference number if present - null if not found",
  "paymentMethod": "one of: UPI / Net Banking / Credit Card / Debit Card / Cash / Unknown",
  "merchant": "merchant or recipient name if visible - null if not found",
  "date": "transaction date in DD MMM YYYY format if visible - null if not found",
  "time": "Transaction time in HH:MM AM/PM format (MANDATORY if visible) - null if not found",
  "status": "one of: SUCCESS / FAILED / PENDING / UNKNOWN",
  "rawDescription": "1-2 sentence plain English summary of what this receipt shows"
}

EXTRACTION GUIDELINES:
- DATE: Extract even from small font. Look for "on", "dated", or just numbers.
- TIME: Look for formats like 10:30 AM, 22:15, 08:30 PM. Convert to HH:MM AM/PM. CRITICAL: For PhonePe/GPay screenshots, often the time is in the top notification bar or in the transaction footer. Look carefully.
- MERCHANT: Look for "Paid to", "Recipient", or the largest bold text at top.
- CATEGORY: Based on merchant name, if it says 'Tours', 'Travels', 'Taxi' -> Travel. If 'Hotel', 'In', 'Stay' -> Hotel.

STATUS DETECTION RULES:
- Words like SUCCESS, SUCCESSFUL, PAID, APPROVED, COMPLETED, DEBITED -> "SUCCESS"
- Words like FAILED, DECLINED, REJECTED -> "FAILED"
- Words like PENDING, PROCESSING, INITIATED -> "PENDING"
- If unclear -> "UNKNOWN"

Return ONLY the JSON object. No markdown. No explanation."""

GENERAL_IMAGE_PROMPT = """Describe this image in detail. Include:
1. What is shown in the image
2. Any important text, numbers, or data visible
3. Any relevant context or information the user should know

Be concise and helpful."""


# -----------------------------------------------------------------------------
# GEMINI VISION CALLER - used directly by route.ts via HTTP POST to /vision/analyse
# -----------------------------------------------------------------------------

async def call_gemini_vision(
    base64_data: str,
    mime_type: str,
    prompt: str,
    expect_json: bool = False,
) -> str:
    """Call Gemini Vision API directly with base64 image data."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not set")

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inline_data": {
                            "mime_type": mime_type,
                            "data": base64_data,
                        }
                    },
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "topP": 0.8,
        },
    }

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        data = response.json()

    raw_text: str = data["candidates"][0]["content"]["parts"][0]["text"]

    if expect_json:
        # Strip accidental markdown fences
        clean = raw_text.strip()
        if clean.startswith("```"):
            clean = clean.split("```")[1]
            if clean.startswith("json"):
                clean = clean[4:]
        clean = clean.strip().rstrip("```").strip()
        return clean

    return raw_text


# -----------------------------------------------------------------------------
# FASTAPI ROUTER - mounted at /vision/ in main.py
# route.ts calls POST /vision/analyse with the image
# -----------------------------------------------------------------------------

vision_router = APIRouter(prefix="/vision")


@vision_router.get("/health")
async def vision_health():
    """Health check for vision agent."""
    return {"status": "ok", "agent": "VisionAgent", "mode": "direct_gemini_api"}


@vision_router.post("/analyse")
async def analyse_image(request: Request) -> JSONResponse:
    """
    Analyse an image using Gemini Vision.

    Expected request body:
    {
        "base64": "...",           // base64-encoded image
        "mimeType": "image/jpeg",  // MIME type
        "mode": "receipt" | "general",  // analysis mode
        "caption": "optional user caption"
    }

    Returns:
    {
        "success": true,
        "mode": "receipt",
        "data": { ... }   // structured receipt data or description string
    }
    """
    try:
        body = await request.json()
        b64 = body.get("base64")
        mime_type = body.get("mimeType", "image/jpeg")
        mode = body.get("mode", "receipt")
        caption = body.get("caption", "")

        if not b64:
            return JSONResponse({"success": False, "error": "Missing base64 field"}, status_code=400)

        print(f"[VisionAgent] Analysing image - mode={mode}, mimeType={mime_type}")

        if mode == "receipt":
            prompt = RECEIPT_EXTRACTION_PROMPT
            raw = await call_gemini_vision(b64, mime_type, prompt, expect_json=True)

            # Safe print to avoid UnicodeEncodeError on Windows
            print(f"[VisionAgent] Gemini raw output: {raw.encode('ascii', 'ignore').decode('ascii')[:500]}...")

            try:
                parsed = json.loads(raw)
                
                # Ensure all keys exist to prevent frontend errors
                defaults = {
                    "amount": None,
                    "utrNumber": None,
                    "transactionId": None,
                    "paymentMethod": "Unknown",
                    "merchant": None,
                    "date": None,
                    "time": None,
                    "status": "UNKNOWN",
                    "rawDescription": ""
                }
                defaults.update(parsed)
                
                print(f"[VisionAgent] Extracted receipt (truncated): {json.dumps(defaults)[:500]}")
                return JSONResponse({
                    "success": True,
                    "mode": "receipt",
                    "data": defaults,
                })
            except json.JSONDecodeError as e:
                print(f"[VisionAgent] JSON parse failed: {e}. Raw (clean): {raw.encode('ascii', 'ignore').decode('ascii')[:500]}")
                return JSONResponse({
                    "success": True,
                    "mode": "receipt",
                    "data": {
                        "amount": None,
                        "utrNumber": None,
                        "transactionId": None,
                        "paymentMethod": "Unknown",
                        "merchant": None,
                        "date": None,
                        "time": None,
                        "status": "UNKNOWN",
                        "rawDescription": raw[:500],  # Return raw text as description
                    },
                })

        else:  # general image
            prompt = (
                f'The user sent this image with caption: "{caption}". {GENERAL_IMAGE_PROMPT}'
                if caption
                else GENERAL_IMAGE_PROMPT
            )
            description = await call_gemini_vision(b64, mime_type, prompt, expect_json=False)
            print(f"[VisionAgent] General image description: {description[:100]}...")
            return JSONResponse({
                "success": True,
                "mode": "general",
                "data": {"description": description},
            })

    except httpx.HTTPStatusError as e:
        print(f"[VisionAgent] Gemini API error: {e.response.status_code} {e.response.text}")
        return JSONResponse(
            {"success": False, "error": f"Gemini API error: {e.response.status_code}"},
            status_code=500,
        )
    except Exception as e:
        print(f"[VisionAgent] Unexpected error: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


# -----------------------------------------------------------------------------
# ADK AGENT DEFINITION
# -----------------------------------------------------------------------------

vision_agent = LlmAgent(
    name="VisionAgent",
    model="gemini-2.0-flash", # Use standard model for ADK compatibility
    instruction="""You are the Vision Analysis Agent. 
    You help users analyse receipts, invoices, and other images related to expenses.
    While multimodal support is limited in the chat UI, you can discuss previously analysed images 
    or guide users on how to capture better receipt photos.""",
)