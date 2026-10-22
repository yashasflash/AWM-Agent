from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from supabase import create_client

from app.auth.security import (
    ROLE_CITIZEN,
    ROLE_MANAGER,
    ROLE_STAFF,
    get_authenticated_user,
    require_citizen,
    require_manager,
    resolve_user_profile,
    generate_unique_registered_id,
    find_user_by_identifier,
    normalize_email,
    MANAGER_EMAILS,
    STAFF_EMAILS,
    clear_token_cache,
)
from app.config import SUPABASE_KEY, SUPABASE_URL
from app.database import get_supabase_admin_client

router = APIRouter()


class LoginRequest(BaseModel):
    identifier: Optional[str] = None
    email: Optional[str] = None
    password: str
    portal: Optional[str] = "citizen"
    full_name: Optional[str] = None
    place: Optional[str] = None


class CitizenRegisterRequest(BaseModel):
    full_name: str
    place_ward: str
    email: EmailStr
    password: str
    confirm_password: str


class StaffRegisterRequest(BaseModel):
    full_name: str
    place_municipality: str
    email: EmailStr
    password: str
    confirm_password: str
    organization: str
    district: str
    designation: str


class ManagerRegisterRequest(BaseModel):
    full_name: str
    place_municipality: str
    email: EmailStr
    password: str
    confirm_password: str
    organization: str
    district: str
    designation: str


class SetupInitialManagerRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization: Optional[str] = "Municipal Headquarters"
    district: Optional[str] = "Central District"
    designation: Optional[str] = "Chief Administrator"
    setup_key: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None
    place: Optional[str] = None
    state: Optional[str] = None


class GoogleRegisterRequest(BaseModel):
    full_name: Optional[str] = None
    requested_role: Optional[Literal["citizen", "municipal_staff", "manager"]] = None
    organization: Optional[str] = None
    district: Optional[str] = None
    ward: Optional[str] = None
    place: Optional[str] = None
    state: Optional[str] = None


class ReviewApprovalRequest(BaseModel):
    user_id: str
    action: Literal["approve", "reject"]
    rejection_reason: Optional[str] = None


class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = None
    place: Optional[str] = None
    state: Optional[str] = None
    municipality: Optional[str] = None


class RoleAssignmentRequest(BaseModel):
    user_id: str
    role: Literal["citizen", "municipal_staff", "manager"]


@router.get("/me")
def get_current_user_profile(
    current_user: dict = Depends(get_authenticated_user),
):
    """
    Validate the session token and retrieve current user info, verified role,
    and approval status lifecycle.
    """

    return {
        "success": True,
        "user": {
            "id": current_user["user_id"],
            "email": current_user["email"],
            "full_name": current_user["full_name"],
            "role": current_user["role"],
            "requested_role": current_user.get("requested_role", current_user["role"]),
            "approval_status": current_user.get("approval_status", "approved"),
            "is_pending_approval": current_user.get("is_pending_approval", False),
            "place": current_user.get("place", ""),
            "state": current_user.get("state", ""),
            "municipality": current_user.get("municipality", ""),
            "organization": current_user.get("organization", "Central Municipality"),
            "district": current_user.get("district", "Central District"),
            "ward": current_user.get("ward", "Ward 1"),
            "organization_id": current_user.get("organization_id", "MUNICIPALITY-MAIN"),
            "designation": current_user.get("designation"),
            "staff_id": current_user.get("staff_id"),
            "manager_id": current_user.get("manager_id"),
            "is_profile_complete": current_user.get("is_profile_complete", True),
            "is_manager": current_user["is_manager"],
            "is_staff": current_user["is_staff"],
            "is_citizen": current_user["is_citizen"],
            "is_admin": current_user["is_admin"],
        },
    }


