# AWM Agent — Local Setup & Deployment Guide

This guide walks you through setting up the complete **AWM Agent** application locally on your machine.

---

## 1. Prerequisites

Make sure the following tools are installed:
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **Python**: v3.10, v3.11, or v3.12
* **Supabase Account**: A free Supabase project with PostgreSQL and Auth enabled
* **(Optional) n8n**: v1.0.0+ if running autonomous AI decision workflows locally

---

## 2. Repository Cloning & Project Layout

```bash
git clone <your-repository-url> AWM-Agent
cd AWM-Agent
```

The repository structure:
* `frontend/`: React 18 + Vite client
* `backend/`: FastAPI Python API server
* `automation/`: n8n workflow configurations
* `docs/`: Technical manuals and guides
* `scripts/`: Administrative utilities

---

## 3. Backend Setup (FastAPI)

### 3.1. Create and Activate Virtual Environment

```bash
cd backend

# On Windows (PowerShell):
python -m venv .venv
.venv\Scripts\Activate.ps1

# On Linux / macOS:
python3 -m venv .venv
source .venv/bin/activate
```

### 3.2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3.3. Configure Environment Variables

Create `backend/.env` from the provided template:

```bash
cp .env.example .env
```

Edit `backend/.env` with your Supabase credentials:

```ini
# Supabase Project URL (Dashboard -> Project Settings -> API)
SUPABASE_URL=https://your-project-id.supabase.co

# Supabase Public / Anon Key (Project Settings -> API -> anon public)
SUPABASE_KEY=your_supabase_anon_key

# Supabase Secret Service Role Key (Project Settings -> API -> service_role secret)
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Authorized Manager Google Emails (comma-separated)
MANAGER_EMAILS=your.email@gmail.com,manager@awm.gov

# Authorized Municipal Staff Google Emails (comma-separated)
STAFF_EMAILS=staff@awm.gov,field@awm.gov

# n8n AI Decision Webhook (optional, defaults to local port 5678)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/awm-waste-report
```

> [!CAUTION]
> Never commit `backend/.env` to GitHub. The private `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security.

### 3.4. Execute Database Schema Migrations

In your Supabase project dashboard, navigate to **SQL Editor** and execute the migration scripts in sequential order:
1. `backend/migrations/001_roles_and_assignments.sql`
2. `backend/migrations/002_user_profiles_and_google_auth.sql`
3. `backend/migrations/003_role_approval_system.sql`
4. `backend/migrations/004_registered_ids_and_designations.sql`
5. `backend/migrations/005_performance_indexes.sql`

### 3.5. Bootstrap Initial Operations Manager Account

Run the administrative setup script to create your verified Manager account:

```bash
python setup_initial_manager.py --email your.email@gmail.com --password YourPassword123! --name "Operations Lead"
```

### 3.6. Start the Backend API Server

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend is now live:
* API Gateway: `http://127.0.0.1:8000`
* Swagger Interactive API Docs: `http://127.0.0.1:8000/docs`
* Health Check: `http://127.0.0.1:8000/health`

---

## 4. Frontend Setup (React + Vite)

### 4.1. Install Dependencies

Open a new terminal:

```bash
cd frontend
npm install
```

### 4.2. Configure Environment Variables

Create `frontend/.env` from the template:

```bash
cp .env.example .env
```

Edit `frontend/.env`:

```ini
VITE_API_URL=http://localhost:8000
VITE_API_BASE_URL=http://localhost:8000
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4.3. Run the Development Server

```bash
npm run dev
```

The web application is now accessible at:
* Portal: `http://localhost:5173`

---

## 5. Running Automated Tests

### 5.1. Backend Test Suites
In `backend/` with virtual environment active:
```bash
# Test 3-role login and RBAC dependencies
python test_three_role_login.py

# Test portal authentication enforcement & 403 rejections
python test_portal_combinations.py

# Test complete registration and approval lifecycle
python test_registration_and_approval.py

# Test Google OAuth role preservation
python test_google_auth_and_routing.py
```

### 5.2. Frontend Build Verification
In `frontend/`:
```bash
npm run build
```
