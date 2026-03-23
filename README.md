# Expense Tracker & Admin AI Bot

A cutting-edge, AI-powered expense management system designed for modern enterprises. This project integrates multiple specialized AI agents (Voice, Audit, Vision, and Enterprise Intelligence) to streamline financial workflows, ensure policy compliance, and provide deep data insights.

## 🌟 Features

- **Voice Agent**: Natural language voice interaction for hands-free expense querying and management.
- **Enterprise Intelligence**: Query complex data across your organization using Gemini 2.0 Flash.
- **Audit Agent**: Automatically audit every expense against company policies to prevent fraud and errors.
- **Vision Agent (OCR)**: Instantly extract structured data from receipts and invoices using AI-driven vision.
- **External Integrations**: Seamlessly connect with Gmail, Slack, Google Sheets, and more via Composio.
- **WhatsApp Integration**: Submit and track expenses directly from WhatsApp.
- **Automated Payouts**: Integrated with Cashfree for seamless expense reimbursements.

---

## 🛠 Tech Stack

### Frontend
- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router, Turbopack)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **AI UI**: [CopilotKit](https://www.copilotkit.ai/) (AI-powered text-areas and sidebars)
- **Charts**: [Recharts](https://recharts.org/) for interactive dashboards
- **State Management**: React 19 Hooks & Supabase Auth

### Backend (AI Agent Server)
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12+)
- **AI Models**: Google Gemini 2.0 Flash / 2.5 Flash
- **Tools & Connectors**: [Composio](https://composio.ai/) (Gmail, Slack, etc.)
- **Voice Stack**: [Pipecat](https://www.pipecat.ai/) for real-time voice processing
- **Package Manager**: [uv](https://github.com/astral-sh/uv) (Fast Python package manager)

### Database & Auth
- **Provider**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions)

---

## 🚀 Step-by-Step Setup

Follow these steps to get the project running on your local machine.

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Python** (3.12 or higher)
- **uv** (Highly recommended): Install via `pip install uv`
- **Supabase Account**: Create a project at [supabase.com](https://supabase.com/)

### 2. Environment Configuration
You need to set up two environment files:

#### Root `.env` (Frontend)
Create a `.env` file in the root directory and add the following keys:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Agent API
AGENT_URL=http://localhost:8000

# AI Keys
GOOGLE_API_KEY=your_gemini_api_key

# Integrations (Optional)
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
CASHFREE_CLIENT_ID=your_cashfree_id
CASHFREE_CLIENT_SECRET=your_cashfree_secret
```
*(Reference: see `.env.example` in root)*

#### Agent `.env` (`agent/.env`)
Navigate to the `agent` folder and create a `.env` file:
```env
GOOGLE_API_KEY=your_gemini_api_key
COMPOSIO_API_KEY=your_composio_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Payouts
CASHFREE_CLIENT_ID=your_cashfree_id
CASHFREE_CLIENT_SECRET=your_cashfree_secret
```
*(Reference: see `agent/.env.example`)*

### 3. Installation
From the **root directory**, run:
```bash
npm install
```
> [!NOTE]
> This command will install frontend dependencies AND automatically trigger `npm run install:agent`, which sets up the Python virtual environment and installs agent dependencies using `uv`.

### 4. Database Setup
1. Go to your **Supabase Dashboard** -> **SQL Editor**.
2. Run the SQL scripts in the following order:
   - `supabase_setup.sql` (Core tables)
   - `supabase_policies_migration.sql` (Security & RLS)
   - `supabase_audit_functions_migration.sql` (Audit logic)
   - *Any other `supabase_*.sql` files as needed.*

### 5. Running the Project
To start both the Next.js frontend and the FastAPI agent server concurrently:
```bash
npm run dev
```
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Agent Server**: [http://localhost:8000](http://localhost:8000)

---

## 🧠 How It Works

### Architecture
- **Next.js Frontend**: Handles user authentication, dashboard visualizations, and provides the chat interface for AI interactions.
- **FastAPI Agent Server**: Acts as the "brain". It hosts multiple specialized agents:
    - **Audit Agent**: Receives expense data, compares it against stored policies in Supabase, and flags violations.
    - **Enterprise Agent**: Uses "Tool Use" to fetch real-time data from Supabase or external tools (Slack/Gmail) to answer complex business questions.
    - **Vision Agent**: Uses Gemini's multimodal capabilities to "see" receipts and parse them into JSON.
- **Supabase**: The source of truth for all data, including expenses, user profiles, and audit results.

### Expense Lifecycle
1. User uploads a receipt (Vision Agent parses it).
2. Expense is saved to Supabase.
3. Audit Agent automatically processes the expense upon creation or update.
4. Admins can query stats through the Enterprise Agent or Voice Agent.

---

## 🔄 Database Migrations & Utilities

### Phone Number Synchronization
If you have data from WhatsApp/Cliq that needs to be linked to your users:
```bash
npm run migrate:phones    # Syncs phone numbers and links records
npm run verify:migration  # Verifies the migration success
```

---

## 🤝 Project Structure

- `/src`: Next.js frontend (components, hooks, pages).
- `/agent`: Python-based AI agents and FastAPI server.
- `/scripts`: Utility scripts for setup and migrations.
- `/public`: Static assets.

---

Created with ❤️ by Fristine Infotech.