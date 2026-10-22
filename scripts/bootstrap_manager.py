"""
==============================================================================
Script: scripts/bootstrap_manager.py
Project: Autonomous Waste Management (AWM) Agent
Description: Headless CLI utility to bootstrap or authorize an initial Manager
             account directly via Supabase Auth Admin API without needing an
             existing manager to approve them.
==============================================================================
"""

import sys
import argparse
from pathlib import Path

# Add backend directory to sys.path so app imports resolve
CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

# Load backend/.env
from dotenv import load_dotenv
env_path = BACKEND_DIR / ".env"
if env_path.exists():
    load_dotenv(env_path)
else:
    load_dotenv()

from app.database import get_supabase_admin_client
from app.auth.security import ROLE_MANAGER, generate_unique_registered_id, normalize_email

def setup_manager(email: str, password: str, full_name: str, org: str, district: str, designation: str):
    print("\n=======================================================")
    print("      AWM AGENT — SECURE INITIAL MANAGER SETUP        ")
    print("=======================================================")

    clean_email = email.strip().lower()
    admin_client = get_supabase_admin_client()

    print(f"Target Email: {clean_email}")
    print(f"Full Name:    {full_name}")
    print(f"Organization: {org}")

    # Generate unique Manager ID
    unique_mgr_id = generate_unique_registered_id(ROLE_MANAGER)
    print(f"Generated Unique Manager ID: {unique_mgr_id}")

    # Check if user already exists in Supabase Auth
    target_user = None
    try:
        users_list = admin_client.auth.admin.list_users()
        all_users = users_list.users if hasattr(users_list, "users") else users_list

        for u in all_users:
            if (u.email or "").strip().lower() == clean_email:
                target_user = u
                break
    except Exception as e:
        print(f"Error querying users: {e}")
        return

    user_meta = {
        "full_name": full_name,
        "name": full_name,
        "organization": org,
        "district": district,
        "designation": designation,
        "manager_id": unique_mgr_id,
        "role": ROLE_MANAGER,
    }

    app_meta = {
        "role": ROLE_MANAGER,
        "approval_status": "approved",
        "requested_role": ROLE_MANAGER,
        "manager_id": unique_mgr_id,
    }

    if target_user:
        print(f"Updating existing Supabase Auth user (ID: {target_user.id})...")
        update_attrs = {
            "user_metadata": {**(target_user.user_metadata or {}), **user_meta},
            "app_metadata": {**(target_user.app_metadata or {}), **app_meta},
        }
        if password:
            update_attrs["password"] = password

        res = admin_client.auth.admin.update_user_by_id(target_user.id, update_attrs)
        print("Successfully updated user metadata with Manager role and Approved status.")
    else:
        print("Creating new Supabase Auth user as verified Manager...")
        if not password:
            print("ERROR: Password is required when creating a new user.")
            sys.exit(1)

        res = admin_client.auth.admin.create_user({
            "email": clean_email,
            "password": password,
            "email_confirm": True,
            "user_metadata": user_meta,
            "app_metadata": app_meta,
        })
        print("Successfully created new Manager user.")

    print("\n-------------------------------------------------------")
    print("MANAGER ACCOUNT READY!")
    print(f"Email:      {clean_email}")
    print(f"Manager ID: {unique_mgr_id}")
    print(f"Role:       {ROLE_MANAGER}")
    print(f"Status:     APPROVED")
    print("-------------------------------------------------------")
    print("You can now log in via the Manager portal:")
    print("1. Go to http://localhost:5173/login/manager")
    print("2. Enter your credentials or use Google OAuth with this email.")
    print("=======================================================\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bootstrap initial authorized Manager account for AWM.")
    parser.add_argument("--email", required=True, help="Email address of the manager")
    parser.add_argument("--password", required=False, default="", help="Password (required for new user)")
    parser.add_argument("--name", default="Operations Manager", help="Full name")
    parser.add_argument("--org", default="City Municipal Corporation", help="Organization name")
    parser.add_argument("--district", default="Central Sanitation Zone", help="Assigned district")
    parser.add_argument("--designation", default="Operations Manager", help="Official designation")

    args = parser.parse_args()
    setup_manager(args.email, args.password, args.name, args.org, args.district, args.designation)
