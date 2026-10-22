# AWM Agent — AI-Powered Waste Management Platform

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ECF8E.svg?style=flat&logo=supabase)](https://supabase.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A full-stack, enterprise-grade municipal waste management solution integrating real-time citizen reporting, automated AI-driven triage (n8n + LLM/vision), role-based dispatching for sanitation teams, and city-wide administrative telemetry.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Problem Statement](#-problem-statement)
- [Proposed Solution](#-proposed-solution)
- [Core Features](#-core-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Local Setup & Installation](#-local-setup--installation)
- [Running the Application](#-running-the-application)
- [Environment Configuration](#-environment-configuration)
- [Database & Migrations](#-database--migrations)
- [Authentication & Role Management](#-authentication--role-management)
- [n8n Automation Integration](#-n8n-automation-integration)
- [Automated Testing](#-automated-testing)
- [Security Guidelines](#-security-guidelines)
- [Troubleshooting](#-troubleshooting)
- [License](#-license)

---

## 📖 Overview

**AWM Agent** addresses municipal waste management challenges through intelligent civic automation. Citizens report waste overflow, illegal dumping, or hazardous materials using a mobile-responsive web app. Backend services intake reports, dispatch them through an automated triage pipeline (powered by n8n and vision/language models), prioritize severity, and dynamically assign collection tasks to municipal field staff while giving city managers oversight through real-time heatmaps and KPIs.

---

## ⚠️ Problem Statement

Urban centers face persistent sanitation operational hurdles:
1. **Reporting Bottlenecks**: Citizens lack transparent, friction-free mechanisms to report roadside waste or illegal dumpsites.
2. **Delayed & Manual Triage**: Municipal dispatchers manually classify hundreds of reports daily without verified severity or hazard levels.
3. **Suboptimal Resource Allocation**: Sanitation crews lack structured task queues, route clarity, and verified proof-of-resolution workflows.
4. **Lack of Accountability**: Municipal leaders lack real-time heatmaps and metrics tracking resolution speed, staff performance, and recurring hotspots.

---

## 💡 Proposed Solution

The **AWM Agent Platform** unifies the civic waste lifecycle into a closed-loop system:
- **Intelligent Intake**: Geolocation-tagged citizen reporting with photo uploads.
- **Automated AI Triage**: Real-time webhook dispatch to an n8n workflow for image classification, severity scoring (High/Medium/Low), and priority routing.
- **Field Staff Operations**: Structured task boards for sanitation workers with live status updates (Pending → In Progress → Completed) and completion proof.
- **Executive Governance**: Centralized manager portal with approval gates for municipal staff, city-wide analytics, and audit logging.

---

## ✨ Core Features

### 👤 Citizen Portal
- **Interactive Report Form**: Geolocation capture (GPS or map picker), waste categorization (Plastic, Organic, Hazardous, Construction, etc.), and image upload.
- **Real-Time Tracking**: Track report status (`Pending`, `In Progress`, `Resolved`, `Rejected`) with timestamped audit notes.
- **Civic Leaderboard**: Gamified engagement rewarding active civic participants with contribution badges.

### 👷 Municipal Staff Portal
- **Task Management**: Dedicated queue of assigned waste collection tasks sorted by urgency.
- **Status Updates**: Mark tasks as *In Progress* upon dispatch and *Completed* upon cleanup.
- **Field Notes**: Record operational notes and collection verification data.

### 🏢 Manager & Executive Portal
- **City-Wide Analytics**: High-level KPIs: Total reports, active tasks, resolution velocity, and hazard counts.
- **Spatial Heatmaps**: Geospatial mapping of waste density to identify systemic dumping hotspots.
- **Staff Approval Queue**: Review, approve, or reject new municipal staff and supervisor registrations with audit trails.
- **Manual Task Dispatch**: Reassign or prioritize tasks directly to available staff.

### 🔐 Enterprise Auth & RBAC
- **Multi-Role Login**: Dedicated portals for `citizen`, `staff`, and `manager`.
- **Google OAuth 2.0 & Email/Password**: Unified authentication via Supabase Auth.
- **Zero-Trust Role Synchronization**: Token caching with role persistence prevents accidental privilege escalation or demotion during social logins.

---

## 🏗️ System Architecture

```text
       ┌────────────────────────┐
       │     Citizen / Staff    │
       │   Manager Client Web   │ (React 19, TypeScript, Vite)
       └───────────┬────────────┘
                   │ HTTPS / REST
                   ▼
       ┌────────────────────────┐
       │   FastAPI App Engine   │ (Python 3.11, Uvicorn)
       │  - Security & RBAC     │
       │  - Report Service      │
       │  - Task Service        │
       └─────┬────────────┬─────┘
             │            │
  Webhook POST            │ Database Queries / RLS
             ▼            ▼
 ┌────────────────┐   ┌───────────────────────────┐
 │  n8n AI Engine │   │   Supabase (PostgreSQL)   │
 │  - Vision OCR  │   │  - auth.users & metadata  │
 │  - Severity    │   │  - public.waste_reports   │
 │  - Auto-Triage │   │  - public.collection_tasks│
 └────────────────┘   └───────────────────────────┘
```

Detailed architectural specifications and sequence diagrams are available in [`docs/architecture.md`](docs/architecture.md).

---

## 💻 Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS, Lucide React, Axios, React Router v7 |
| **Backend** | Python 3.10+, FastAPI, Uvicorn, Pydantic v2, HTTPX, SQLite (notifications fallback) |
| **Database & Auth** | Supabase (Managed PostgreSQL, PostgREST, GoTrue Auth SDK) |
| **Automation & AI** | n8n Workflow Automation, Webhooks, AI/Vision classification |
| **Testing** | Pytest, Vitest / Vite build checks |

---

## 📂 Repository Structure

```text
AWM-Agent/
├── .env.example              # Unified environment variable template
├── .gitignore                # Root Git ignore rules (blocks keys, venv, node_modules)
├── LICENSE                   # MIT License
├── README.md                 # Master project documentation
│
├── frontend/                 # React 19 + TypeScript + Vite Single Page Application
│   ├── public/               # Static assets & icons
│   ├── src/                  # Application source code
│   │   ├── components/       # UI widgets, layout containers, role guards
│   │   ├── contexts/         # React Context providers (AuthContext)
│   │   ├── hooks/            # Custom hooks (useAuth, useReports)
│   │   ├── pages/            # View routes (Auth, Citizen, Staff, Manager)
│   │   ├── services/         # Axios API & Supabase client bindings
│   │   └── types/            # TypeScript interfaces
│   ├── .env.example          # Frontend-specific environment template
│   ├── package.json          # Node dependencies & scripts
│   ├── tsconfig.json         # TypeScript compiler configuration
│   ├── vite.config.ts        # Vite configuration & dev proxy
│   └── README.md             # Frontend technical documentation
│
├── backend/                  # FastAPI Application Server
│   ├── app/                  # Main backend package
│   │   ├── api/routes/       # API endpoints (auth, reports, tasks, staff)
│   │   ├── auth/             # JWT security, token cache, and RBAC guards
│   │   ├── models/           # Pydantic schemas and database models
│   │   ├── services/         # Business logic (reports, tasks, notifications)
│   │   ├── database.py       # Supabase client singleton
│   │   └── main.py           # FastAPI application entry point
│   ├── migrations/           # PostgreSQL migration scripts & RLS policies
│   ├── tests/                # Automated backend test suite
│   ├── requirements.txt      # Frozen Python dependencies
│   ├── .env.example          # Backend-specific environment template
│   └── README.md             # Backend technical documentation
│
├── automation/               # n8n Workflow Definitions
│   ├── README.md             # n8n setup, webhook payload specs, and triage rules
│   └── workflows/            # Workflow templates and specifications
│
├── docs/                     # Comprehensive System Documentation
│   ├── architecture.md       # Architectural specifications & data flows
│   ├── setup.md              # Detailed local setup and bootstrap guide
│   └── authentication.md     # RBAC, OAuth 2.0, and security model
│
└── scripts/                  # Administrative & Bootstrap Scripts
    ├── bootstrap_manager.py  # Headless manager account creation utility
    ├── verify_supabase.py    # Supabase connectivity & schema check script
    └── README.md             # Script operational manual
```

---

## 📋 Prerequisites

Ensure the following tools are installed on your host system:
- **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **npm**: `v9.0.0` or higher
- **Python**: `v3.10` or higher ([Download Python](https://www.python.org/))
- **Git**: `v2.30` or higher ([Download Git](https://git-scm.com/))
- **Supabase Account**: A free Supabase project with PostgreSQL and Auth enabled ([supabase.com](https://supabase.com)).
- *(Optional)* **n8n**: Local or cloud n8n instance for AI triage automation ([n8n.io](https://n8n.io)).

---

## ⚙️ Local Setup & Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/AWM-Agent.git
cd AWM-Agent
```

### 2. Configure Backend Environment
```bash
cd backend
cp .env.example .env
```
Open `backend/.env` and insert your Supabase credentials:
```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
N8N_WEBHOOK_URL=http://localhost:5678/webhook/awm-waste-report
```

### 3. Setup Python Virtual Environment & Dependencies
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### 4. Configure Frontend Environment
In a separate terminal:
```bash
cd ../frontend
cp .env.example .env
```
Open `frontend/.env` and insert your credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

### 5. Install Frontend Dependencies
```bash
npm install
```

---

## 🚀 Running the Application

### Start the FastAPI Backend Server
```bash
cd backend
# Ensure your virtual environment is active
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Base URL: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/docs`
- Health Check: `http://127.0.0.1:8000/health`

### Start the React Frontend Application
```bash
cd frontend
npm run dev
```
- Frontend UI: `http://localhost:5173`

---

## 🗄️ Database & Migrations

The platform utilizes Supabase PostgreSQL. Database tables and security policies are located in `backend/migrations/`:

- `001_initial_schema.sql`: Creates `waste_reports` and `collection_tasks` tables with geospatial coordinates, foreign keys, and indexes.
- `002_rls_policies.sql`: Enables Row Level Security (RLS) guaranteeing that citizens only see their reports, staff see assigned tasks, and managers have administrative oversight.

To execute migrations:
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open your project and navigate to the **SQL Editor**.
3. Run the contents of `backend/migrations/001_initial_schema.sql` followed by `002_rls_policies.sql`.

For automated verification of your database connectivity, run:
```bash
python scripts/verify_supabase.py
```

---

## 🔐 Authentication & Role Management

The platform supports three distinct roles stored in Supabase `auth.users.raw_app_meta_data`:

| Role | Access Level | Registration Behavior |
| :--- | :--- | :--- |
| `citizen` | Citizen Dashboard & reporting forms | Auto-approved upon signup. |
| `staff` | Staff Task Queue & status updates | Requires Manager approval (`approval_status: pending`). |
| `manager` | Full administrative oversight | Requires Manager approval or CLI bootstrap. |

### Bootstrapping the Initial Manager Account
Because municipal staff and managers require approval from an existing manager, use the included CLI script to bootstrap your initial admin account:
```bash
python scripts/bootstrap_manager.py --email admin@city.gov --password "YourStrongPassword123!" --full-name "City Administrator"
```

### Google OAuth 2.0 Configuration
To enable Google Sign-In:
1. In the Supabase Dashboard, navigate to **Authentication → Providers → Google**.
2. Enable Google and enter your Google Cloud **Client ID** and **Client Secret**.
3. Add `https://<your-supabase-ref>.supabase.co/auth/v1/callback` to your authorized redirect URIs in the Google Cloud Console.
4. In **Authentication → URL Configuration**, add `http://localhost:5173/auth/callback` to the **Redirect URLs**.

For comprehensive role-based access details, refer to [`docs/authentication.md`](docs/authentication.md).

---

## 🤖 n8n Automation Integration

When a citizen submits a waste report:
1. FastAPI stores the initial record in `public.waste_reports`.
2. A non-blocking asynchronous HTTP POST sends the report metadata and image URL to the `N8N_WEBHOOK_URL`.
3. The n8n workflow executes:
   - Image analysis using vision models to identify material type and hazard indicators.
   - Severity calculation (`low`, `medium`, `high`, `critical`).
   - Callback to `PATCH /api/v1/reports/{id}/triage` to update the report and auto-generate a `collection_task`.
4. *Graceful Fallback*: If n8n is offline or unreachable, the report is saved with default severity and flagged for manual manager triage without failing the user's submission.

See [`automation/README.md`](automation/README.md) for workflow details.

---

## 🧪 Automated Testing

### Backend Unit & Integration Tests
The backend test suite verifies authentication, multi-role portal isolation, staff approval workflows, and token caching:

```bash
cd backend
python -m pytest tests/
```

Individual test modules:
```bash
python tests/test_three_role_login.py
python tests/test_portal_combinations.py
python tests/test_registration_and_approval.py
python tests/test_google_auth_and_routing.py
```

### Frontend Build Verification
Verify TypeScript types and Vite build integrity:
```bash
cd frontend
npm run build
```

---

## 🛡️ Security Guidelines

- **Never Commit Secrets**: Real `.env` files, Supabase `service_role` keys, private keys, and SQLite database caches are strictly excluded in `.gitignore`.
- **Privilege Separation**: Service-role keys with database bypass capabilities must remain **server-side only** in `backend/.env`. Never expose them to Vite/Frontend.
- **Client Sanitization**: Only public-safe variables prefixed with `VITE_` should be present in `frontend/.env`.
- **Secret Rotation**: If a key is accidentally committed, immediately rotate it in the Supabase Dashboard under **Project Settings → API**.

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Login redirects to pending screen** | Newly registered Staff/Manager account awaiting review | Log in as Manager to approve, or run `scripts/bootstrap_manager.py`. |
| **CORS error on API requests** | FastAPI origin mismatch | Verify `backend/app/main.py` includes `http://localhost:5173` in `allow_origins`. |
| **Google OAuth loops or demotes role** | Token sync mismatch | Ensure `VITE_API_URL` is pointing to the running backend on port 8000. |
| **Supabase PostgREST error `PGRST205`** | Table or schema cache out of date | Run migrations in Supabase SQL Editor and reload schema cache in Supabase settings. |
| **n8n webhook timeout** | Local n8n not running | System automatically falls back to manual triage. Ensure n8n is running if automated triage is desired. |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
