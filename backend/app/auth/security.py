import os
from typing import Literal
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import create_client

from app.config import SUPABASE_KEY, SUPABASE_URL
from app.database import get_supabase_admin_client

bearer_scheme = HTTPBearer()

# Role Constants
ROLE_CITIZEN = "citizen"
ROLE_STAFF = "municipal_staff"
ROLE_MANAGER = "manager"

def normalize_email(email: str) -> str:
    """Normalize Gmail addresses by stripping dots and tags so variations match."""
    if not email:
        return ""
    email = email.strip().lower()
    if "@gmail.com" in email:
        user, domain = email.split("@", 1)
        user = user.replace(".", "").split("+", 1)[0]
        return f"{user}@{domain}"
    return email


# Configurable administrator / manager emails (normalized for Gmail alias compatibility)
MANAGER_EMAILS = [
    normalize_email(email)
    for email in os.getenv(
        "MANAGER_EMAILS",
        "tryashas076@gmail.com,t.r.yashas076@gmail.com,manager@awm.gov,admin@awm.gov",
    ).split(",")
    if email.strip()
]

# Configurable municipal staff emails
STAFF_EMAILS = [
    normalize_email(email)
    for email in os.getenv(
        "STAFF_EMAILS",
        "staff@awm.gov,staff1@awm.gov,field@awm.gov",
    ).split(",")
    if email.strip()
]


import random
import string

def generate_unique_registered_id(role: str) -> str:
    """
    Generate a real, unique alphanumeric identifier for approved Municipal Staff or Managers.
    Format: STF-XXXXX or MGR-XXXXX
    """
    prefix = "STF" if role == ROLE_STAFF else "MGR"
    admin_client = get_supabase_admin_client()
    
    # Try generating a random 5-digit number and verify uniqueness
    for _ in range(20):
        digits = "".join(random.choices(string.digits, k=5))
        candidate_id = f"{prefix}-{digits}"
        
        # Check against existing auth users
        try:
            users_res = admin_client.auth.admin.list_users()
            all_users = users_res.users if hasattr(users_res, "users") else users_res
            collision = False
            for u in all_users:
                app_meta = getattr(u, "app_metadata", {}) or {}
                user_meta = getattr(u, "user_metadata", {}) or {}
                if (
                    app_meta.get("staff_id") == candidate_id
                    or user_meta.get("staff_id") == candidate_id
                    or app_meta.get("manager_id") == candidate_id
                    or user_meta.get("manager_id") == candidate_id
                ):
                    collision = True
                    break
            if not collision:
                return candidate_id
        except Exception:
            return candidate_id

    # Fallback with timestamp digits
    import time
    return f"{prefix}-{str(int(time.time()))[-5:]}"


def find_user_by_identifier(identifier: str):
    """
    Look up a user in Supabase by either:
    1. Email address (contains '@')
    2. Registered Staff ID ('STF-XXXXX')
    3. Registered Manager ID ('MGR-XXXXX')
    """
    if not identifier:
        return None

    clean_ident = identifier.strip()
    admin_client = get_supabase_admin_client()

    # If it looks like an email, find matching user
    if "@" in clean_ident:
        clean_email = clean_ident.lower()
        clean_normalized = normalize_email(clean_email)
        try:
            users_res = admin_client.auth.admin.list_users()
            all_users = users_res.users if hasattr(users_res, "users") else users_res
            for u in all_users:
                u_email = (u.email or "").strip().lower()
                if u_email == clean_email or normalize_email(u_email) == clean_normalized:
                    return u
        except Exception as e:
            print("USER LOOKUP BY EMAIL ERROR:", repr(e))
        return None

    # Lookup by Registered ID (STF-... or MGR-...)
    clean_id_upper = clean_ident.upper()

    # 1. First check user_profiles table if it exists
    try:
        query_col = "staff_id" if clean_id_upper.startswith("STF") else "manager_id"
        res = admin_client.table("user_profiles").select("*").eq(query_col, clean_id_upper).limit(1).execute()
        if res.data and len(res.data) > 0:
            found_email = res.data[0].get("email")
            if found_email:
                users_res = admin_client.auth.admin.list_users()
                all_users = users_res.users if hasattr(users_res, "users") else users_res
                for u in all_users:
                    if (u.email or "").strip().lower() == found_email.lower():
                        return u
    except Exception:
        pass

    # 2. Check auth.users app_metadata / user_metadata directly
    try:
        users_res = admin_client.auth.admin.list_users()
        all_users = users_res.users if hasattr(users_res, "users") else users_res
        for u in all_users:
            app_meta = getattr(u, "app_metadata", {}) or {}
            user_meta = getattr(u, "user_metadata", {}) or {}
            if (
                app_meta.get("staff_id") == clean_id_upper
                or user_meta.get("staff_id") == clean_id_upper
                or app_meta.get("manager_id") == clean_id_upper
                or user_meta.get("manager_id") == clean_id_upper
            ):
                return u
    except Exception as e:
        print("USER LOOKUP BY ID ERROR:", repr(e))

    return None


