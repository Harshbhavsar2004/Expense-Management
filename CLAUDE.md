# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Start both Next.js (port 3000) and FastAPI agent (port 8000) concurrently
npm run dev:ui       # Next.js only (Turbopack)
npm run dev:agent    # FastAPI agent server only
npm run dev:debug    # Same as dev but with LOG_LEVEL=debug (Windows syntax)
```

### Build & Quality
```bash
npm run build        # Production Next.js build
npm run lint         # ESLint validation
```

### Agent Setup
```bash
npm run install:agent   # Create Python venv and install dependencies via uv (auto-runs on npm install)
# Internally runs: cd agent && uv sync  (uses uv sync, not uv install/pip)
```

### Database Utilities
```bash
npm run migrate:phones    # Sync phone numbers from WhatsApp to users table
npm run verify:migration  # Verify phone number migration
```

### Running the Agent Directly
```bash
cd agent
uv run uvicorn main:app --reload --port 8000
```

## Architecture Overview

This is a full-stack AI-powered expense management platform with two portals (admin and employee) and a multi-agent Python backend.

### Stack
- **Frontend**: Next.js 16 (App Router, Turbopack), HeroUI, Tailwind CSS 4, Recharts, CopilotKit
- **Backend Agents**: FastAPI (Python 3.12+), Google Gemini (2.5-Flash main, 3.1-Flash-Live for voice), Google ADK
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Integrations**: Cashfree (payouts), Composio (Gmail/Slack/Google Workspace), WhatsApp webhooks, Rive animations
- **Python package manager**: `uv` (not pip or poetry)

### Frontend Structure (`src/`)

Route groups define the two portals:
- `src/app/(authenticated)/(admin)/admin/*` — Admin pages: approvals, employees, expenses, insights, payouts, policy, reports, connectors, dashboards
- `src/app/(authenticated)/(employee)/*` — Employee pages: expenses, applications, payouts, policy, chat

API routes at `src/app/api/` proxy requests to the FastAPI agent or handle Supabase directly. Key routes:
- `/api/audit/expense/[id]` — Trigger policy audit for an expense
- `/api/enterprise-chat` — Admin AI chat (calls agent)
- `/api/vision/analyse` — Receipt OCR via Gemini Vision
- `/api/voice/stream` — WebSocket for real-time voice
- `/api/whatsapp` — WhatsApp webhook receiver
- `/api/cashfree/*` — Payout operations
- `/api/copilotkit` — CopilotKit runtime

### Agent Directory (`agent/`)

Each file is a focused agent/service:

| File | Role |
|------|------|
| `main.py` | FastAPI app; mounts ADK agents; builds enterprise agent dynamically per request |
| `audit_agent.py` | 9-rule policy compliance engine; pre-flight checks (UTR dedup, date validation) before LLM call |
| `vision_agent.py` | Receipt OCR — calls Gemini Vision directly (not ADK, due to multimodal constraint) |
| `chatbot_agent.py` | Employee Q&A chatbot; reads `knowledgebase.md` as context |
| `enterprise_agent.py` | Admin intelligence agent; cross-table queries, RBAC-aware, semantic search |
| `voice_agent.py` | Real-time voice via Pipecat + Gemini Live; WebRTC; 16kHz in / 24kHz out |
| `input_refiner_agent.py` | Normalizes free-text input (dates like "today" → ISO, amounts like "1.5k" → 1500) |
| `embedding_service.py` | Generates 768-dim Gemini embeddings; writes to Supabase for similarity search |
| `category_backend.py` | Rule-based + LLM expense categorization (6 primary categories; meal sub-categories by time-of-day) |
| `tool_utils.py` | `SanitizedTool` wrapper strips incompatible schema fields for Gemini; Composio tool loader |

### Data Flow

```
Receipt upload → Vision Agent (Gemini Vision) → extract fields
→ Category Agent → predict category
→ Save to Supabase (expenses, receipts tables)
→ Audit Agent → 9-rule check → audit_results table
→ Embedding Service → semantic vector → expenses.embedding column
```

Admin AI chat queries the Enterprise Agent which has Composio tools (Gmail, Slack, Google Sheets) plus direct Supabase access.

### Database Schema (Core Tables)

```
users               — id, email, full_name, phone, role
applications        — travel applications (city, city_tier, status)
expenses            — id, user_id, amount, category, status, embedding
receipts            — id, expense_id, utr_number, merchant, date, image_url
audit_results       — expense_id, verdict, mismatches, explanation
policies            — category, limit, description
policy_overrides    — user-specific policy overrides (admin-set)
composio_connectors — per-user integration connections
payouts             — expense_id, transfer_id, cashfree status
dashboards          — user-saved AI-generated chart specs
chat_messages       — session-based chat history
```

Run migrations manually in the Supabase SQL Editor in this order:
1. `supabase_setup.sql` — core tables (mandatory)
2. `supabase_policies_migration.sql` — RLS policies (mandatory)
3. `supabase_audit_functions_migration.sql` — audit logic (mandatory)
4. `supabase_cashfree_migration.sql` — payouts (if using Cashfree)
5. `supabase_composio_connectors_migration.sql` — integrations (if using Composio)
6. `supabase_phone_migration.sql` — WhatsApp (if using WhatsApp)
7. `supabase_policy_overrides_migration.sql`, `supabase_dashboards_table.sql`, `supabase_source_column_migration.sql` — optional features

### Environment Variables

**Root `.env`** (frontend + API routes):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
AGENT_URL=http://localhost:8000
GOOGLE_API_KEY
WHATSAPP_ACCESS_TOKEN
CASHFREE_CLIENT_ID
CASHFREE_CLIENT_SECRET
```

**`agent/.env`** (FastAPI backend):
```
GOOGLE_API_KEY
COMPOSIO_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PYTHONIOENCODING=utf-8          # Required on Windows to avoid encoding errors
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_API_VERSION=v22.0
WHATSAPP_VERIFY_TOKEN
CASHFREE_CLIENT_ID
CASHFREE_CLIENT_SECRET
CASHFREE_ENV=sandbox            # or "production"
CASHFREE_PAYOUT_BASE_URL        # sandbox: https://payout-gamma.cashfree.com
```

Composio auth configs (one per toolkit, only needed for connected integrations):
```
COMPOSIO_GMAIL_AUTH_CONFIG
COMPOSIO_SLACK_AUTH_CONFIG
COMPOSIO_CALENDAR_AUTH_CONFIG
COMPOSIO_SHEETS_AUTH_CONFIG
COMPOSIO_DRIVE_AUTH_CONFIG
COMPOSIO_NOTION_AUTH_CONFIG
COMPOSIO_HUBSPOT_AUTH_CONFIG
COMPOSIO_ZOHO_INVOICE_AUTH_CONFIG
```

### Key Architectural Notes

- **Gemini tool compatibility**: Gemini rejects `anyOf` and `additionalProperties` in tool schemas. `SanitizedTool` in `tool_utils.py` strips these before passing Composio tools to the LLM. Apply this wrapper for any new Composio or external tool integrations.
- **Enterprise agent is built per-request** in `main.py` so it can inject the authenticated user's Composio connection ID dynamically.
- **Voice agent import is optional** — `main.py` catches `ImportError` for `voice_agent` so the server starts even if Pipecat is unavailable.
- **RBAC is enforced in the enterprise agent**: admins see all users' data; employees only see their own. This logic lives in `enterprise_agent.py`, not at the database layer for agent queries.
- **TypeScript path alias**: `@/*` maps to `./src/*`.
- **`next.config.ts`** marks `@copilotkit/runtime` as a server-only external package.
- **CopilotKit agent switching**: The root layout defaults to `agent="chatbot_agent"` (employee chatbot). Admin insight pages override this to `agent="enterprise_agent"`. When adding new AI-powered pages, set the `agent` prop on `CopilotKit` accordingly.
- **UI components**: Both HeroUI (`@heroui/react`) and shadcn (`radix-ui`) coexist. HeroUI is primary for layout/tables; shadcn components live in `src/components/ui/`. Use Tabler Icons (`@tabler/icons-react`) for iconography.
- **No test suite**: There are no test files or test framework configured in this project.
