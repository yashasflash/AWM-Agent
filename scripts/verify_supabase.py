"""
==============================================================================
Script: scripts/verify_supabase.py
Project: Autonomous Waste Management (AWM) Agent
Description: Verifies connectivity to Supabase, checks database schema tables,
             counts records, and validates service role credentials.
==============================================================================
"""

import os
import sys
from pathlib import Path

# Add backend directory to sys.path so app imports resolve
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Ensure backend/.env is loaded
from dotenv import load_dotenv
env_path = BACKEND_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

from app.database import get_supabase_client, get_supabase_admin_client

def main():
    print("=======================================================")
    print("      AWM AGENT — SUPABASE CONNECTIVITY CHECK         ")
    print("=======================================================\n")

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    print(f"Supabase URL:             {'[CONFIGURED]' if supabase_url else '[MISSING]'}")
    print(f"Supabase Anon Key:        {'[CONFIGURED]' if supabase_key else '[MISSING]'}")
    print(f"Supabase Service Role Key:{'[CONFIGURED]' if service_key else '[MISSING]'}\n")

    if not supabase_url or not service_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env")
        sys.exit(1)

    # 1. Test Admin Client & Auth API
    print("1. Testing Supabase Admin Client & Auth API...")
    try:
        admin_client = get_supabase_admin_client()
        users_response = admin_client.auth.admin.list_users()
        users = users_response.users if hasattr(users_response, "users") else users_response
        print(f"   [SUCCESS] Connected to Auth API. Found {len(users)} registered users.")
    except Exception as e:
        print(f"   [WARNING] Auth API check: {e}")

    # 2. Test waste_reports table
    print("\n2. Checking 'waste_reports' table...")
    try:
        client = get_supabase_client()
        res = client.table("waste_reports").select("id", count="exact").execute()
        count = len(res.data) if res.data else 0
        total = getattr(res, "count", count)
        print(f"   [SUCCESS] 'waste_reports' table reachable. Active records: {total}")
    except Exception as e:
        print(f"   [ERROR] Failed to query 'waste_reports': {e}")

    # 3. Test collection_tasks table
    print("\n3. Checking 'collection_tasks' table...")
    try:
        client = get_supabase_client()
        res = client.table("collection_tasks").select("id", count="exact").execute()
        count = len(res.data) if res.data else 0
        total = getattr(res, "count", count)
        print(f"   [SUCCESS] 'collection_tasks' table reachable. Active tasks: {total}")
    except Exception as e:
        print(f"   [ERROR] Failed to query 'collection_tasks': {e}")

    print("\n=======================================================")
    print("      SUPABASE CONNECTIVITY VERIFICATION COMPLETE     ")
    print("=======================================================")

if __name__ == "__main__":
    main()