import time

# Performance Optimization: Token Authentication & User Profile Caching
_auth_client_singleton = None
_token_cache: dict[str, tuple[dict, float]] = {}
_user_profiles_available: bool | None = None

def clear_token_cache(token: str | None = None) -> None:
    """Invalidate cached session token(s) upon role updates."""
    global _token_cache
    if token and token in _token_cache:
        del _token_cache[token]
    else:
        _token_cache.clear()

def get_shared_auth_client():
    global _auth_client_singleton
    if _auth_client_singleton is None:
        _auth_client_singleton = create_client(
            SUPABASE_URL,
            SUPABASE_KEY,
        )
    return _auth_client_singleton


def resolve_user_profile(user_id: str, email: str, user_meta: dict, app_meta: dict) -> dict:
    """
    Safely retrieve user profile from public.user_profiles if available,
    otherwise gracefully fallback to auth metadata without redundant 404 delays.
    """
    global _user_profiles_available

    profile_data = {
        "full_name": (
            user_meta.get("full_name")
            or user_meta.get("name")
            or email.split("@")[0].replace(".", " ").title()
        ),
        "place": user_meta.get("place") or "",
        "state": user_meta.get("state") or "",
        "municipality": user_meta.get("municipality") or user_meta.get("place") or "Central Municipality",
        "organization": user_meta.get("organization") or "Central Municipality",
        "district": user_meta.get("district") or "Central District",
        "ward": user_meta.get("ward") or "Ward 1",
        "organization_id": user_meta.get("organization_id") or "MUNICIPALITY-MAIN",
        "designation": user_meta.get("designation") or app_meta.get("designation") or None,
        "staff_id": app_meta.get("staff_id") or user_meta.get("staff_id") or None,
        "manager_id": app_meta.get("manager_id") or user_meta.get("manager_id") or None,
        "db_role": None,
        "requested_role": app_meta.get("requested_role") or user_meta.get("requested_role") or ROLE_CITIZEN,
        "approval_status": app_meta.get("approval_status") or "approved",
    }

    # Only query user_profiles if not known to be missing
    if _user_profiles_available is not False:
        try:
            admin_client = get_supabase_admin_client()
            res = (
                admin_client.table("user_profiles")
                .select("*")
                .eq("user_id", user_id)
                .limit(1)
                .execute()
            )
            _user_profiles_available = True
            if res.data:
                p = res.data[0]
                if p.get("full_name"):
                    profile_data["full_name"] = p["full_name"]
                if p.get("place"):
                    profile_data["place"] = p["place"]
                if p.get("state"):
                    profile_data["state"] = p["state"]
                if p.get("organization"):
                    profile_data["organization"] = p["organization"]
                if p.get("district"):
                    profile_data["district"] = p["district"]
                if p.get("ward"):
                    profile_data["ward"] = p["ward"]
                if p.get("designation"):
                    profile_data["designation"] = p["designation"]
                if p.get("staff_id"):
                    profile_data["staff_id"] = p["staff_id"]
                if p.get("manager_id"):
                    profile_data["manager_id"] = p["manager_id"]
                if p.get("organization_id"):
                    profile_data["organization_id"] = p["organization_id"]
                if p.get("role"):
                    profile_data["db_role"] = p["role"]
                if p.get("requested_role"):
                    profile_data["requested_role"] = p["requested_role"]
                if p.get("approval_status"):
                    profile_data["approval_status"] = p["approval_status"]
        except Exception as exc:
            # Table does not exist in Supabase (PGRST205) - disable to prevent 800ms penalty on every request
            err_msg = str(exc)
            if "PGRST205" in err_msg or "Could not find the table" in err_msg:
                _user_profiles_available = False

    return profile_data


