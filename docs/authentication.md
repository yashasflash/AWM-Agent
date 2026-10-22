# AWM Agent — Authentication & Role-Based Access Control (RBAC)

## 1. Authentication Architecture

The **AWM Agent** implements a secure, defense-in-depth authentication system:
1. **Identity & Session Verification**: Managed through Supabase Auth (JWT bearer tokens).
2. **Server-Controlled Authorization**: Roles are securely stored in `auth.users.app_metadata` and cannot be modified by browser clients.
3. **Double Guarding**: Enforced on the client via React `ProtectedRoute` and on the server via FastAPI dependency injection (`require_citizen`, `require_staff`, `require_manager`).
4. **Database-Level Isolation**: Supabase PostgreSQL Row Level Security (RLS) ensures that even direct database queries cannot leak records across roles.

---

## 2. Supported Roles & Access Matrix

| Role | Identifiers | Allowed Endpoints | Dashboard Route |
| :--- | :--- | :--- | :--- |
| **Citizen** | Civic Email | `/api/v1/reports` (own reports only), `/api/v1/auth/me` | `/user` |
| **Municipal Staff** | Official Email or `STF-XXXXX` | `/api/v1/reports/staff/*`, accept/start/resolve assigned tasks | `/municipal` |
| **Operations Manager** | Admin Email or `MGR-XXXXX` | `/api/v1/reports/manager/*`, `/api/v1/auth/pending-approvals`, assign tasks, approve roles | `/manager` |
| **Pending Applicant** | Any | None (Blocked until Manager review) | `/auth/pending-approval` |

---

## 3. Google OAuth 2.0 Integration

### 3.1. Supabase OAuth Configuration
1. Open your Supabase Dashboard: **Authentication -> Providers -> Google**.
2. Enable Google Provider.
3. Enter your **Google Client ID** and **Google Client Secret** (from [Google Cloud Console](https://console.cloud.google.com/apis/credentials)).
4. Add the Authorized Redirect URI in Google Cloud Console:
   ```
   https://<your-project-id>.supabase.co/auth/v1/callback
   ```
5. In Supabase Dashboard -> **Authentication -> URL Configuration**, add your local frontend callback URL:
   ```
   http://localhost:5173/auth/callback
   ```

### 3.2. OAuth Callback & Role Resolution Flow
```
User clicks "Continue with Google"
  ↓
Redirected to Google Consent Screen
  ↓
Supabase Auth establishes session and redirects to /auth/callback
  ↓
Frontend captures access token and calls POST /api/v1/auth/google-sync
  ↓
FastAPI backend verifies JWT against Supabase Auth
  ↓
Backend looks up server-controlled app_metadata:
  • If role is Manager -> returns Manager profile
  • If role is Staff -> returns Staff profile
  • If role is Pending -> returns Pending status
  • If new user -> safely initializes Citizen profile
  ↓
Frontend redirects strictly based on verified server role:
  • Manager -> /manager
  • Municipal Staff -> /municipal
  • Citizen -> /user
  • Pending -> /auth/pending-approval
```

> [!IMPORTANT]
> Google sign-in strictly preserves existing authorizations. Logging in through the citizen portal will **never demote** an approved Manager or Staff member to Citizen permissions.

---

## 4. Role Assignment & Approval Lifecycle

1. **Citizen Accounts**: Auto-approved immediately upon registration.
2. **Municipal Staff Applications**:
   - Applicant submits official credentials at `/auth/register-staff`.
   - Account is recorded with `approval_status: "pending"` and assigned a unique registered ID (`STF-XXXXX`).
   - The user cannot access privileged staff work orders until reviewed.
3. **Manager Applications**:
   - Recorded with `approval_status: "pending"` and assigned a unique registered ID (`MGR-XXXXX`).
4. **Administrative Review**:
   - Authorized Managers review pending applications via `/api/v1/auth/pending-approvals`.
   - On approval (`POST /api/v1/auth/review-approval`): The account's `app_metadata.role` is upgraded and session token caches are automatically cleared.

---

## 5. Row Level Security (RLS) Policies

All reports and tasks in PostgreSQL have Row Level Security enabled:

```sql
-- Citizen read isolation
CREATE POLICY "Citizens can view own reports"
ON public.waste_reports
FOR SELECT TO authenticated
USING (
    citizen_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('municipal_staff', 'manager')
);

-- Staff task isolation
CREATE POLICY "Staff and Manager Task Access"
ON public.collection_tasks
FOR SELECT TO authenticated
USING (
    LOWER(assigned_vehicle) = LOWER(auth.jwt() ->> 'email')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'manager'
);
```