@router.post("/google-sync")
def sync_google_user(
    payload: Optional[GoogleRegisterRequest] = None,
    current_user: dict = Depends(get_authenticated_user),
):
    """
    Synchronize authenticated Google user profile without demoting or mutating
    verified role assignments in Supabase.
    """
    try:
        admin_client = get_supabase_admin_client()
        user_id = current_user["user_id"]
        raw_email = (current_user["email"] or "").strip().lower()
        user_email_normalized = normalize_email(raw_email)

        # Retrieve verified role, manager/staff flags, and approval status
        existing_role = current_user.get("role")
        is_manager = (
            current_user.get("is_manager", False)
            or existing_role == ROLE_MANAGER
            or user_email_normalized in MANAGER_EMAILS
            or raw_email in MANAGER_EMAILS
            or bool(current_user.get("manager_id") and current_user.get("approval_status") == "approved")
        )
        is_staff = (
            current_user.get("is_staff", False)
            or existing_role == ROLE_STAFF
            or user_email_normalized in STAFF_EMAILS
            or raw_email in STAFF_EMAILS
            or bool(current_user.get("staff_id") and current_user.get("approval_status") == "approved")
        )
        is_pending = (
            current_user.get("is_pending_approval", False)
            or current_user.get("approval_status") == "pending"
        )

        # Preserve existing verified role and prevent accidental demotion
        if is_manager:
            effective_role = ROLE_MANAGER
            appr_status = "approved"
            req_role = ROLE_MANAGER
        elif is_staff:
            effective_role = ROLE_STAFF
            appr_status = "approved"
            req_role = ROLE_STAFF
        elif is_pending:
            effective_role = ROLE_CITIZEN
            appr_status = "pending"
            req_role = current_user.get("requested_role") or (payload.requested_role if payload and payload.requested_role else "municipal_staff")
        elif payload and payload.requested_role in (ROLE_STAFF, ROLE_MANAGER) and existing_role not in (ROLE_STAFF, ROLE_MANAGER):
            # Explicit request during registration
            effective_role = ROLE_CITIZEN
            appr_status = "pending"
            req_role = payload.requested_role
        else:
            effective_role = existing_role if existing_role in (ROLE_CITIZEN, ROLE_STAFF, ROLE_MANAGER) else ROLE_CITIZEN
            appr_status = current_user.get("approval_status", "approved")
            req_role = current_user.get("requested_role") or effective_role

        full_name = (payload.full_name.strip() if payload and payload.full_name else current_user.get("full_name")) or raw_email.split("@")[0].title()
        org_name = (payload.organization.strip() if payload and payload.organization else current_user.get("organization")) or "Central Municipality"
        dist_name = (payload.district.strip() if payload and payload.district else current_user.get("district")) or "Central District"
        ward_name = (payload.ward.strip() if payload and payload.ward else current_user.get("ward")) or "Ward 1"
        place_name = (payload.place.strip() if payload and payload.place else current_user.get("place")) or dist_name
        state_name = (payload.state.strip() if payload and payload.state else current_user.get("state")) or ""

        # Fetch existing Auth metadata to safely preserve provider & other attributes
        target_u = None
        existing_app_meta = {}
        existing_user_meta = {}
        try:
            target_u = admin_client.auth.admin.get_user_by_id(user_id)
            if target_u and getattr(target_u, "user", None):
                existing_app_meta = getattr(target_u.user, "app_metadata", {}) or {}
                existing_user_meta = getattr(target_u.user, "user_metadata", {}) or {}
        except Exception:
            pass

        # Prepare app_metadata updates
        updated_app_meta = {
            **existing_app_meta,
            "role": effective_role,
            "requested_role": req_role,
            "approval_status": appr_status,
        }

        # Preserve or generate IDs
        assigned_mgr_id = existing_app_meta.get("manager_id") or current_user.get("manager_id") or existing_user_meta.get("manager_id")
        assigned_stf_id = existing_app_meta.get("staff_id") or current_user.get("staff_id") or existing_user_meta.get("staff_id")

        if effective_role == ROLE_MANAGER:
            if not assigned_mgr_id:
                assigned_mgr_id = generate_unique_registered_id(ROLE_MANAGER)
            updated_app_meta["manager_id"] = assigned_mgr_id
        elif effective_role == ROLE_STAFF:
            if not assigned_stf_id:
                assigned_stf_id = generate_unique_registered_id(ROLE_STAFF)
            updated_app_meta["staff_id"] = assigned_stf_id

        updated_user_meta = {
            **existing_user_meta,
            "full_name": full_name or existing_user_meta.get("full_name") or existing_user_meta.get("name"),
            "name": full_name or existing_user_meta.get("name"),
            "requested_role": req_role,
            "organization": org_name,
            "district": dist_name,
            "ward": ward_name,
            "place": place_name,
            "state": state_name,
        }
        if assigned_mgr_id and effective_role == ROLE_MANAGER:
            updated_user_meta["manager_id"] = assigned_mgr_id
        if assigned_stf_id and effective_role == ROLE_STAFF:
            updated_user_meta["staff_id"] = assigned_stf_id

        # Update Supabase Auth app_metadata & user_metadata
        try:
            admin_client.auth.admin.update_user_by_id(
                user_id,
                {
                    "app_metadata": updated_app_meta,
                    "user_metadata": updated_user_meta,
                }
            )
        except Exception as e:
            print("AUTH METADATA SYNC WARNING:", repr(e))

        # Clear session token cache so subsequent requests get updated data
        clear_token_cache()

        # Attempt to upsert into user_profiles table if it exists
        try:
            profile_upsert = {
                "user_id": user_id,
                "email": raw_email,
                "full_name": full_name,
                "role": effective_role,
                "requested_role": req_role,
                "approval_status": appr_status,
                "organization": org_name,
                "district": dist_name,
                "ward": ward_name,
                "place": place_name,
                "state": state_name,
            }
            if assigned_mgr_id and effective_role == ROLE_MANAGER:
                profile_upsert["manager_id"] = assigned_mgr_id
            if assigned_stf_id and effective_role == ROLE_STAFF:
                profile_upsert["staff_id"] = assigned_stf_id

            admin_client.table("user_profiles").upsert(profile_upsert, on_conflict="user_id").execute()
        except Exception:
            pass

        return {
            "success": True,
            "message": (
                "Manager session verified."
                if effective_role == ROLE_MANAGER
                else (
                    "Municipal Staff session verified."
                    if effective_role == ROLE_STAFF and appr_status == "approved"
                    else (
                        "Registration awaiting Manager approval."
                        if appr_status == "pending"
                        else "Citizen session verified."
                    )
                )
            ),
            "user": {
                "id": user_id,
                "email": current_user["email"],
                "full_name": full_name,
                "role": effective_role,
                "requested_role": req_role,
                "approval_status": appr_status,
                "is_pending_approval": appr_status == "pending",
                "staff_id": assigned_stf_id if effective_role == ROLE_STAFF else None,
                "manager_id": assigned_mgr_id if effective_role == ROLE_MANAGER else None,
                "place": place_name,
                "state": state_name,
                "municipality": org_name,
                "organization": org_name,
                "district": dist_name,
                "ward": ward_name,
                "organization_id": current_user.get("organization_id", "MUNICIPALITY-MAIN"),
                "is_profile_complete": True,
                "is_manager": effective_role == ROLE_MANAGER,
                "is_staff": effective_role == ROLE_STAFF,
                "is_citizen": effective_role == ROLE_CITIZEN,
            },
        }

    except Exception as exc:
        print("GOOGLE SYNC ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to synchronize Google user profile.",
        ) from exc


