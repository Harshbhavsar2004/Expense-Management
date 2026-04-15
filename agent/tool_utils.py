"""
Shared tool utilities for Fristine Infotech agents.
Provides SanitizedTool for Gemini compatibility and a dynamic Composio tool loader.
"""

from __future__ import annotations
import os
import traceback
from typing import Any, Dict, List, Optional
from typing_extensions import override

try:
    from google.adk.tools import BaseTool, ToolContext
    from google.genai import types
    from composio import Composio
    from composio_google_adk import GoogleAdkProvider
    ADK_AVAILABLE = True
except ImportError:
    ADK_AVAILABLE = False


class SanitizedTool(BaseTool):
    """
    Gemini doesn't support 'any_of' or 'additional_properties' in tool schemas.
    This wrapper strips unsupported fields from Composio/ADK tool declarations.
    """
    def __init__(self, original_tool: BaseTool):
        super().__init__(name=original_tool.name, description=original_tool.description)
        self._original = original_tool

    @override
    def _get_declaration(self) -> Optional[types.FunctionDeclaration]:
        if not hasattr(self._original, "_get_declaration"):
            return None
            
        decl = self._original._get_declaration()
        if decl and decl.parameters:
            decl_dict = decl.model_dump(exclude_none=True)
            self._sanitize_schema(decl_dict.get("parameters", {}))
            return types.FunctionDeclaration.model_validate(decl_dict)
        return decl

    def _sanitize_schema(self, schema: dict):
        if not isinstance(schema, dict):
            return
            
        # SLACK_SEND_MESSAGE specific: strip the noise to avoid Gemini confusion
        if self.name == "SLACK_SEND_MESSAGE":
            props = schema.get("properties", {})
            # Composio's Slack tool has 'text' as deprecated, 'markdown_text' as preferred.
            essentials = {"channel", "text", "markdown_text"}
            schema["properties"] = {k: v for k, v in props.items() if k in essentials}
            if "required" in schema:
                schema["required"] = [r for r in schema["required"] if r in essentials]

        # ZOHO_INVOICE tools: strip optional fields that cause API validation errors
        # when the LLM passes guessed/invalid values (website URL format, currency codes, etc.)
        if self.name.startswith("ZOHO_INVOICE_"):
            noisy = {"website", "currency_code", "payment_terms", "payment_terms_label", "notes"}
            props = schema.get("properties", {})
            schema["properties"] = {k: v for k, v in props.items() if k not in noisy}
            if "required" in schema:
                schema["required"] = [r for r in schema["required"] if r not in noisy]

        if "any_of" in schema:
            options = schema.pop("any_of")
            if options and isinstance(options, list):
                # Just take the first option
                schema.update(options[0])
                
        schema.pop("additional_properties", None)
        props = schema.get("properties", {})
        if isinstance(props, dict):
            for p in props.values():
                self._sanitize_schema(p)
        items = schema.get("items")
        if isinstance(items, dict):
            self._sanitize_schema(items)

    @override
    async def run_async(self, *, args: dict[str, Any], tool_context: ToolContext) -> Any:
        # Gemini sometimes passes "null" as a string for optional arguments
        # this causes SDK failures (e.g. SDKFileNotFoundError for attachments).
        # We filter out any such null-like values here.
        args = {
            k: v for k, v in args.items() 
            if v is not None and str(v).lower() not in ("null", "none")
        }

        print(f"[SanitizedTool] {self.name} run_async CALLED with args={args}")
        
        # The original tool may have mandatory arguments in its signature
        # that we've stripped from the schema for Gemini compatibility.
        if hasattr(self._original, "_get_mandatory_args"):
            mandatory = self._original._get_mandatory_args()
            for m in mandatory:
                if m not in args:
                    args[m] = None
        
        try:
            res = await self._original.run_async(args=args, tool_context=tool_context)
            print(f"[SanitizedTool] {self.name} run_async SUCCESS (len={len(str(res))})")
            return res
        except Exception as e:
            print(f"[SanitizedTool] {self.name} run_async ERROR: {e}")
            raise


def _load_composio_tools(admin_user_id: str) -> List[SanitizedTool]:
    """
    Load Composio tools for a specific admin.
    Returns a list of SanitizedTool objects.
    """
    if not ADK_AVAILABLE:
        print("[Composio] google.adk or composio not installed — skipping tool load")
        return []

    key = os.getenv("COMPOSIO_API_KEY", "")
    if not key or key == "your_composio_api_key":
        print("[Composio] COMPOSIO_API_KEY not set — skipping tool load")
        return []

    try:
        # Step 1: find which toolkits this admin has active connections for
        mgmt = Composio(api_key=key)
        response = mgmt.connected_accounts.list(user_ids=[admin_user_id])

        active_toolkits: List[str] = []
        for c in response.items:
            status = getattr(c, "status", "").upper()
            if status == "ACTIVE":
                tk = getattr(c, "toolkit", None)
                slug = getattr(tk, "slug", None) if tk else None
                if slug:
                    active_toolkits.append(slug.upper())

        if not active_toolkits:
            print(f"[Composio] No active toolkits for admin={admin_user_id}")
            return []

        composio = Composio(api_key=key, provider=GoogleAdkProvider())

        PRIORITY_TOOLS = [
            "GMAIL_SEND_EMAIL", "GMAIL_FETCH_EMAILS", "GMAIL_GET_PROFILE",
            "GMAIL_CREATE_EMAIL_DRAFT", "GMAIL_SEND_DRAFT", "GMAIL_REPLY_TO_THREAD",
            "SLACK_SEND_MESSAGE", "SLACK_LIST_CHANNELS", "SLACK_GET_CHANNEL_MESSAGES",
            "GOOGLESHEETS_CREATE_GOOGLE_SHEET", "GOOGLESHEETS_SHEET_FROM_JSON",
            "GOOGLECALENDAR_CREATE_EVENT", "GOOGLECALENDAR_LIST_EVENTS",
            "ZOHO_INVOICE_CREATE_INVOICE", "ZOHO_INVOICE_GET_INVOICE", "ZOHO_INVOICE_UPDATE_INVOICE",
            "ZOHO_INVOICE_LIST_INVOICES", "ZOHO_INVOICE_LIST_CONTACTS", "ZOHO_INVOICE_CREATE_CONTACT", "ZOHO_INVOICE_CREATE_ITEM"
        ]

        active_prefixes = tuple(tk.upper() + "_" for tk in active_toolkits)
        wanted_tools = [s for s in PRIORITY_TOOLS if s.startswith(active_prefixes)]
        
        print(f"[Composio] Wanted tools for {active_toolkits}: {wanted_tools}")

        if wanted_tools:
            tool_collection = composio.tools.get(user_id=admin_user_id, tools=wanted_tools)
        else:
            tool_collection = composio.tools.get(user_id=admin_user_id, toolkits=active_toolkits)

        tools = list(tool_collection) if hasattr(tool_collection, "__iter__") else []
        sanitized = [SanitizedTool(t) for t in tools]
        print(f"[Composio] Loaded {len(sanitized)} sanitized tools: {[t.name for t in sanitized]}")
        return sanitized

    except Exception as exc:
        print(f"[Composio] Failed to load tools for admin={admin_user_id}: {exc}")
        traceback.print_exc()
        return []