def get_authenticated_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    Verify the user's access token with Supabase Auth and strictly determine
    their role among: citizen, municipal_staff, manager.
    Never trust a role supplied by browser requests.
    Caches verified session for 30s to eliminate redundant roundtrips across concurrent requests.
    """
    access_token = credentials.credentials
    now = time.time()

    # Fast cache check for active session token
    if access_token in _token_cache:
        cached_user, expiry = _token_cache[access_token]
        if now < expiry:
            return cached_user
        else:
            del _token_cache[access_token]

    try:
        auth_client = get_shared_auth_client()

        response = auth_client.auth.get_user(access_token)

        if response.user is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication token.",
            )

        raw_email = (response.user.email or "").strip().lower()
        user_email_normalized = normalize_email(raw_email)
        user_id = str(response.user.id)
        app_meta = response.user.app_metadata or {}
        user_meta = response.user.user_metadata or {}

        # Retrieve profile details
        profile = resolve_user_profile(user_id, raw_email, user_meta, app_meta)

        # Explicit role assigned in Auth app_metadata, user_profiles table, or user_metadata
        explicit_role = (
            app_meta.get("role")
            or profile.get("db_role")
            or user_meta.get("role")
        )
        if explicit_role:
            explicit_role = str(explicit_role).strip().lower()

        raw_approval_status = str(app_meta.get("approval_status") or profile.get("approval_status") or "").strip().lower()
        raw_requested_role = str(app_meta.get("requested_role") or user_meta.get("requested_role") or profile.get("requested_role") or "").strip().lower()

        is_designated_manager = (
            user_email_normalized in MANAGER_EMAILS
            or raw_email in MANAGER_EMAILS
        )
        is_assigned_manager = bool(
            app_meta.get("manager_id") or profile.get("manager_id") or user_meta.get("manager_id")
        )
        is_designated_staff = (
            user_email_normalized in STAFF_EMAILS
            or raw_email in STAFF_EMAILS
        )
        is_assigned_staff = bool(
            app_meta.get("staff_id") or profile.get("staff_id") or user_meta.get("staff_id")
        )

        # 1. Manager Role check (Designated emails, explicit manager role, or approved manager ID)
        if is_designated_manager or (explicit_role in ("manager", "admin") and raw_approval_status != "pending") or (is_assigned_manager and raw_approval_status == "approved"):
            role = ROLE_MANAGER
            requested_role = ROLE_MANAGER
            approval_status = "approved"
        # 2. Municipal Staff Role check (Designated emails, explicit staff role, or approved staff ID)
        elif is_designated_staff or (explicit_role in ("municipal_staff", "staff") and raw_approval_status != "pending") or (is_assigned_staff and raw_approval_status == "approved"):
            role = ROLE_STAFF
            requested_role = ROLE_STAFF
            approval_status = "approved"
        # 3. Check Pending Approval Requests (Unapproved applicants)
        elif raw_approval_status == "pending" or (raw_requested_role in (ROLE_STAFF, ROLE_MANAGER) and explicit_role not in (ROLE_STAFF, ROLE_MANAGER)):
            role = ROLE_CITIZEN
            requested_role = raw_requested_role or ROLE_STAFF
            approval_status = "pending"
        # 4. Explicit Citizen or default
        else:
            role = ROLE_CITIZEN
            requested_role = ROLE_CITIZEN
            approval_status = "approved"

        # Check if citizen profile is complete
        is_profile_complete = bool(
            profile.get("full_name")
            and profile.get("place")
            and profile.get("state")
        ) if role == ROLE_CITIZEN else True

        user_data = {
            "user_id": user_id,
            "email": response.user.email,
            "full_name": profile["full_name"],
            "place": profile["place"],
            "state": profile["state"],
            "municipality": profile["municipality"],
            "organization": profile.get("organization", "Central Municipality"),
            "district": profile.get("district", "Central District"),
            "ward": profile.get("ward", "Ward 1"),
            "organization_id": profile["organization_id"],
            "designation": profile.get("designation"),
            "staff_id": profile.get("staff_id"),
            "manager_id": profile.get("manager_id"),
            "is_profile_complete": is_profile_complete,
            "access_token": access_token,
            "role": role,
            "requested_role": requested_role,
            "approval_status": approval_status,
            "is_pending_approval": approval_status == "pending",
            "is_manager": role == ROLE_MANAGER,
            "is_staff": role == ROLE_STAFF,
            "is_citizen": role == ROLE_CITIZEN,
            "is_admin": role == ROLE_MANAGER,
        }

        # Cache session verification for 30 seconds
        if len(_token_cache) > 500:
            _token_cache.clear()
        _token_cache[access_token] = (user_data, now + 30.0)

        return user_data

    except HTTPException:
        raise

    except Exception as exc:
        print("TOKEN VERIFICATION ERROR:", repr(exc))

        raise HTTPException(
            status_code=401,
            detail="Authentication failed. Check the token validity.",
        ) from exc


def require_citizen(
    current_user: dict = Depends(get_authenticated_user),
) -> dict:
    """Ensure the caller is an authenticated user."""
    return current_user


def require_staff(
    current_user: dict = Depends(get_authenticated_user),
) -> dict:
    """Ensure the user is authorized as Municipal Staff (or Manager)."""
    if current_user.get("is_pending_approval"):
        raise HTTPException(
            status_code=403,
            detail="Your Municipal Staff registration has been submitted. Your account is awaiting Manager approval.",
        )
    if current_user["role"] not in (ROLE_STAFF, ROLE_MANAGER):
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Municipal Staff privileges required.",
        )
    return current_user


def require_manager(
    current_user: dict = Depends(get_authenticated_user),
) -> dict:
    """Ensure the user is authorized as a Manager / Administrator."""
    if current_user.get("is_pending_approval"):
        raise HTTPException(
            status_code=403,
            detail="Your Manager registration request has been submitted for authorization.",
        )
    if current_user["role"] != ROLE_MANAGER:
        raise HTTPException(
            status_code=403,
            detail="Access forbidden: Manager privileges required.",
        )
    return current_user


# Backward compatibility alias
get_authenticated_admin_user = require_manager