@router.get("/pending-approvals")
def get_pending_approvals(
    current_manager: dict = Depends(require_manager),
):
    """
    Managers only: Retrieve all pending staff and manager registration requests.
    """
    try:
        admin_client = get_supabase_admin_client()
        pending_list = []

        # 1. Check user_profiles table first
        try:
            res = (
                admin_client.table("user_profiles")
                .select("*")
                .eq("approval_status", "pending")
                .order("created_at", desc=True)
                .execute()
            )
            if res.data:
                for row in res.data:
                    pending_list.append({
                        "user_id": row.get("user_id"),
                        "email": row.get("email"),
                        "full_name": row.get("full_name") or row.get("email"),
                        "requested_role": row.get("requested_role") or "municipal_staff",
                        "organization": row.get("organization") or "Central Municipality",
                        "district": row.get("district") or "Central District",
                        "ward": row.get("ward") or "Ward 1",
                        "created_at": row.get("created_at"),
                    })
        except Exception:
            pass

        # 2. Check auth.users list for pending metadata if not in user_profiles
        if not pending_list:
            users_res = admin_client.auth.admin.list_users()
            all_users = users_res.users if hasattr(users_res, "users") else users_res
            for u in all_users:
                app_meta = getattr(u, "app_metadata", {}) or {}
                user_meta = getattr(u, "user_metadata", {}) or {}
                if app_meta.get("approval_status") == "pending":
                    pending_list.append({
                        "user_id": str(u.id),
                        "email": u.email,
                        "full_name": user_meta.get("full_name") or user_meta.get("name") or u.email.split("@")[0].title(),
                        "requested_role": app_meta.get("requested_role") or user_meta.get("requested_role") or "municipal_staff",
                        "organization": user_meta.get("organization") or "Central Municipality",
                        "district": user_meta.get("district") or "Central District",
                        "ward": user_meta.get("ward") or "Ward 1",
                        "created_at": getattr(u, "created_at", None),
                    })

        return {
            "success": True,
            "count": len(pending_list),
            "pending_approvals": pending_list,
        }

    except Exception as exc:
        print("PENDING APPROVALS ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to retrieve pending approvals.",
        ) from exc


