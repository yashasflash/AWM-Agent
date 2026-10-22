# AWM Agent — Backend API Gateway

FastAPI-powered REST API backend for the **Autonomous AI Waste Management (AWM) Agent Platform**.

---

## 1. Directory Structure

```
backend/
├── app/
│   ├── main.py                  # FastAPI application entrypoint & middleware
│   ├── config.py                # Environment loading & validation
│   ├── database.py              # Supabase Client & Admin singleton providers
│   ├── api/
│   │   └── routes/
│   │       ├── auth.py          # Authentication, Google sync, role approvals
│   │       ├── health.py        # Health probe endpoints
│   │       ├── notifications.py # Notification dispatch endpoints
│   │       └── reports.py       # Report creation, n8n dispatch, assignment, triage
│   ├── auth/
│   │   └── security.py          # JWT verification, RBAC dependencies, token cache
│   ├── schemas/
│   │   └── report.py            # Pydantic data schemas
│   └── services/
│       └── notification_service.py # SQLite-backed notification manager
├── migrations/                  # Sequential SQL migration files for Supabase
├── tests/                       # Integration & workflow test suites
├── setup_initial_manager.py     # Administrative manager bootstrapping script
├── requirements.txt             # Pinned Python dependencies
└── .env.example                 # Sanitized environment configuration template
```

---

## 2. API Endpoints Overview

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | System health probe |
| `POST` | `/api/v1/auth/login` | Public | Authenticate via email/password or registered ID |
| `POST` | `/api/v1/auth/google-sync` | Authenticated | Synchronize Google OAuth session & verify role |
| `GET` | `/api/v1/auth/me` | Authenticated | Retrieve current user profile & verified role |
| `POST` | `/api/v1/auth/register-citizen` | Public | Register Citizen account (auto-approved) |
| `POST` | `/api/v1/auth/register-staff` | Public | Apply for Municipal Staff account (pending) |
| `POST` | `/api/v1/auth/register-manager` | Public | Apply for Operations Manager account (pending) |
| `GET` | `/api/v1/auth/pending-approvals` | Manager Only | List staff/manager applicants awaiting approval |
| `POST` | `/api/v1/auth/review-approval` | Manager Only | Approve or reject pending applications |
| `POST` | `/api/v1/auth/assign-role` | Manager Only | Directly update user role & registered ID |
| `GET` | `/api/v1/reports/` | Citizen | Retrieve citizen's own submitted reports |
| `POST` | `/api/v1/reports/` | Citizen | Submit new waste incident & trigger n8n AI triage |
| `GET` | `/api/v1/reports/{id}` | Authenticated | View report details and 8-stage timeline |
| `GET` | `/api/v1/reports/manager/all` | Manager Only | Supervisory view of all municipal waste reports |
| `POST` | `/api/v1/reports/manager/{id}/assign` | Manager Only | Dispatch report to municipal staff |
| `POST` | `/api/v1/reports/manager/{id}/verify` | Manager Only | Manager approval & closure of resolved incident |
| `GET` | `/api/v1/reports/staff/assigned` | Staff Only | View work orders assigned to staff vehicle/email |
| `PATCH` | `/api/v1/reports/staff/{id}/accept` | Staff Only | Mark assignment as accepted in the field |
| `PATCH` | `/api/v1/reports/staff/{id}/start` | Staff Only | Mark work in progress |
| `PATCH` | `/api/v1/reports/staff/{id}/resolve` | Staff Only | Submit clearance notes and photo resolution |

---

## 3. Running Locally

```bash
# Activate virtual environment
.venv\Scripts\activate

# Install requirements
pip install -r requirements.txt

# Run server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive Swagger documentation: `http://127.0.0.1:8000/docs`

---

## 4. Running Test Suites

```bash
# Role resolution & RBAC dependencies
python test_three_role_login.py

# Portal combination isolation
python test_portal_combinations.py

# Complete registration & approval lifecycle
python test_registration_and_approval.py

# Google OAuth role preservation
python test_google_auth_and_routing.py
```
