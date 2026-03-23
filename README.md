# Expense Tracker & Admin AI Bot

A comprehensive expense management system with integrated AI agents (Voice, Audit, Vision, and Enterprise Intelligence).

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (3.12+)
- **uv** (Python package manager): `pip install uv`

### 2. Environment Setup
You need to set up two `.env` files:

#### Root `.env` (Frontend)
Copy the values to a `.env` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GOOGLE_API_KEY=your_gemini_api_key
AGENT_URL=http://localhost:8000
```

#### Agent `.env` (`agent/.env`)
Copy the values to `agent/.env`:
```env
GOOGLE_API_KEY=your_gemini_api_key
SARVAM_API_KEY=your_sarvam_ai_key
COMPOSIO_API_KEY=your_composio_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Installation
Run the following in the root directory:
```bash
npm install
```
*Note: This will automatically set up the Python virtual environment and sync dependencies using `uv`.*

### 4. Running the Application
To start both the Next.js frontend and the Python agent server concurrently:
```bash
npm run dev
```
- **Frontend**: [http://localhost:3000](http://localhost:3000)
- **Agent Server**: [http://localhost:8000](http://localhost:8000)

## 🛠 Project Structure

- `/src`: Next.js frontend (App Router, Tailwind CSS, Shadcn UI).
- `/agent`: Python AI Agents (FastAPI).
  - `main.py`: Main entry point for the agent server.
  - `voice_agent.py`: Real-time voice interaction using Pipecat.
  - `enterprise_agent.py`: Data intelligence and tool execution.
  - `audit_agent.py`: Expense auditing and policy compliance.
- `/scripts`: Setup and run utility scripts.

## 🧠 AI Features

- **Voice Agent**: Natural language voice interaction with dynamic status feedback ("Searching users...", "Drafting email...").
- **Enterprise Intelligence**: Query your data using Gemini 2.0 Flash.
- **Audit Agent**: Automatically audit expenses against company policies.
- **Vision Agent**: (OCR) Extract data from receipts and invoices.

## 💾 Database Schema
The project uses Supabase. Run the SQL migration files in the root directory (`supabase_*.sql`) in your Supabase SQL Editor to set up the required tables and policies.