@router.post("/review-approval")
def review_role_approval(
    payload: ReviewApprovalRequest,
    current_manager: dict = Depends(require_manager),
):
    """
    Managers only: Approve or Reject a pending registration request.
    On approval: Upgrades role to the requested tier, assigns a unique Registered ID,
                 and updates Supabase Auth and database.
    On rejection: Reverts role to citizen with rejected status.
    """
    try:
        admin_client = get_supabase_admin_client()
        target_user_id = payload.user_id

        # Fetch target user from Auth
        user_obj = admin_client.auth.admin.get_user_by_id(target_user_id)
        if not user_obj or not user_obj.user:
            raise HTTPException(status_code=404, detail="User account not found.")

        target_u = user_obj.user
        app_meta = getattr(target_u, "app_metadata", {}) or {}
        user_meta = getattr(target_u, "user_metadata", {}) or {}

        requested_role = app_meta.get("requested_role") or user_meta.get("requested_role") or ROLE_STAFF
        assigned_id = None

        if payload.action == "approve":
            new_role = requested_role
            new_status = "approved"
            if new_role == ROLE_STAFF:
                assigned_id = app_meta.get("staff_id") or user_meta.get("staff_id") or generate_unique_registered_id(ROLE_STAFF)
                msg = f"User approved as Municipal Staff successfully. Assigned Staff ID: {assigned_id}"
            elif new_role == ROLE_MANAGER:
                assigned_id = app_meta.get("manager_id") or user_meta.get("manager_id") or generate_unique_registered_id(ROLE_MANAGER)
                msg = f"User approved as Manager successfully. Assigned Manager ID: {assigned_id}"
            else:
                msg = f"User approved as {new_role} successfully."
        else:
            new_role = ROLE_CITIZEN
            new_status = "rejected"
            msg = f"Registration request for {requested_role} was rejected."

        # Update Supabase Auth app_metadata & user_metadata
        updated_app_meta = {
            **app_meta,
            "role": new_role,
            "approval_status": new_status,
            "requested_role": requested_role,
        }
        updated_user_meta = {**user_meta}

        if assigned_id:
            if new_role == ROLE_STAFF:
                updated_app_meta["staff_id"] = assigned_id
                updated_user_meta["staff_id"] = assigned_id
            elif new_role == ROLE_MANAGER:
                updated_app_meta["manager_id"] = assigned_id
                updated_user_meta["manager_id"] = assigned_id

        admin_client.auth.admin.update_user_by_id(
            target_user_id,
            {
                "app_metadata": updated_app_meta,
                "user_metadata": updated_user_meta,
            },
        )

        # Update user_profiles table if available
        try:
            update_data = {
                "role": new_role,
                "approval_status": new_status,
                "approved_by": current_manager["user_id"],
                "rejection_reason": payload.rejection_reason if payload.action == "reject" else None,
            }
            if assigned_id:
                if new_role == ROLE_STAFF:
                    update_data["staff_id"] = assigned_id
                elif new_role == ROLE_MANAGER:
                    update_data["manager_id"] = assigned_id

            admin_client.table("user_profiles").update(update_data).eq("user_id", target_user_id).execute()
        except Exception:
            pass

        clear_token_cache()

        return {
            "success": True,
            "message": msg,
            "user_id": target_user_id,
            "role": new_role,
            "assigned_id": assigned_id,
            "approval_status": new_status,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("REVIEW APPROVAL ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update approval status.",
        ) from exc


@router.post("/profile")
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: dict = Depends(get_authenticated_user),
):
    """
    Update profile details (full_name, place, state) for the current user.
    Role elevation is strictly impossible through this endpoint.
    """
    try:
        admin_client = get_supabase_admin_client()
        user_id = current_user["user_id"]

        # 1. Update Auth user_metadata
        existing_user = admin_client.auth.admin.get_user_by_id(user_id)
        current_meta = getattr(existing_user.user, "user_metadata", {}) or {}

        updated_meta = {**current_meta}
        if payload.full_name is not None and payload.full_name.strip():
            updated_meta["full_name"] = payload.full_name.strip()
        if payload.place is not None:
            updated_meta["place"] = payload.place.strip()
            updated_meta["municipality"] = payload.place.strip()
        if payload.state is not None:
            updated_meta["state"] = payload.state.strip()
        if payload.municipality is not None:
            updated_meta["municipality"] = payload.municipality.strip()

        admin_client.auth.admin.update_user_by_id(
            user_id,
            {"user_metadata": updated_meta},
        )

        # 2. Update user_profiles table if it exists
        try:
            profile_update = {}
            if payload.full_name:
                profile_update["full_name"] = payload.full_name.strip()
            if payload.place:
                profile_update["place"] = payload.place.strip()
            if payload.state:
                profile_update["state"] = payload.state.strip()

            if profile_update:
                admin_client.table("user_profiles").update(profile_update).eq("user_id", user_id).execute()
        except Exception:
            pass

        is_complete = bool(
            updated_meta.get("full_name")
            and updated_meta.get("place")
            and updated_meta.get("state")
        ) if current_user["role"] == ROLE_CITIZEN else True

        return {
            "success": True,
            "message": "Profile updated successfully.",
            "user": {
                "id": user_id,
                "email": current_user["email"],
                "full_name": updated_meta.get("full_name", current_user["full_name"]),
                "role": current_user["role"],
                "place": updated_meta.get("place", ""),
                "state": updated_meta.get("state", ""),
                "municipality": updated_meta.get("municipality", ""),
                "organization_id": current_user.get("organization_id", "MUNICIPALITY-MAIN"),
                "is_profile_complete": is_complete,
                "is_manager": current_user["is_manager"],
                "is_staff": current_user["is_staff"],
                "is_citizen": current_user["is_citizen"],
            },
        }

    except Exception as exc:
        print("UPDATE PROFILE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update profile details.",
        ) from exc


