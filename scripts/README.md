# AWM Agent — Administrative Scripts

This directory contains standalone administrative, verification, and bootstrapping scripts for managing the AWM Agent platform.

---

## Available Scripts

### 1. `bootstrap_manager.py`
Bootstraps or authorizes an initial Operations Manager account directly in Supabase using the Service Role Key without requiring an existing manager to approve the account.

**Usage**:
```bash
# From the project root
python scripts/bootstrap_manager.py --email admin@city.gov --password "YourStrongPassword123!" --name "Chief Operations Officer" --org "Municipal Sanitation HQ" --district "Central District" --designation "Chief Administrator"
```

**Key Actions**:
1. Generates a unique Manager ID (`MGR-XXXXX`).
2. Checks if the account exists in Supabase Auth.
3. Sets `app_metadata.role = "manager"` and `approval_status = "approved"`.
4. Upserts profile attributes in Supabase.
5. Informs you that the initial manager is ready for login.

---

### 2. `verify_supabase.py`
Verifies network connectivity to the Supabase PostgreSQL database, validates the service role key, queries user authentication accounts, and checks table readiness for `waste_reports` and `collection_tasks`.

**Usage**:
```bash
# From the project root
python scripts/verify_supabase.py
```

**Key Actions**:
1. Validates that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present in `backend/.env`.
2. Connects to Supabase Auth API and counts registered users.
3. Executes count queries against `waste_reports` and `collection_tasks`.
4. Reports table readiness and active record counts.
