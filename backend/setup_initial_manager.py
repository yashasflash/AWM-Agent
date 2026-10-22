"""
==============================================================================
Script: setup_initial_manager.py
Project: Autonomous Waste Management (AWM) Agent
Description: Secure server-side initial Manager setup process using the
             Supabase Service Role Key. Establishes the initial authorized
             Manager account with a verified manager_id.
==============================================================================
"""

import sys
import argparse
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
    users_list = admin_client.auth.admin.list_users()
    all_users = users_list.users if hasattr(users_list, "users") else users_list

    for u in all_users:
        if (u.email or "").strip().lower() == clean_email:
            target_user = u
            break

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
        update_payload = {
            "password": password,
            "email_confirm": True,
            "app_metadata": app_meta,
            "user_metadata": user_meta,
        }
        res = admin_client.auth.admin.update_user_by_id(str(target_user.id), update_payload)
        user_id = str(target_user.id)
    else:
        print("Creating new Supabase Auth user...")
        created = admin_client.auth.admin.create_user({
            "email": clean_email,
            "password": password,
            "email_confirm": True,
            "app_metadata": app_meta,
            "user_metadata": user_meta,
        })
        user_id = str(created.user.id)

    # Upsert into user_profiles table if available
    try:
        admin_client.table("user_profiles").upsert({
            "user_id": user_id,
            "email": clean_email,
            "full_name": full_name,
            "role": ROLE_MANAGER,
            "requested_role": ROLE_MANAGER,
            "approval_status": "approved",
            "manager_id": unique_mgr_id,
            "organization": org,
            "district": district,
            "designation": designation,
        }, on_conflict="user_id").execute()
        print("Updated public.user_profiles table in Supabase PostgreSQL.")
    except Exception as e:
        print("Note: user_profiles table not found or skipped (Auth metadata active).")

    print("\nSUCCESS!")
    print(f"Manager Account Ready:")
    print(f"  • Email:        {clean_email}")
    print(f"  • Manager ID:   {unique_mgr_id}")
    print(f"  • Role:         {ROLE_MANAGER}")
    print(f"  • Status:       approved")
    print(f"  • Password:     [SECURELY UPDATED]")
    print("=======================================================\n")
    return unique_mgr_id

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AWM Initial Manager Setup")
    parser.add_argument("--email", default="tryashas076@gmail.com", help="Manager email")
    parser.add_argument("--password", default="Password123!", help="Manager password")
    parser.add_argument("--name", default="Yashas T R", help="Manager full name")
    parser.add_argument("--org", default="Municipal Sanitation HQ", help="Organization")
    parser.add_argument("--district", default="Central District", help="District")
    parser.add_argument("--designation", default="Chief Sanitation Officer", help="Designation")

    args = parser.parse_args()
    setup_manager(args.email, args.password, args.name, args.org, args.district, args.designation)