@router.post("/login")
def login(request: LoginRequest):
    """
    Sign in an authorized user using Supabase Authentication.
    Supports:
    1. Email and Password
    2. Registered Staff ID (e.g. STF-XXXXX) and Password
    3. Registered Manager ID (e.g. MGR-XXXXX) and Password
    Strictly enforces role authorization and pending approval checks.
    """
    clean_identifier = (request.identifier or request.email or "").strip()
    if not clean_identifier:
        raise HTTPException(
            status_code=400,
            detail="Please provide an email address or Registered ID.",
        )

    target_email = clean_identifier.lower()

    # If identifier is not an email, look up registered account by Staff/Manager ID
    if "@" not in clean_identifier:
        user_record = find_user_by_identifier(clean_identifier)
        if not user_record or not getattr(user_record, "email", None):
            raise HTTPException(
                status_code=401,
                detail=f"Registered ID '{clean_identifier}' was not found. Please verify your ID or log in with your email.",
            )
        target_email = user_record.email.lower()

    try:
        supabase_client = create_client(
            SUPABASE_URL,
            SUPABASE_KEY,
        )

        response = supabase_client.auth.sign_in_with_password(
            {
                "email": target_email,
                "password": request.password,
            }
        )

        if response.user is None or response.session is None:
            raise HTTPException(
                status_code=401,
                detail="Login failed. Check your email/ID and password.",
            )

        user_email = (response.user.email or "").strip().lower()
        user_email_normalized = normalize_email(user_email)
        app_meta = response.user.app_metadata or {}
        user_meta = response.user.user_metadata or {}
        user_id = str(response.user.id)

        # Secure role resolution from backend and metadata
        profile = resolve_user_profile(user_id, user_email, user_meta, app_meta)

        # Super-admin check
        if (
            user_email_normalized in MANAGER_EMAILS
            or user_email in MANAGER_EMAILS
            or app_meta.get("role") in ("manager", "admin")
            or profile.get("db_role") == ROLE_MANAGER
        ):
            role = ROLE_MANAGER
            approval_status = "approved"
            requested_role = ROLE_MANAGER
        elif (
            app_meta.get("role") in ("municipal_staff", "staff")
            or profile.get("db_role") == ROLE_STAFF
            or user_email_normalized in STAFF_EMAILS
        ):
            role = ROLE_STAFF
            approval_status = "approved"
            requested_role = ROLE_STAFF
        elif profile.get("approval_status") == "pending" or app_meta.get("approval_status") == "pending":
            role = ROLE_CITIZEN
            requested_role = profile.get("requested_role") or app_meta.get("requested_role") or ROLE_CITIZEN
            approval_status = "pending"
        else:
            role = ROLE_CITIZEN
            requested_role = ROLE_CITIZEN
            approval_status = "approved"

        # Portal authorization guard checks
        portal = (request.portal or "citizen").lower()

        # Check pending approval
        if approval_status == "pending":
            if portal in ("municipal_staff", "staff"):
                raise HTTPException(
                    status_code=403,
                    detail="Your Municipal Staff registration has been submitted. Your account is awaiting Manager approval.",
                )
            elif portal == "manager":
                raise HTTPException(
                    status_code=403,
                    detail="Your Manager registration request has been submitted for authorization.",
                )

        # Strict Role authorization per Portal
        if portal in ("citizen", "user") and role != ROLE_CITIZEN:
            portal_name = "Operations Manager" if role == ROLE_MANAGER else "Municipal Staff"
            raise HTTPException(
                status_code=403,
                detail=f"Access Denied: This portal is for Citizens. Your account is registered as {portal_name}. Please sign in via your authorized portal.",
            )

        if portal in ("municipal_staff", "staff") and role != ROLE_STAFF:
            if role == ROLE_MANAGER:
                raise HTTPException(
                    status_code=403,
                    detail="Access Denied: Your account is registered as an Operations Manager. Please sign in via the Manager portal.",
                )
            else:
                raise HTTPException(
                    status_code=403,
                    detail="Your account is not registered as Municipal Staff. Please contact your Manager.",
                )

        if portal == "manager" and role != ROLE_MANAGER:
            raise HTTPException(
                status_code=403,
                detail="Your account is not registered as a Manager. Access forbidden.",
            )

        full_name = profile.get("full_name") or (
            user_meta.get("full_name")
            or user_meta.get("name")
            or user_email.split("@")[0].replace(".", " ").title()
        )

        # Optional update if user passed name or place on login card
        if (request.full_name and not profile.get("full_name")) or (request.place and not profile.get("place")):
            try:
                admin_client = get_supabase_admin_client()
                updated_meta = {**user_meta}
                if request.full_name:
                    updated_meta["full_name"] = request.full_name.strip()
                if request.place:
                    updated_meta["place"] = request.place.strip()
                admin_client.auth.admin.update_user_by_id(user_id, {"user_metadata": updated_meta})
            except Exception:
                pass

        return {
            "success": True,
            "message": "Login successful.",
            "user": {
                "id": user_id,
                "email": response.user.email,
                "full_name": full_name,
                "role": role,
                "requested_role": requested_role,
                "approval_status": approval_status,
                "is_pending_approval": approval_status == "pending",
                "staff_id": profile.get("staff_id"),
                "manager_id": profile.get("manager_id"),
                "designation": profile.get("designation"),
                "place": profile.get("place") or user_meta.get("place", ""),
                "state": profile.get("state") or user_meta.get("state", ""),
                "municipality": profile.get("municipality", ""),
                "organization": profile.get("organization", "Central Municipality"),
                "district": profile.get("district", "Central District"),
                "ward": profile.get("ward", "Ward 1"),
                "is_profile_complete": bool(full_name and (profile.get("place") or user_meta.get("place"))),
                "is_manager": role == ROLE_MANAGER,
                "is_staff": role == ROLE_STAFF,
                "is_citizen": role == ROLE_CITIZEN,
                "is_admin": role == ROLE_MANAGER,
            },
            "access_token": response.session.access_token,
            "token_type": "bearer",
            "expires_in": response.session.expires_in,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("LOGIN ERROR:", repr(exc))
        raise HTTPException(
            status_code=401,
            detail="Login failed. Check your email/ID and password.",
        )


@router.post("/register-citizen")
def register_citizen(request: CitizenRegisterRequest):
    """
    Citizen Registration:
    - Verifies details & password match.
    - Creates citizen account in Supabase Auth.
    - Auto-approves role as 'citizen'.
    - Returns success message and session.
    """
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if len(request.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long.",
        )

    clean_email = request.email.strip().lower()

    try:
        admin_client = get_supabase_admin_client()

        # Create or register user in Supabase Auth with auto-confirmed email
        user_meta = {
            "full_name": request.full_name.strip(),
            "name": request.full_name.strip(),
            "place": request.place_ward.strip(),
            "ward": request.place_ward.strip(),
            "role": ROLE_CITIZEN,
            "requested_role": ROLE_CITIZEN,
        }
        app_meta = {
            "role": ROLE_CITIZEN,
            "requested_role": ROLE_CITIZEN,
            "approval_status": "approved",
        }

        user_res = admin_client.auth.admin.create_user({
            "email": clean_email,
            "password": request.password,
            "email_confirm": True,
            "user_metadata": user_meta,
            "app_metadata": app_meta,
        })

        if not user_res or not user_res.user:
            raise HTTPException(
                status_code=400,
                detail="Could not create Citizen account. Please check the email.",
            )

        new_user = user_res.user

        # Upsert into user_profiles table if available
        try:
            admin_client.table("user_profiles").upsert({
                "user_id": str(new_user.id),
                "email": clean_email,
                "full_name": request.full_name.strip(),
                "role": ROLE_CITIZEN,
                "requested_role": ROLE_CITIZEN,
                "approval_status": "approved",
                "ward": request.place_ward.strip(),
                "place": request.place_ward.strip(),
            }, on_conflict="user_id").execute()
        except Exception:
            pass

        # Also sign in to return token immediately
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        auth_session = supabase_client.auth.sign_in_with_password({
            "email": clean_email,
            "password": request.password,
        })

        return {
            "success": True,
            "message": "Your Citizen account has been created successfully.",
            "user": {
                "id": str(new_user.id),
                "email": clean_email,
                "full_name": request.full_name.strip(),
                "role": ROLE_CITIZEN,
                "place": request.place_ward.strip(),
                "ward": request.place_ward.strip(),
                "approval_status": "approved",
                "is_citizen": True,
                "is_staff": False,
                "is_manager": False,
            },
            "access_token": auth_session.session.access_token if auth_session.session else None,
            "token_type": "bearer",
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("CITIZEN REGISTER ERROR:", repr(exc))
        err_str = str(exc)
        if "already registered" in err_str or "already exists" in err_str:
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists. Please log in.",
            )
        raise HTTPException(
            status_code=400,
            detail="Registration failed. Please check your email and password.",
        )


@router.post("/register-staff")
def register_staff(request: StaffRegisterRequest):
    """
    Municipal Staff Registration:
    - Verifies details & password match.
    - Creates registration request in Supabase Auth with approval_status = 'pending'.
    - Does NOT grant municipal_staff role immediately.
    - Awaiting Manager approval.
    """
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if len(request.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long.",
        )

    clean_email = request.email.strip().lower()

    try:
        admin_client = get_supabase_admin_client()

        user_meta = {
            "full_name": request.full_name.strip(),
            "name": request.full_name.strip(),
            "place": request.place_municipality.strip(),
            "municipality": request.place_municipality.strip(),
            "organization": request.organization.strip(),
            "district": request.district.strip(),
            "designation": request.designation.strip(),
            "requested_role": ROLE_STAFF,
        }
        app_meta = {
            "role": ROLE_CITIZEN,  # Secure: Citizen until Manager approves
            "requested_role": ROLE_STAFF,
            "approval_status": "pending",
        }

        user_res = admin_client.auth.admin.create_user({
            "email": clean_email,
            "password": request.password,
            "email_confirm": True,
            "user_metadata": user_meta,
            "app_metadata": app_meta,
        })

        if not user_res or not user_res.user:
            raise HTTPException(
                status_code=400,
                detail="Could not create Staff registration. Please check the email.",
            )

        new_user = user_res.user

        # Upsert into user_profiles table if available
        try:
            admin_client.table("user_profiles").upsert({
                "user_id": str(new_user.id),
                "email": clean_email,
                "full_name": request.full_name.strip(),
                "role": ROLE_CITIZEN,
                "requested_role": ROLE_STAFF,
                "approval_status": "pending",
                "organization": request.organization.strip(),
                "district": request.district.strip(),
                "designation": request.designation.strip(),
                "place": request.place_municipality.strip(),
            }, on_conflict="user_id").execute()
        except Exception:
            pass

        return {
            "success": True,
            "message": "Your Municipal Staff registration has been submitted. Your account is awaiting Manager approval.",
            "user": {
                "id": str(new_user.id),
                "email": clean_email,
                "full_name": request.full_name.strip(),
                "requested_role": ROLE_STAFF,
                "approval_status": "pending",
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("STAFF REGISTER ERROR:", repr(exc))
        err_str = str(exc)
        if "already registered" in err_str or "already exists" in err_str:
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists. Please log in.",
            )
        raise HTTPException(
            status_code=400,
            detail="Staff registration failed. Please check your details.",
        )


@router.post("/register-manager")
def register_manager(request: ManagerRegisterRequest):
    """
    Manager Registration:
    - Verifies details & password match.
    - Creates registration request in Supabase Auth with approval_status = 'pending'.
    - Does NOT grant manager permissions immediately.
    - Awaiting Administrator authorization.
    """
    if request.password != request.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="Passwords do not match.",
        )

    if len(request.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 6 characters long.",
        )

    clean_email = request.email.strip().lower()

    try:
        admin_client = get_supabase_admin_client()

        user_meta = {
            "full_name": request.full_name.strip(),
            "name": request.full_name.strip(),
            "place": request.place_municipality.strip(),
            "municipality": request.place_municipality.strip(),
            "organization": request.organization.strip(),
            "district": request.district.strip(),
            "designation": request.designation.strip(),
            "requested_role": ROLE_MANAGER,
        }
        app_meta = {
            "role": ROLE_CITIZEN,  # Secure: Citizen until authorized
            "requested_role": ROLE_MANAGER,
            "approval_status": "pending",
        }

        user_res = admin_client.auth.admin.create_user({
            "email": clean_email,
            "password": request.password,
            "email_confirm": True,
            "user_metadata": user_meta,
            "app_metadata": app_meta,
        })

        if not user_res or not user_res.user:
            raise HTTPException(
                status_code=400,
                detail="Could not create Manager registration request.",
            )

        new_user = user_res.user

        # Upsert into user_profiles table if available
        try:
            admin_client.table("user_profiles").upsert({
                "user_id": str(new_user.id),
                "email": clean_email,
                "full_name": request.full_name.strip(),
                "role": ROLE_CITIZEN,
                "requested_role": ROLE_MANAGER,
                "approval_status": "pending",
                "organization": request.organization.strip(),
                "district": request.district.strip(),
                "designation": request.designation.strip(),
                "place": request.place_municipality.strip(),
            }, on_conflict="user_id").execute()
        except Exception:
            pass

        return {
            "success": True,
            "message": "Your Manager registration request has been submitted for authorization.",
            "user": {
                "id": str(new_user.id),
                "email": clean_email,
                "full_name": request.full_name.strip(),
                "requested_role": ROLE_MANAGER,
                "approval_status": "pending",
            },
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("MANAGER REGISTER ERROR:", repr(exc))
        err_str = str(exc)
        if "already registered" in err_str or "already exists" in err_str:
            raise HTTPException(
                status_code=400,
                detail="An account with this email already exists. Please log in.",
            )
        raise HTTPException(
            status_code=400,
            detail="Manager registration failed. Please check your details.",
        )


@router.post("/setup-initial-manager")
def setup_initial_manager(request: SetupInitialManagerRequest):
    """
    Secure Initial Manager Setup:
    - Provides a server-side initial Manager setup process using administrator credentials.
    - Generates a unique Registered Manager ID.
    - Sets confirmed status and role = 'manager'.
    """
    clean_email = request.email.strip().lower()
    clean_email_normalized = normalize_email(clean_email)

    # Security check: must match designated manager email or have valid setup key
    is_preconfigured = (
        clean_email_normalized in MANAGER_EMAILS
        or clean_email in MANAGER_EMAILS
    )

    if not is_preconfigured and request.setup_key != "AWM_INITIAL_SETUP_2026":
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: Setup key invalid and email is not in designated manager list.",
        )

    try:
        admin_client = get_supabase_admin_client()
        unique_mgr_id = generate_unique_registered_id(ROLE_MANAGER)

        # Check if user already exists
        target_user = None
        for u in admin_client.auth.admin.list_users():
            if (u.email or "").strip().lower() == clean_email:
                target_user = u
                break

        user_meta = {
            "full_name": request.full_name.strip(),
            "name": request.full_name.strip(),
            "organization": request.organization,
            "district": request.district,
            "designation": request.designation,
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
            admin_client.auth.admin.update_user_by_id(
                str(target_user.id),
                {
                    "password": request.password,
                    "email_confirm": True,
                    "app_metadata": app_meta,
                    "user_metadata": user_meta,
                },
            )
            user_id = str(target_user.id)
        else:
            created = admin_client.auth.admin.create_user({
                "email": clean_email,
                "password": request.password,
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
                "full_name": request.full_name.strip(),
                "role": ROLE_MANAGER,
                "requested_role": ROLE_MANAGER,
                "approval_status": "approved",
                "manager_id": unique_mgr_id,
                "organization": request.organization,
                "district": request.district,
                "designation": request.designation,
            }, on_conflict="user_id").execute()
        except Exception:
            pass

        return {
            "success": True,
            "message": f"Initial Manager account configured successfully. Manager ID: {unique_mgr_id}",
            "manager_id": unique_mgr_id,
            "email": clean_email,
            "role": ROLE_MANAGER,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("SETUP INITIAL MANAGER ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to setup initial manager account.",
        )


@router.post("/register")
def register(request: RegisterRequest):
    """
    Backward-compatible Citizen registration endpoint.
    """
    return register_citizen(
        CitizenRegisterRequest(
            full_name=request.full_name or request.email.split("@")[0].title(),
            place_ward=request.place or "Ward 1",
            email=request.email,
            password=request.password,
            confirm_password=request.password,
        )
    )


@router.get("/staff-list")
def get_municipal_staff_list(
    current_manager: dict = Depends(require_manager),
):
    """
    Managers only: Retrieve available municipal staff members for report assignment.
    """

    try:
        admin_client = get_supabase_admin_client()
        users_result = admin_client.auth.admin.list_users()
        all_users = users_result.users if hasattr(users_result, "users") else users_result

        staff_members = []
        for u in all_users:
            u_email = (u.email or "").strip().lower()
            app_meta = getattr(u, "app_metadata", {}) or {}
            user_meta = getattr(u, "user_metadata", {}) or {}

            is_staff = (
                app_meta.get("role") in ("municipal_staff", "staff")
                or u_email in STAFF_EMAILS
            )

            if is_staff:
                full_name = (
                    user_meta.get("full_name")
                    or user_meta.get("name")
                    or u_email.split("@")[0].replace(".", " ").title()
                )
                staff_members.append({
                    "id": str(u.id),
                    "email": u.email,
                    "name": full_name,
                    "staff_id": app_meta.get("staff_id") or user_meta.get("staff_id") or None,
                    "designation": user_meta.get("designation") or "Municipal Field Staff",
                    "municipality": user_meta.get("municipality") or user_meta.get("place") or "Main Municipality",
                    "role": ROLE_STAFF,
                })

        # Ensure active staff are listed
        if not staff_members:
            staff_members.append({
                "id": "staff-default-01",
                "email": "staff@awm.gov",
                "name": "Marcus Chen (Sanitation Crew A)",
                "staff_id": "STF-50101",
                "designation": "Sanitation Lead",
                "municipality": "Central Municipality",
                "role": ROLE_STAFF,
            })

        return {
            "success": True,
            "count": len(staff_members),
            "staff": staff_members,
        }

    except Exception as exc:
        print("STAFF LIST ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve municipal staff list.",
        ) from exc


@router.post("/assign-role")
def assign_user_role(
    payload: RoleAssignmentRequest,
    current_manager: dict = Depends(require_manager),
):
    """
    Managers only: Update a user's role in Supabase Auth app_metadata and user_profiles.
    """

    try:
        admin_client = get_supabase_admin_client()
        target_u = admin_client.auth.admin.get_user_by_id(payload.user_id)
        existing_app_meta = getattr(target_u.user, "app_metadata", {}) or {} if target_u and getattr(target_u, "user", None) else {}
        existing_user_meta = getattr(target_u.user, "user_metadata", {}) or {} if target_u and getattr(target_u, "user", None) else {}

        updated_app_meta = {
            **existing_app_meta,
            "role": payload.role,
            "approval_status": "approved",
            "requested_role": payload.role,
        }
        updated_user_meta = {
            **existing_user_meta,
            "role": payload.role,
            "requested_role": payload.role,
        }

        assigned_id = None
        if payload.role == ROLE_STAFF:
            assigned_id = existing_app_meta.get("staff_id") or existing_user_meta.get("staff_id") or generate_unique_registered_id(ROLE_STAFF)
            updated_app_meta["staff_id"] = assigned_id
            updated_user_meta["staff_id"] = assigned_id
        elif payload.role == ROLE_MANAGER:
            assigned_id = existing_app_meta.get("manager_id") or existing_user_meta.get("manager_id") or generate_unique_registered_id(ROLE_MANAGER)
            updated_app_meta["manager_id"] = assigned_id
            updated_user_meta["manager_id"] = assigned_id

        res = admin_client.auth.admin.update_user_by_id(
            payload.user_id,
            {
                "app_metadata": updated_app_meta,
                "user_metadata": updated_user_meta,
            },
        )

        clear_token_cache()

        # Update in user_profiles table if present
        try:
            update_data = {"role": payload.role, "approval_status": "approved"}
            if assigned_id:
                if payload.role == ROLE_STAFF:
                    update_data["staff_id"] = assigned_id
                elif payload.role == ROLE_MANAGER:
                    update_data["manager_id"] = assigned_id
            admin_client.table("user_profiles").update(update_data).eq("user_id", payload.user_id).execute()
        except Exception:
            pass

        return {
            "success": True,
            "message": f"User role updated to '{payload.role}'.",
            "user_id": str(res.user.id),
            "role": payload.role,
            "assigned_id": assigned_id,
        }

    except Exception as exc:
        print("ASSIGN ROLE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update user role.",
        ) from exc