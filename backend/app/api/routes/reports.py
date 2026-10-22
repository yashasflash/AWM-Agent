import os
from datetime import datetime, timezone
import time
from typing import Any, Literal, Optional
from uuid import UUID, uuid4

import httpx
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from pydantic import BaseModel, EmailStr, Field
from postgrest.exceptions import APIError

from app.auth.security import (
    get_authenticated_admin_user,
    get_authenticated_user,
    require_citizen,
    require_manager,
    require_staff,
)
from app.database import (
    get_supabase_admin_client,
    get_supabase_client,
)
from app.schemas.report import WasteReportCreate
from app.services.notification_service import create_notification


router = APIRouter()


# =========================================================
# CONFIGURATION & SCHEMAS
# =========================================================

N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "http://localhost:5678/webhook/awm-waste-report",
)

ALLOWED_PRIORITIES = {
    "LOW",
    "MEDIUM",
    "HIGH",
}


class ReportStatusUpdate(BaseModel):
    status: Literal["Submitted", "Under Review", "In Progress", "Resolved", "Rejected"]
    department: Optional[str] = None
    admin_note: Optional[str] = None
    priority: Optional[str] = None


class ReportAssignment(BaseModel):
    staff_email: EmailStr
    staff_name: Optional[str] = None
    department: Optional[str] = "Solid Waste Management"
    priority: Optional[str] = None
    manager_note: Optional[str] = None


class StaffStatusUpdate(BaseModel):
    status: Literal["In Progress", "Resolved"]
    staff_note: Optional[str] = None


class StaffSubmitResolution(BaseModel):
    staff_note: str = Field(..., min_length=2, max_length=1500)
    photo_url: Optional[str] = None
    direct_resolve: bool = False


class ManagerVerifyResolution(BaseModel):
    action: Literal["approve", "reject"]
    manager_note: Optional[str] = None



# In-memory performance caches
_photo_url_cache: dict[str, tuple[str | None, float]] = {}
_manager_stats_cache: tuple[dict, float] | None = None
_citizen_stats_cache: dict[str, tuple[dict, float]] = {}


def resolve_photo_url(admin_supabase, photo_path: str | None) -> str | None:
    """Generate a temporary signed URL for a photo stored in Supabase storage with in-memory caching."""
    if not photo_path or photo_path == "string":
        return None
    if photo_path.startswith("http://") or photo_path.startswith("https://"):
        return photo_path

    now = time.time()
    if photo_path in _photo_url_cache:
        cached_url, expiry = _photo_url_cache[photo_path]
        if now < expiry:
            return cached_url

    try:
        res = admin_supabase.storage.from_("waste-photos").create_signed_url(photo_path, 3600)
        signed = res.get("signedURL") or res.get("signedUrl")
        if signed:
            _photo_url_cache[photo_path] = (signed, now + 3000.0)  # 50 min TTL
            return signed
        else:
            _photo_url_cache[photo_path] = (None, now + 300.0)  # 5 min negative TTL
            return None
    except Exception as exc:
        # Negative cache to prevent repeated 1.5s storage 404 delays on every report
        _photo_url_cache[photo_path] = (None, now + 300.0)
        return None


def is_valid_uuid(val: Any) -> bool:
    """Check if value is a valid UUID string."""
    try:
        UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def get_report_by_id_or_number(admin_supabase, report_id: str) -> dict | None:
    """Safely fetch a waste report by UUID or report number. Returns None if not found or invalid format."""
    clean_id = (report_id or "").strip()
    if clean_id.upper().startswith("WM-"):
        clean_id = clean_id[3:]

    try:
        if clean_id.isdigit():
            res = admin_supabase.table("waste_reports").select("*").eq("report_number", int(clean_id)).execute()
            return res.data[0] if (res.data and len(res.data) > 0) else None
        elif is_valid_uuid(clean_id):
            res = admin_supabase.table("waste_reports").select("*").eq("id", clean_id).execute()
            return res.data[0] if (res.data and len(res.data) > 0) else None
    except Exception as exc:
        print("GET REPORT SAFE FETCH ERROR:", repr(exc))
        return None
    return None


def check_report_assignment(report: dict, tasks: list[dict], user: dict) -> tuple[bool, dict | None]:
    """
    Check if a report or any of its collection tasks is assigned to the authenticated user.
    Evaluates:
      - Authenticated user ID (UUID)
      - User email (case-insensitive, whitespace-trimmed)
      - Registered Staff ID (e.g. STF-XXXXX)
      - User full name (in task title or assigned staff fields)
    Checks both collection_tasks (assigned_vehicle, task_title) and
    waste_reports assignment fields (assigned_staff_id, assigned_staff_email, assigned_staff).
    Returns (is_assigned: bool, matching_or_latest_task: dict | None)
    """
    user_id = str(user.get("user_id") or "").strip().lower()
    email = (user.get("email") or "").strip().lower()
    staff_id = (user.get("staff_id") or "").strip().lower()
    full_name = (user.get("full_name") or "").strip().lower()

    valid_ids = {x for x in (user_id, email, staff_id) if x}

    # 1. Check all associated collection tasks
    for t in tasks:
        veh = (t.get("assigned_vehicle") or "").strip().lower()
        if veh and (veh in valid_ids or (staff_id and staff_id in veh) or (user_id and user_id in veh)):
            return True, t
        title = (t.get("task_title") or "").strip().lower()
        if full_name and len(full_name) > 3 and full_name in title:
            return True, t

    # 2. Check direct fields on report (from schema migrations 001/002)
    rep_staff_id = str(report.get("assigned_staff_id") or "").strip().lower()
    rep_staff_email = (report.get("assigned_staff_email") or "").strip().lower()
    rep_staff = (report.get("assigned_staff") or "").strip().lower()

    if (rep_staff_id and rep_staff_id in valid_ids) or \
       (rep_staff_email and rep_staff_email in valid_ids) or \
       (rep_staff and rep_staff in valid_ids) or \
       (full_name and len(full_name) > 3 and full_name in rep_staff):
        return True, (tasks[0] if tasks else None)

    return False, (tasks[0] if tasks else None)


def get_report_organization(admin_supabase, report: dict) -> str:
    """Determine the organization ID for a report (from direct field or citizen profile)."""
    rep_org = str(report.get("organization_id") or "").strip().lower()
    if not rep_org and report.get("citizen_id"):
        try:
            c_user = admin_supabase.auth.admin.get_user_by_id(str(report["citizen_id"]))
            if c_user and c_user.user:
                c_meta = c_user.user.user_metadata or {}
                rep_org = str(c_meta.get("organization_id") or "MUNICIPALITY-MAIN").strip().lower()
        except Exception:
            rep_org = "municipality-main"
    return rep_org or "municipality-main"


def enrich_report_with_lifecycle(admin_supabase, report: dict, task: dict | None = None) -> dict:
    """Enrich a waste report with real lifecycle stage, timestamps, timeline, and staff assignment info."""
    import re

    if task is None:
        t_list = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).execute().data or []
        task = t_list[0] if t_list else None

    report["photo_signed_url"] = resolve_photo_url(admin_supabase, report.get("photo_url"))

    assigned_staff = None
    assigned_department = None
    assigned_instructions = None
    task_created_at = None
    accepted_at = None
    started_at = None
    resolution_submitted_at = None
    verified_at = None
    resolution_notes = None
    resolution_photo = None
    resolved_at = report.get("updated_at") if report.get("status") == "Resolved" else None

    if task:
        assigned_staff = task.get("assigned_vehicle")
        assigned_department = task.get("department")
        task_created_at = task.get("created_at")
        task_desc = task.get("description") or ""

        # Extract instructions (before any bracketed logs)
        if "\n[" in task_desc:
            assigned_instructions = task_desc.split("\n[")[0].strip()
        elif not task_desc.startswith("["):
            assigned_instructions = task_desc.strip()

        # Extract logged events
        acc_m = re.search(r'\[ACCEPTED\s+([^\]]+)\]', task_desc)
        if acc_m:
            accepted_at = acc_m.group(1).split(" by ")[0].strip()

        start_m = re.search(r'\[STARTED\s+([^\]]+)\]', task_desc)
        if start_m:
            started_at = start_m.group(1).split(" by ")[0].strip()

        res_m = re.search(r'\[(RESOLUTION_SUBMITTED|RESOLVED_DIRECT)\s+([^\]]+)\]:\s*([^\|]+)(?:\|\s*photo:\s*(.*))?', task_desc)
        if res_m:
            resolution_submitted_at = res_m.group(2).split(" by ")[0].strip()
            resolution_notes = res_m.group(3).strip()
            photo_cand = res_m.group(4).strip() if res_m.group(4) else None
            if photo_cand and photo_cand not in ("None", "null", ""):
                resolution_photo = photo_cand

        ver_m = re.search(r'\[VERIFIED_APPROVED\s+([^\]]+)\]', task_desc)
        if ver_m:
            verified_at = ver_m.group(1).split(" by ")[0].strip()

    # Determine current exact lifecycle stage
    raw_status = (report.get("status") or "Submitted").strip()
    if raw_status == "Resolved":
        current_stage = "RESOLVED"
    elif raw_status == "Under Review" and resolution_submitted_at:
        current_stage = "RESOLUTION_SUBMITTED"
    elif raw_status == "In Progress":
        current_stage = "IN_PROGRESS"
    elif accepted_at:
        current_stage = "ACCEPTED"
    elif assigned_staff or raw_status == "Assigned" or (task and task.get("status") in ("ASSIGNED", "PENDING")):
        current_stage = "ASSIGNED"
    elif report.get("ai_category") or report.get("ai_summary") or raw_status == "Under Review":
        current_stage = "AI_ANALYZED"
    else:
        current_stage = "SUBMITTED"

    # Fallbacks for previous sequential timestamps
    if current_stage in ("ACCEPTED", "IN_PROGRESS", "RESOLUTION_SUBMITTED", "RESOLVED"):
        if not accepted_at and task_created_at:
            accepted_at = task.get("updated_at") or task_created_at
    if current_stage in ("IN_PROGRESS", "RESOLUTION_SUBMITTED", "RESOLVED"):
        if not started_at and task_created_at:
            started_at = task.get("updated_at") or task_created_at
    if current_stage == "RESOLVED":
        if not resolved_at:
            resolved_at = report.get("updated_at") or (task.get("updated_at") if task else None)

    # Determine exact citizen-facing status message according to requirements
    if current_stage == "RESOLVED" or raw_status == "Resolved":
        status_message = "Your waste complaint has been resolved."
    elif current_stage == "RESOLUTION_SUBMITTED" or (raw_status == "Under Review" and resolution_submitted_at):
        status_message = "The municipal team has submitted completion details. Final verification is pending."
    elif current_stage == "IN_PROGRESS" or raw_status == "In Progress":
        status_message = "The municipal team has started working on your report."
    elif current_stage in ("ASSIGNED", "ACCEPTED") or raw_status == "Assigned" or bool(assigned_staff):
        status_message = "Your report has been assigned to the responsible team."
    else:
        status_message = "Your report has been received. The municipal team has not been assigned yet."

    # 8-stage timeline with actual database timestamps and explicit states: COMPLETED, CURRENT, PENDING
    timeline = [
        {
            "stage": "SUBMITTED",
            "title": "1. Report Submitted",
            "state": "CURRENT" if current_stage == "SUBMITTED" else "COMPLETED",
            "status_label": "Submitted",
            "timestamp": report.get("created_at"),
            "description": "Citizen waste complaint logged in municipal registry.",
            "completed": True,
            "active": current_stage == "SUBMITTED",
            "department": None,
            "officer": None,
        },
        {
            "stage": "AI_ANALYZED",
            "title": "2. AI Analysis Completed",
            "state": "CURRENT" if current_stage == "AI_ANALYZED" else ("COMPLETED" if (report.get("ai_category") or report.get("ai_summary") or current_stage != "SUBMITTED") else "PENDING"),
            "status_label": "Analyzed",
            "timestamp": report.get("created_at") if (report.get("ai_category") or report.get("ai_summary")) else None,
            "description": f"Gemini AI assessed priority as {report.get('ai_priority') or 'MEDIUM'} and category as {report.get('ai_category') or report.get('waste_category')}." if (report.get("ai_category") or report.get("ai_summary")) else "Awaiting automated AI multimodal triage.",
            "completed": bool(report.get("ai_category") or report.get("ai_summary") or current_stage != "SUBMITTED"),
            "active": current_stage == "AI_ANALYZED",
            "department": None,
            "officer": None,
        },
        {
            "stage": "ASSIGNED",
            "title": "3. Assigned to Municipal Department",
            "state": "CURRENT" if current_stage == "ASSIGNED" else ("COMPLETED" if assigned_staff else "PENDING"),
            "status_label": "Assigned" if assigned_staff else "Pending Assignment",
            "timestamp": task_created_at if assigned_staff else None,
            "description": f"Assigned to {assigned_department or 'Solid Waste Management'} (Officer: {assigned_staff or 'Assigned'}). {assigned_instructions or ''}".strip() if assigned_staff else "Awaiting Municipal Assignment",
            "completed": bool(assigned_staff),
            "active": current_stage == "ASSIGNED",
            "department": assigned_department if assigned_staff else None,
            "officer": assigned_staff,
        },
        {
            "stage": "ACCEPTED",
            "title": "4. Assignment Accepted",
            "state": "CURRENT" if current_stage == "ACCEPTED" else ("COMPLETED" if (accepted_at or current_stage in ("IN_PROGRESS", "RESOLUTION_SUBMITTED", "RESOLVED")) else "PENDING"),
            "status_label": "Accepted" if (accepted_at or current_stage in ("IN_PROGRESS", "RESOLUTION_SUBMITTED", "RESOLVED")) else "Pending Acceptance",
            "timestamp": accepted_at,
            "description": f"Municipal Officer ({assigned_staff}) acknowledged and accepted the work order." if accepted_at else "Awaiting Assignment Acceptance",
            "completed": bool(accepted_at or current_stage in ("IN_PROGRESS", "RESOLUTION_SUBMITTED", "RESOLVED")),
            "active": current_stage == "ACCEPTED",
            "department": assigned_department if assigned_staff else None,
            "officer": assigned_staff,
        },
        {
            "stage": "IN_PROGRESS",
            "title": "5. Collection Work In Progress",
            "state": "CURRENT" if current_stage == "IN_PROGRESS" else ("COMPLETED" if (started_at or current_stage in ("RESOLUTION_SUBMITTED", "RESOLVED")) else "PENDING"),
            "status_label": "In Progress" if (started_at or current_stage in ("RESOLUTION_SUBMITTED", "RESOLVED")) else "Pending Start",
            "timestamp": started_at,
            "description": "Field sanitation crew actively on site executing clearance." if (started_at or current_stage in ("RESOLUTION_SUBMITTED", "RESOLVED")) else "Collection Work In Progress",
            "completed": bool(started_at or current_stage in ("RESOLUTION_SUBMITTED", "RESOLVED")),
            "active": current_stage == "IN_PROGRESS",
            "department": assigned_department if assigned_staff else None,
            "officer": assigned_staff,
        },
        {
            "stage": "RESOLUTION_SUBMITTED",
            "title": "6. Resolution Submitted",
            "state": "CURRENT" if current_stage == "RESOLUTION_SUBMITTED" else ("COMPLETED" if (resolution_submitted_at or current_stage == "RESOLVED") else "PENDING"),
            "status_label": "Submitted for Verification" if resolution_submitted_at else "Pending Resolution",
            "timestamp": resolution_submitted_at or (resolved_at if current_stage == "RESOLVED" else None),
            "description": f"Field clearance completed: {resolution_notes}" if resolution_notes else "Resolution Submitted — Awaiting Verification",
            "completed": bool(resolution_submitted_at or current_stage == "RESOLVED"),
            "active": current_stage == "RESOLUTION_SUBMITTED",
            "department": assigned_department if assigned_staff else None,
            "officer": assigned_staff,
        },
        {
            "stage": "RESOLUTION_VERIFIED",
            "title": "7. Resolution Verified",
            "state": "CURRENT" if current_stage == "RESOLUTION_VERIFIED" else ("COMPLETED" if current_stage == "RESOLVED" else "PENDING"),
            "status_label": "Verified" if current_stage == "RESOLVED" else "Awaiting Verification",
            "timestamp": verified_at or (resolved_at if current_stage == "RESOLVED" else None),
            "description": "Operations Manager verified field completion." if (verified_at or current_stage == "RESOLVED") else "Awaiting Manager Verification",
            "completed": current_stage == "RESOLVED",
            "active": current_stage == "RESOLUTION_VERIFIED",
            "department": assigned_department if assigned_staff else None,
            "officer": assigned_staff,
        },
        {
            "stage": "RESOLVED",
            "title": "8. Complaint Resolved",
            "state": "COMPLETED" if current_stage == "RESOLVED" else "PENDING",
            "status_label": "Resolved" if current_stage == "RESOLVED" else "Pending Resolution",
            "timestamp": resolved_at,
            "description": "Complaint Resolved Successfully" if current_stage == "RESOLVED" else "Awaiting Final Resolution",
            "completed": current_stage == "RESOLVED",
            "active": current_stage == "RESOLVED",
            "department": assigned_department if assigned_staff else None,
            "officer": assigned_staff,
        },
    ]

    report["assigned_staff"] = assigned_staff
    report["assigned_staff_name"] = (task.get("task_title") or "").replace("Assigned to ", "") if (task and task.get("task_title")) else assigned_staff
    report["assigned_staff_id"] = assigned_staff
    report["assigned_officer"] = report["assigned_staff_name"] or assigned_staff
    report["assigned_department"] = assigned_department
    report["assigned_instructions"] = assigned_instructions
    report["assigned_task"] = task
    report["task_id"] = (task.get("task_number") or task.get("id")) if task else None
    report["task_number"] = task.get("task_number") if task else None
    report["lifecycle_stage"] = current_stage
    report["status_message"] = status_message
    report["timeline"] = timeline
    report["resolution_notes"] = resolution_notes
    report["resolution_photo_url"] = resolution_photo
    report["resolution_photo_signed_url"] = resolve_photo_url(admin_supabase, resolution_photo) if resolution_photo else None
    report["resolved_at"] = resolved_at
    report["last_updated_at"] = report.get("updated_at") or report.get("created_at")
    return report

# 1. UPLOAD WASTE PHOTO
# =========================================================

@router.post("/upload-photo")
async def upload_waste_photo(
    photo: UploadFile = File(...),
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Upload a waste photo to Supabase Storage."""

    allowed_types = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
    }

    if photo.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=(
                "Only JPG, PNG, and WEBP images are allowed."
            ),
        )

    try:
        photo_bytes = await photo.read()

        if not photo_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded photo is empty.",
            )

        # Maximum file size: 5 MB
        if len(photo_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Photo must be 5 MB or smaller.",
            )

        extension = allowed_types[photo.content_type]

        file_path = (
            f"{current_user['user_id']}/"
            f"{uuid4()}.{extension}"
        )

        supabase = get_supabase_client(
            current_user["access_token"]
        )

        supabase.storage.from_("waste-photos").upload(
            file_path,
            photo_bytes,
            {
                "content-type": photo.content_type,
                "upsert": "false",
            },
        )

        return {
            "success": True,
            "message": "Waste photo uploaded successfully.",
            "file_path": file_path,
        }

    except HTTPException:
        raise

    except Exception as exc:
        print("PHOTO UPLOAD ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "Photo upload failed. "
                "Check the backend terminal."
            ),
        ) from exc

    finally:
        await photo.close()


# =========================================================
# 2. CREATE REPORT AND PROCESS AI DECISION THROUGH N8N
# =========================================================

@router.post("/", status_code=201)
def create_report(
    report: WasteReportCreate,
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """
    Create a citizen report, process it through n8n,
    and save the AI classification in Supabase.
    """

    try:
        # -------------------------------------------------
        # STEP 1: AUTHENTICATED CITIZEN CLIENT
        # -------------------------------------------------

        supabase = get_supabase_client(
            current_user["access_token"]
        )

        # -------------------------------------------------
        # STEP 2: SAVE ORIGINAL REPORT
        # -------------------------------------------------

        report_data = report.model_dump(
            exclude_none=True
        )

        # Never accept the citizen ID from request data.
        report_data["citizen_id"] = (
            current_user["user_id"]
        )

        insert_response = (
            supabase
            .table("waste_reports")
            .insert(report_data)
            .execute()
        )

        if not insert_response.data:
            raise HTTPException(
                status_code=500,
                detail=(
                    "The database did not return "
                    "the created report."
                ),
            )

        created_report = insert_response.data[0]

        report_uuid = str(created_report["id"])

        report_number = int(
            created_report["report_number"]
        )

        report_id = f"WM-{report_number:04d}"

        print("\n========== REPORT CREATED ==========")
        print("REPORT UUID:", report_uuid)
        print("REPORT NUMBER:", report_number)
        print(
            "WASTE CATEGORY:",
            created_report.get("waste_category"),
        )
        print(
            "DESCRIPTION:",
            created_report.get("description"),
        )
        print("WARD:", created_report.get("ward"))
        print("====================================\n")

        # -------------------------------------------------
        # STEP 3: PREPARE N8N PAYLOAD
        # -------------------------------------------------

        n8n_payload = {
            "report_uuid": report_uuid,
            "report_id": report_id,
            "issue_type": (
                created_report.get("waste_category")
                or "Other"
            ),
            "description": (
                created_report.get("description") or ""
            ),
            "ward": (
                created_report.get("ward") or ""
            ),
            "location": (
                created_report.get("address") or ""
            ),
        }

        print("SENDING TO N8N:", n8n_payload)

        automation_result: dict[str, Any] = {
            "success": False,
            "message": (
                "Report saved, but the AI decision "
                "has not been processed."
            ),
        }

        ai_saved = False

        # -------------------------------------------------
        # STEP 4: CALL N8N AND PROCESS AI RESPONSE
        # -------------------------------------------------

        try:
            with httpx.Client(
                timeout=httpx.Timeout(30.0, connect=5.0)
            ) as client:

                n8n_response = client.post(
                    N8N_WEBHOOK_URL,
                    json=n8n_payload,
                )

            print("\n========== N8N RESPONSE ==========")
            print(
                "HTTP STATUS:",
                n8n_response.status_code,
            )
            print(
                "RAW RESPONSE:",
                n8n_response.text,
            )
            print("==================================\n")

            n8n_response.raise_for_status()

            try:
                n8n_result = n8n_response.json()

            except ValueError as exc:
                raise ValueError(
                    "n8n returned invalid JSON."
                ) from exc

            # Handle a list response.
            decision = n8n_result

            if isinstance(decision, list):
                if not decision:
                    raise ValueError(
                        "n8n returned an empty list."
                    )

                decision = decision[0]

            if not isinstance(decision, dict):
                raise ValueError(
                    "n8n response must be a JSON object."
                )

            # Unwrap common response formats.
            for wrapper in ("body", "output"):
                nested = decision.get(wrapper)

                if isinstance(nested, dict):
                    decision = nested

            # Detect an error object instead of an AI decision.
            if decision.get("error"):
                raise ValueError(
                    "AI workflow returned an error: "
                    f"{decision['error']}"
                )

            print("FINAL AI DECISION:", decision)

            # -------------------------------------------------
            # STEP 5: VALIDATE AI RESPONSE
            # -------------------------------------------------

            required_fields = [
                "waste_category",
                "priority",
                "recommended_action",
                "assigned_department",
                "reason",
            ]

            missing_fields = [
                field
                for field in required_fields
                if not isinstance(
                    decision.get(field),
                    str,
                )
                or not decision[field].strip()
            ]

            if missing_fields:
                raise ValueError(
                    "AI response is missing valid fields: "
                    + ", ".join(missing_fields)
                )

            category = (
                decision["waste_category"].strip()
            )

            normalized_priority = (
                decision["priority"].strip().upper()
            )

            action = (
                decision["recommended_action"].strip()
            )

            department = (
                decision["assigned_department"].strip()
            )

            reason = decision["reason"].strip()

            if normalized_priority not in ALLOWED_PRIORITIES:
                raise ValueError(
                    "Invalid AI priority: "
                    f"{normalized_priority}"
                )

            # -------------------------------------------------
            # STEP 6: SAVE AI FIELDS USING ADMIN CLIENT
            # -------------------------------------------------

            # Supabase CHECK constraint expects title-case values:
            # Low, Medium, High, Critical.
            priority_map = {
                "LOW": "Low",
                "MEDIUM": "Medium",
                "HIGH": "High",
                "CRITICAL": "Critical",
            }
            priority = priority_map[normalized_priority]

            update_data = {
                "ai_category": category,
                "ai_priority": priority,
                "ai_summary": action,
            }

            print("\n========== SUPABASE AI UPDATE ==========")
            print("REPORT UUID:", report_uuid)
            print("UPDATE DATA:", update_data)

            # Use the privileged client only on the backend.
            # The UUID and citizen ID are both checked.
            admin_supabase = get_supabase_admin_client()

            update_response = (
                admin_supabase
                .table("waste_reports")
                .update(update_data)
                .eq("id", report_uuid)
                .eq("citizen_id", current_user["user_id"])
                .select("*")
                .execute()
            )

            updated_rows = update_response.data or []

            print("UPDATED ROW COUNT:", len(updated_rows))

            if not updated_rows:
                raise RuntimeError(
                    "The AI update affected no report. "
                    "Verify the report UUID, citizen ID, " 
                    "and database configuration."
                )

            created_report = updated_rows[0]
            ai_saved = True

            print("AI RESULTS SAVED SUCCESSFULLY")
            print("SAVED AI CATEGORY:", created_report.get("ai_category"))
            print("SAVED AI PRIORITY:", created_report.get("ai_priority"))
            print("SAVED AI SUMMARY:", created_report.get("ai_summary"))
            print("========================================\n")

            # -------------------------------------------------
            # STEP 7: BUILD AUTOMATION SUCCESS RESPONSE
            # -------------------------------------------------

            automation_result = {
                "success": True,
                "decision_source": decision.get(
                    "decision_source",
                    "GEMINI AI",
                ),
                "waste_category": category,
                "priority": priority,
                "recommended_action": action,
                "assigned_department": department,
                "reason": reason,
                "saved_to_supabase": True,
            }

        except httpx.HTTPStatusError as exc:
            print(
                "N8N HTTP STATUS ERROR:",
                exc.response.status_code,
                exc.response.text,
            )

            automation_result = {
                "success": False,
                "message": (
                    "Report saved, but the AI workflow "
                    "returned an HTTP error."
                ),
            }

        except httpx.TimeoutException as exc:
            print("N8N TIMEOUT:", repr(exc))

            automation_result = {
                "success": False,
                "message": (
                    "Report saved, but the AI workflow "
                    "timed out. Please retry AI processing."
                ),
            }

        except httpx.HTTPError as exc:
            print("N8N HTTP ERROR:", repr(exc))

            automation_result = {
                "success": False,
                "message": (
                    "Report saved, but n8n could not "
                    "be reached successfully."
                ),
            }

        except APIError as exc:
            print(
                "AI SUPABASE UPDATE ERROR:",
                repr(exc),
            )

            automation_result = {
                "success": False,
                "message": (
                    "Report saved, but AI results could "
                    "not be saved in Supabase."
                ),
            }

        except (ValueError, RuntimeError) as exc:
            print("AI PROCESSING ERROR:", repr(exc))

            automation_result = {
                "success": False,
                "message": (
                    "Report saved, but the AI decision "
                    "could not be processed or saved."
                ),
            }

        # -------------------------------------------------
        # STEP 7.5: PERSISTENT NOTIFICATIONS
        # -------------------------------------------------
        try:
            create_notification(
                recipient_id=current_user["user_id"],
                recipient_role="citizen",
                notification_type="REPORT_SUBMITTED",
                title=f"Report Submitted: WM-{report_number:04d}",
                message=f"Your waste report WM-{report_number:04d} ({created_report.get('waste_category')}) has been received and logged in the municipal registry.",
                report_id=report_uuid,
                report_number=report_number,
            )
            create_notification(
                recipient_id="manager",
                recipient_role="manager",
                notification_type="REPORT_SUBMITTED",
                title=f"New Waste Report Received: WM-{report_number:04d}",
                message=f"New incident WM-{report_number:04d} ({created_report.get('waste_category')}) reported in {created_report.get('ward') or 'Ward 1'}. Requires manager review and team assignment.",
                report_id=report_uuid,
                report_number=report_number,
            )
        except Exception as notif_exc:
            print("REPORT CREATION NOTIFICATION ERROR:", repr(notif_exc))

        # -------------------------------------------------
        # STEP 8: RETURN API RESPONSE
        # -------------------------------------------------

        return {
            "success": True,
            "message": "Waste report created successfully.",
            "report": created_report,
            "automation": automation_result,
            "ai_saved": ai_saved,
        }

    except HTTPException:
        raise

    except APIError as exc:
        print("SUPABASE REPORT ERROR:", repr(exc))

        raise HTTPException(
            status_code=400,
            detail=(
                "Could not create the waste report. "
                "Check the database policy and table schema."
            ),
        ) from exc

    except Exception as exc:
        print("UNEXPECTED REPORT ERROR:", repr(exc))

        raise HTTPException(
            status_code=500,
            detail=(
                "An unexpected error occurred while "
                "creating the waste report."
            ),
        ) from exc


# =========================================================
# 3. GET THE AUTHENTICATED CITIZEN'S REPORTS
# =========================================================

@router.get("/")
def get_reports(
    limit: int = Query(default=20, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    status: Optional[str] = Query(default=None),
    waste_category: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort: str = Query(default="newest", pattern="^(newest|oldest)$"),
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Retrieve reports belonging to the authenticated citizen with search, filtering, and stats."""

    try:
        admin_supabase = get_supabase_admin_client()
        user_id = current_user["user_id"]

        # Fetch stats for this citizen across all their reports (cached for 15s)
        now = time.time()
        if user_id in _citizen_stats_cache and now < _citizen_stats_cache[user_id][1]:
            stats = _citizen_stats_cache[user_id][0]
        else:
            stats_query = (
                admin_supabase.table("waste_reports")
                .select("id, status")
                .eq("citizen_id", user_id)
                .execute()
            )
            all_citizen_reports = stats_query.data or []
            stats = {
                "total": len(all_citizen_reports),
                "pending": sum(1 for r in all_citizen_reports if r.get("status") == "Submitted"),
                "in_progress": sum(1 for r in all_citizen_reports if r.get("status") in ("Under Review", "In Progress")),
                "resolved": sum(1 for r in all_citizen_reports if r.get("status") == "Resolved"),
            }
            _citizen_stats_cache[user_id] = (stats, now + 15.0)

        # Build paginated and filtered query using connection-pooled admin client with strict citizen_id filter
        query = (
            admin_supabase.table("waste_reports")
            .select("*", count="exact")
            .eq("citizen_id", user_id)
        )

        if status and status.strip():
            query = query.eq("status", status.strip())

        if waste_category and waste_category.strip():
            query = query.eq("waste_category", waste_category.strip())

        if search and search.strip():
            clean_search = search.strip()
            if clean_search.upper().startswith("WM-"):
                num_str = clean_search[3:]
                if num_str.isdigit():
                    query = query.eq("report_number", int(num_str))
                else:
                    query = query.ilike("description", f"%{clean_search}%")
            elif clean_search.isdigit():
                query = query.eq("report_number", int(clean_search))
            else:
                query = query.ilike("description", f"%{clean_search}%")

        if sort == "oldest":
            query = query.order("created_at", desc=False)
        else:
            query = query.order("created_at", desc=True)

        start_offset = (page - 1) * limit
        end_offset = start_offset + limit - 1
        query = query.range(start_offset, end_offset)

        response = query.execute()
        reports = response.data or []
        total_matched = response.count if response.count is not None else len(reports)

        # Fetch associated tasks for these reports in batch
        rep_ids = [r["id"] for r in reports if r.get("id")]
        task_map = {}
        if rep_ids:
            t_res = admin_supabase.table("collection_tasks").select("*").in_("report_id", rep_ids).execute()
            for t in (t_res.data or []):
                if t.get("report_id") and t["report_id"] not in task_map:
                    task_map[t["report_id"]] = t

        for rep in reports:
            enrich_report_with_lifecycle(admin_supabase, rep, task_map.get(rep["id"]))

        return {
            "success": True,
            "count": len(reports),
            "total": total_matched,
            "page": page,
            "limit": limit,
            "stats": stats,
            "reports": reports,
        }

    except APIError as exc:
        print("SUPABASE RETRIEVAL ERROR:", repr(exc))
        raise HTTPException(
            status_code=400,
            detail="Could not retrieve waste reports.",
        ) from exc

    except Exception as exc:
        print("UNEXPECTED RETRIEVAL ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while retrieving reports.",
        ) from exc


@router.get("/nearby")
def get_nearby_reports(
    ward: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Retrieve community/nearby reports in the citizen's ward or selected ward."""
    try:
        admin_supabase = get_supabase_admin_client()
        target_ward = ward.strip() if ward and ward.strip() else current_user.get("ward")

        query = admin_supabase.table("waste_reports").select("*")
        if target_ward:
            query = query.eq("ward", target_ward)
        if status and status.strip():
            query = query.eq("status", status.strip())
        if category and category.strip():
            query = query.eq("waste_category", category.strip())

        query = query.order("created_at", desc=True).limit(limit)
        res = query.execute()
        reports = res.data or []

        rep_ids = [r["id"] for r in reports if r.get("id")]
        task_map = {}
        if rep_ids:
            t_res = admin_supabase.table("collection_tasks").select("*").in_("report_id", rep_ids).execute()
            for t in (t_res.data or []):
                if t.get("report_id") and t["report_id"] not in task_map:
                    task_map[t["report_id"]] = t

        for rep in reports:
            enrich_report_with_lifecycle(admin_supabase, rep, task_map.get(rep["id"]))

        return {
            "success": True,
            "ward": target_ward or "All Wards",
            "count": len(reports),
            "reports": reports,
        }
    except Exception as exc:
        print("NEARBY REPORTS ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Could not retrieve nearby reports.") from exc


# =========================================================
# 4. MUNICIPAL STAFF WORK ORDERS & DASHBOARD
# =========================================================

@router.get("/staff/assigned")
def get_staff_assigned_reports(
    status: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    current_staff: dict = Depends(require_staff),
) -> dict[str, Any]:
    """Retrieve reports assigned to the authenticated municipal staff member."""

    try:
        admin_supabase = get_supabase_admin_client()
        staff_email = current_staff["email"].strip().lower()

        # Query collection_tasks assigned to this staff member (or all if manager)
        tasks_query = admin_supabase.table("collection_tasks").select("*")
        if not current_staff.get("is_manager"):
            staff_ids = [
                i for i in [
                    staff_email,
                    current_staff.get("staff_id"),
                    str(current_staff.get("user_id")),
                ] if i
            ]
            tasks_query = tasks_query.in_("assigned_vehicle", staff_ids)

        tasks_response = tasks_query.execute()
        assigned_tasks = tasks_response.data or []

        task_by_report_id = {t["report_id"]: t for t in assigned_tasks if t.get("report_id")}
        report_ids = list(task_by_report_id.keys())

        if not report_ids:
            return {
                "success": True,
                "count": 0,
                "stats": {
                    "total_assigned": 0,
                    "awaiting_action": 0,
                    "in_progress": 0,
                    "completed": 0,
                },
                "reports": [],
            }

        # Fetch corresponding reports
        reports_res = admin_supabase.table("waste_reports").select("*").in_("id", report_ids).order("created_at", desc=True).execute()
        all_assigned = reports_res.data or []

        for rep in all_assigned:
            t = task_by_report_id.get(rep["id"])
            enrich_report_with_lifecycle(admin_supabase, rep, t)

        stats = {
            "total_assigned": len(all_assigned),
            "awaiting_action": sum(1 for r in all_assigned if r.get("lifecycle_stage") == "ASSIGNED"),
            "accepted": sum(1 for r in all_assigned if r.get("lifecycle_stage") == "ACCEPTED"),
            "in_progress": sum(1 for r in all_assigned if r.get("lifecycle_stage") == "IN_PROGRESS"),
            "resolution_submitted": sum(1 for r in all_assigned if r.get("lifecycle_stage") == "RESOLUTION_SUBMITTED"),
            "completed": sum(1 for r in all_assigned if r.get("lifecycle_stage") == "RESOLVED"),
        }

        # Filter reports
        filtered = []
        for rep in all_assigned:
            if status and status.strip() and rep.get("status") != status.strip() and rep.get("lifecycle_stage") != status.strip():
                continue
            if priority and priority.strip() and (rep.get("ai_priority") or "").upper() != priority.strip().upper():
                continue
            if search and search.strip():
                q = search.strip().lower()
                num_match = str(rep.get("report_number")) == q or f"wm-{rep.get('report_number'):04d}".lower() == q
                desc_match = q in (rep.get("description") or "").lower()
                ward_match = q in (rep.get("ward") or "").lower()
                if not (num_match or desc_match or ward_match):
                    continue
            filtered.append(rep)

        return {
            "success": True,
            "count": len(filtered),
            "stats": stats,
            "reports": filtered,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("STAFF ASSIGNED RETRIEVAL ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Could not retrieve staff work orders.",
        ) from exc


@router.patch("/staff/{report_id}/update")
def staff_update_report_status(
    report_id: str,
    payload: StaffStatusUpdate,
    current_staff: dict = Depends(require_staff),
) -> dict[str, Any]:
    """Staff only: Mark an assigned report as 'In Progress' or 'Resolved' and add staff notes."""

    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
        now_iso = datetime.now(timezone.utc).isoformat()

        # RBAC: Municipal Staff can only update reports assigned to them
        task_res = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).order("created_at", desc=True).execute()
        existing_tasks = task_res.data or []

        is_assigned, matching_task = check_report_assignment(report, existing_tasks, current_staff)

        if not current_staff.get("is_manager"):
            if not is_assigned:
                raise HTTPException(
                    status_code=403,
                    detail="Access forbidden: You can only update reports assigned to you.",
                )

        # Update report status in waste_reports
        update_res = admin_supabase.table("waste_reports").update({
            "status": payload.status,
            "updated_at": now_iso,
        }).eq("id", report["id"]).select("*").execute()

        updated_report = update_res.data[0] if update_res.data else report

        # Update collection_task status and append note
        task_status = "COMPLETED" if payload.status == "Resolved" else "IN_PROGRESS"
        staff_name = current_staff.get("full_name") or current_staff.get("email")
        note_entry = f"[{now_iso[:10]} {staff_name}]: {payload.staff_note}" if payload.staff_note else None

        if existing_tasks:
            t = existing_tasks[0]
            desc = (t.get("description") or "") + (f"\n{note_entry}" if note_entry else "")
            admin_supabase.table("collection_tasks").update({
                "status": task_status,
                "description": desc.strip(),
                "updated_at": now_iso,
            }).eq("id", t["id"]).execute()
        else:
            admin_supabase.table("collection_tasks").insert({
                "task_number": f"TASK-{report['report_number']:04d}",
                "report_id": report["id"],
                "incident_id": f"WM-{report['report_number']:04d}",
                "task_title": f"Handled by {staff_name}",
                "assigned_vehicle": current_staff["email"],
                "status": task_status,
                "description": note_entry or "Updated by field staff",
                "department": "Solid Waste Management",
                "updated_at": now_iso,
            }).execute()

        t_out = existing_tasks[0] if existing_tasks else None
        enriched = enrich_report_with_lifecycle(admin_supabase, updated_report, t_out)

        return {
            "success": True,
            "message": f"Report #{report['report_number']} marked as '{payload.status}'.",
            "report": enriched,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("STAFF UPDATE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update report status.",
        ) from exc


@router.patch("/staff/{report_id}/accept")
def staff_accept_assignment(
    report_id: str,
    current_staff: dict = Depends(require_staff),
) -> dict[str, Any]:
    """Staff only: Accept an assigned work order and record event timestamp."""
    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
        now_iso = datetime.now(timezone.utc).isoformat()

        task_res = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).order("created_at", desc=True).execute()
        existing_tasks = task_res.data or []

        is_assigned, matching_task = check_report_assignment(report, existing_tasks, current_staff)
        task = matching_task

        if not current_staff.get("is_manager"):
            if not is_assigned:
                raise HTTPException(status_code=403, detail="Access forbidden: You can only accept reports assigned to you.")
            if not task:
                raise HTTPException(status_code=400, detail="Cannot accept: No collection task exists for this report.")
        else:
            if not task and existing_tasks:
                task = existing_tasks[0]

        staff_name = current_staff.get("full_name") or current_staff.get("email")
        note_entry = f"[ACCEPTED {now_iso[:19]} by {staff_name}]"
        current_desc = task.get("description") or ""
        if "[ACCEPTED" not in current_desc:
            updated_desc = (current_desc + f"\n{note_entry}").strip()
        else:
            updated_desc = current_desc

        task_res = admin_supabase.table("collection_tasks").update({
            "status": "ASSIGNED",
            "description": updated_desc,
            "updated_at": now_iso,
        }).eq("id", task["id"]).select("*").execute()

        updated_task = task_res.data[0] if task_res.data else task
        enriched = enrich_report_with_lifecycle(admin_supabase, report, updated_task)

        # Notify citizen that municipal officer accepted assignment
        try:
            citizen_id = report.get("citizen_id")
            if citizen_id:
                create_notification(
                    recipient_id=str(citizen_id),
                    recipient_role="citizen",
                    notification_type="WORK_ACCEPTED",
                    title=f"Assignment Accepted: WM-{report['report_number']:04d}",
                    message=f"Municipal Officer ({staff_name}) acknowledged and accepted the work order for report WM-{report['report_number']:04d}.",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=updated_task.get("task_number"),
                )
        except Exception as notif_err:
            print("ACCEPT NOTIFICATION WARNING:", repr(notif_err))

        return {
            "success": True,
            "message": f"Assignment for Report #{report['report_number']} accepted. Ready to start work.",
            "report": enriched,
            "task": updated_task,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print("STAFF ACCEPT ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Failed to accept assignment.") from exc


@router.patch("/staff/{report_id}/start")
def staff_start_work(
    report_id: str,
    current_staff: dict = Depends(require_staff),
) -> dict[str, Any]:
    """Staff only: Mark accepted assignment as 'In Progress'."""
    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
        now_iso = datetime.now(timezone.utc).isoformat()

        task_res = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).order("created_at", desc=True).execute()
        existing_tasks = task_res.data or []

        is_assigned, matching_task = check_report_assignment(report, existing_tasks, current_staff)
        task = matching_task

        if not current_staff.get("is_manager"):
            if not is_assigned:
                raise HTTPException(status_code=403, detail="Access forbidden: You can only start reports assigned to you.")
            if not task:
                raise HTTPException(status_code=400, detail="Cannot start: No collection task exists for this report.")
        else:
            if not task and existing_tasks:
                task = existing_tasks[0]

        rep_res = admin_supabase.table("waste_reports").update({
            "status": "In Progress",
            "updated_at": now_iso,
        }).eq("id", report["id"]).select("*").execute()
        updated_report = rep_res.data[0] if rep_res.data else report

        staff_name = current_staff.get("full_name") or current_staff.get("email")
        note_entry = f"[STARTED {now_iso[:19]} by {staff_name}]"
        current_desc = task.get("description") or ""
        if "[STARTED" not in current_desc:
            updated_desc = (current_desc + f"\n{note_entry}").strip()
        else:
            updated_desc = current_desc

        task_res = admin_supabase.table("collection_tasks").update({
            "status": "IN_PROGRESS",
            "description": updated_desc,
            "updated_at": now_iso,
        }).eq("id", task["id"]).select("*").execute()

        updated_task = task_res.data[0] if task_res.data else task
        enriched = enrich_report_with_lifecycle(admin_supabase, updated_report, updated_task)

        # Notify citizen that municipal team started work
        try:
            citizen_id = report.get("citizen_id")
            if citizen_id:
                create_notification(
                    recipient_id=str(citizen_id),
                    recipient_role="citizen",
                    notification_type="WORK_STARTED",
                    title=f"Collection Work In Progress: WM-{report['report_number']:04d}",
                    message=f"The municipal team has started working on your report WM-{report['report_number']:04d}.",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=updated_task.get("task_number"),
                )
        except Exception as notif_err:
            print("START WORK NOTIFICATION WARNING:", repr(notif_err))

        return {
            "success": True,
            "message": f"Collection work started for Report #{report['report_number']}.",
            "report": enriched,
            "task": updated_task,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print("STAFF START ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Failed to start work.") from exc


@router.patch("/staff/{report_id}/resolve")
def staff_submit_resolution(
    report_id: str,
    payload: StaffSubmitResolution,
    current_staff: dict = Depends(require_staff),
) -> dict[str, Any]:
    """Staff only: Submit field resolution notes and completion evidence photo."""
    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
        now_iso = datetime.now(timezone.utc).isoformat()

        task_res = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).order("created_at", desc=True).execute()
        existing_tasks = task_res.data or []

        is_assigned, matching_task = check_report_assignment(report, existing_tasks, current_staff)
        task = matching_task

        if not current_staff.get("is_manager"):
            if not is_assigned:
                raise HTTPException(status_code=403, detail="Access forbidden: You can only resolve reports assigned to you.")
            if not task:
                raise HTTPException(status_code=400, detail="Cannot resolve: No collection task exists for this report.")
        else:
            # Manager resolving report: verify manager authorized organization scope
            user_org = (current_staff.get("organization_id") or "").strip().lower()
            rep_org = get_report_organization(admin_supabase, report)
            if user_org and rep_org and user_org != rep_org:
                raise HTTPException(status_code=403, detail="Access forbidden: You can only access reports within your authorized organization.")

            if not task and existing_tasks:
                task = existing_tasks[0]
            elif not task:
                # If report had no prior task, manager directly creates/completes task
                staff_name = current_staff.get("full_name") or current_staff.get("email")
                task_payload = {
                    "task_number": f"TASK-{report['report_number']:04d}",
                    "report_id": report["id"],
                    "incident_id": f"WM-{report['report_number']:04d}",
                    "task_title": f"Resolution handled by Manager ({staff_name})",
                    "assigned_vehicle": current_staff.get("email"),
                    "assigned_ward": report.get("ward") or "Ward 1",
                    "department": report.get("ai_department") or "Solid Waste Management",
                    "priority": (report.get("ai_priority") or "MEDIUM").upper(),
                    "description": f"Direct administrative resolution logged by Manager ({staff_name})",
                    "status": "COMPLETED" if payload.direct_resolve else "IN_PROGRESS",
                    "updated_at": now_iso,
                }
                insert_task_res = admin_supabase.table("collection_tasks").insert(task_payload).select("*").execute()
                task = insert_task_res.data[0] if insert_task_res.data else task_payload

        staff_name = current_staff.get("full_name") or current_staff.get("email")

        if payload.direct_resolve:
            new_report_status = "Resolved"
            new_task_status = "COMPLETED"
            action_tag = "RESOLVED_DIRECT"
            msg = f"Report #{report['report_number']} resolved successfully."
        else:
            new_report_status = "Under Review"
            new_task_status = "IN_PROGRESS"
            action_tag = "RESOLUTION_SUBMITTED"
            msg = f"Resolution for Report #{report['report_number']} submitted for Manager verification."

        rep_res = admin_supabase.table("waste_reports").update({
            "status": new_report_status,
            "updated_at": now_iso,
        }).eq("id", report["id"]).select("*").execute()
        updated_report = rep_res.data[0] if rep_res.data else report

        photo_info = f" | photo: {payload.photo_url}" if payload.photo_url else ""
        note_entry = f"[{action_tag} {now_iso[:19]} by {staff_name}]: {payload.staff_note}{photo_info}"
        current_desc = task.get("description") or ""
        updated_desc = (current_desc + f"\n{note_entry}").strip()

        task_res = admin_supabase.table("collection_tasks").update({
            "status": new_task_status,
            "description": updated_desc,
            "updated_at": now_iso,
        }).eq("id", task["id"]).select("*").execute()

        updated_task = task_res.data[0] if task_res.data else task
        enriched = enrich_report_with_lifecycle(admin_supabase, updated_report, updated_task)

        # Persistent notifications
        try:
            citizen_id = report.get("citizen_id")
            if payload.direct_resolve:
                if citizen_id:
                    create_notification(
                        recipient_id=str(citizen_id),
                        recipient_role="citizen",
                        notification_type="REPORT_RESOLVED",
                        title="Waste complaint resolved",
                        message=f"Your report WM-{report['report_number']:04d} has been marked resolved after the required completion process.",
                        report_id=report["id"],
                        report_number=report["report_number"],
                        task_id=updated_task.get("task_number"),
                    )
                create_notification(
                    recipient_id="manager",
                    recipient_role="manager",
                    notification_type="REPORT_RESOLVED",
                    title=f"Work Order Completed: WM-{report['report_number']:04d}",
                    message=f"Field staff ({staff_name}) resolved report WM-{report['report_number']:04d}. Notes: {payload.staff_note}",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=updated_task.get("task_number"),
                )
            else:
                if citizen_id:
                    create_notification(
                        recipient_id=str(citizen_id),
                        recipient_role="citizen",
                        notification_type="WORK_COMPLETED",
                        title=f"Work update received for report WM-{report['report_number']:04d}",
                        message=f"The municipal team has submitted completion details. Final verification is pending.",
                        report_id=report["id"],
                        report_number=report["report_number"],
                        task_id=updated_task.get("task_number"),
                    )
                create_notification(
                    recipient_id="manager",
                    recipient_role="manager",
                    notification_type="VERIFICATION_REQUIRED",
                    title=f"Resolution Verification Required: WM-{report['report_number']:04d}",
                    message=f"Municipal field staff ({staff_name}) submitted completion details for incident WM-{report['report_number']:04d}. Verification is pending.",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=updated_task.get("task_number"),
                )
        except Exception as notif_err:
            print("SUBMIT RESOLUTION NOTIFICATION WARNING:", repr(notif_err))

        return {
            "success": True,
            "message": msg,
            "report": enriched,
            "task": updated_task,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print("STAFF RESOLVE ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Failed to submit resolution.") from exc


# =========================================================
# 5. MANAGER / ADMINISTRATOR DASHBOARD & ASSIGNMENTS
# =========================================================

@router.get("/manager/all")
@router.get("/admin/all")
def get_manager_reports(
    limit: int = Query(default=25, ge=1, le=100),
    page: int = Query(default=1, ge=1),
    status: Optional[str] = Query(default=None),
    ai_priority: Optional[str] = Query(default=None),
    waste_category: Optional[str] = Query(default=None),
    ward: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    date_from: Optional[str] = Query(default=None),
    date_to: Optional[str] = Query(default=None),
    sort: str = Query(default="newest", pattern="^(newest|oldest|priority)$"),
    current_manager: dict = Depends(require_manager),
) -> dict[str, Any]:
    """Manager only: Retrieve all waste reports with global KPI statistics and staff assignments."""

    try:
        admin_supabase = get_supabase_admin_client()

        # Compute global manager metrics (cached for 15s to eliminate full-table scan on every page/filter)
        global _manager_stats_cache
        now = time.time()
        if _manager_stats_cache and now < _manager_stats_cache[1]:
            stats = _manager_stats_cache[0]
        else:
            summary_query = admin_supabase.table("waste_reports").select("id, status, ai_priority").execute()
            all_reports = summary_query.data or []
            tasks_count_res = admin_supabase.table("collection_tasks").select("report_id").execute()
            assigned_report_ids = set(t["report_id"] for t in (tasks_count_res.data or []) if t.get("report_id"))

            stats = {
                "total": len(all_reports),
                "pending": sum(1 for r in all_reports if r.get("status") == "Submitted"),
                "under_review": sum(1 for r in all_reports if r.get("status") == "Under Review"),
                "in_progress": sum(1 for r in all_reports if r.get("status") == "In Progress"),
                "resolved": sum(1 for r in all_reports if r.get("status") == "Resolved"),
                "high_priority": sum(
                    1 for r in all_reports
                    if str(r.get("ai_priority") or "").strip().upper() in ("HIGH", "CRITICAL")
                ),
                "assigned_to_staff": len(assigned_report_ids),
            }
            _manager_stats_cache = (stats, now + 15.0)

        # Build filtered query
        query = admin_supabase.table("waste_reports").select("*", count="exact")

        if status and status.strip():
            query = query.eq("status", status.strip())

        if ai_priority and ai_priority.strip():
            query = query.eq("ai_priority", ai_priority.strip())

        if waste_category and waste_category.strip():
            query = query.eq("waste_category", waste_category.strip())

        if ward and ward.strip():
            query = query.eq("ward", ward.strip())

        if date_from and date_from.strip():
            query = query.gte("created_at", date_from.strip())

        if date_to and date_to.strip():
            query = query.lte("created_at", date_to.strip())

        if search and search.strip():
            clean_search = search.strip()
            if clean_search.upper().startswith("WM-"):
                num_str = clean_search[3:]
                if num_str.isdigit():
                    query = query.eq("report_number", int(num_str))
                else:
                    query = query.ilike("description", f"%{clean_search}%")
            elif clean_search.isdigit():
                query = query.eq("report_number", int(clean_search))
            else:
                query = query.ilike("description", f"%{clean_search}%")

        if sort == "oldest":
            query = query.order("created_at", desc=False)
        else:
            query = query.order("created_at", desc=True)

        start_offset = (page - 1) * limit
        end_offset = start_offset + limit - 1
        query = query.range(start_offset, end_offset)

        response = query.execute()
        reports = response.data or []
        total_matched = response.count if response.count is not None else len(reports)

        # Batch-fetch collection tasks for current page reports ONLY
        rep_ids = [r["id"] for r in reports if r.get("id")]
        task_by_report_id = {}
        if rep_ids:
            tasks_page_res = admin_supabase.table("collection_tasks").select("*").in_("report_id", rep_ids).execute()
            task_by_report_id = {t["report_id"]: t for t in (tasks_page_res.data or []) if t.get("report_id")}

        for rep in reports:
            enrich_report_with_lifecycle(admin_supabase, rep, task_by_report_id.get(rep["id"]))

        return {
            "success": True,
            "count": len(reports),
            "total": total_matched,
            "page": page,
            "limit": limit,
            "stats": stats,
            "reports": reports,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("MANAGER RETRIEVAL ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving manager reports.",
        ) from exc


@router.post("/manager/{report_id}/assign")
def manager_assign_report(
    report_id: str,
    payload: ReportAssignment,
    current_manager: dict = Depends(require_manager),
) -> dict[str, Any]:
    """Manager only: Assign a waste report to a municipal staff member."""

    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")

        task_check = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).execute()
        existing_task = task_check.data[0] if task_check.data else None
        target_staff_email = str(payload.staff_email).strip().lower()

        if existing_task:
            current_vehicle = (existing_task.get("assigned_vehicle") or "").strip().lower()
            if current_vehicle == target_staff_email and existing_task.get("status") in ("ASSIGNED", "IN_PROGRESS"):
                raise HTTPException(
                    status_code=400,
                    detail=f"Duplicate assignment prevented: Report #{report['report_number']} is already assigned to {payload.staff_email}.",
                )

        now_iso = datetime.now(timezone.utc).isoformat()
        staff_label = payload.staff_name or payload.staff_email

        # Update waste report status to 'Assigned' and retrieve updated record
        rep_update = admin_supabase.table("waste_reports").update({
            "status": "Assigned",
            "updated_at": now_iso,
        }).eq("id", report["id"]).select("*").execute()
        if rep_update.data:
            report = rep_update.data[0]
        else:
            report["status"] = "Assigned"
            report["updated_at"] = now_iso

        # Upsert collection_task with assigned staff email in assigned_vehicle
        mgr_name = current_manager.get("full_name") or current_manager.get("email")
        assign_entry = f"[ASSIGNED {now_iso[:19]} by {mgr_name}]"
        initial_desc = payload.manager_note or f"Assigned by Manager to {staff_label}"
        task_desc = f"{initial_desc}\n{assign_entry}"

        task_payload = {
            "task_number": f"TASK-{report['report_number']:04d}",
            "report_id": report["id"],
            "incident_id": f"WM-{report['report_number']:04d}",
            "task_title": f"Assigned to {staff_label}",
            "assigned_vehicle": str(payload.staff_email).strip().lower(),
            "assigned_ward": report.get("ward") or "Ward 1",
            "department": payload.department or "Solid Waste Management",
            "priority": (payload.priority or report.get("ai_priority") or "MEDIUM").upper(),
            "description": task_desc,
            "status": "ASSIGNED",
            "updated_at": now_iso,
        }

        task_res = admin_supabase.table("collection_tasks").select("id").eq("report_id", report["id"]).execute()
        if task_res.data:
            t_id = task_res.data[0]["id"]
            task_out = admin_supabase.table("collection_tasks").update(task_payload).eq("id", t_id).select("*").execute().data[0]
        else:
            task_out = admin_supabase.table("collection_tasks").insert(task_payload).select("*").execute().data[0]

        # Re-fetch the actual database record for complete consistency
        updated_report_res = admin_supabase.table("waste_reports").select("*").eq("id", report["id"]).execute()
        if updated_report_res.data:
            report = updated_report_res.data[0]
        else:
            report["status"] = "Assigned"

        enriched = enrich_report_with_lifecycle(admin_supabase, report, task_out)

        # Persistent notifications for citizen and staff
        try:
            citizen_id = report.get("citizen_id")
            if citizen_id:
                create_notification(
                    recipient_id=str(citizen_id),
                    recipient_role="citizen",
                    notification_type="WORK_ASSIGNED",
                    title="Your waste complaint has been assigned",
                    message=f"Your report WM-{report['report_number']:04d} has been assigned to the responsible municipal team ({payload.department or 'Solid Waste Management'}).",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=task_out.get("task_number"),
                )
            create_notification(
                recipient_id=target_staff_email,
                recipient_role="municipal_staff",
                notification_type="WORK_ASSIGNED",
                title=f"New Work Order Assigned: WM-{report['report_number']:04d}",
                message=f"You have been assigned to handle waste report WM-{report['report_number']:04d} in {report.get('ward') or 'Ward 1'}. Priority: {(payload.priority or report.get('ai_priority') or 'MEDIUM').upper()}.",
                report_id=report["id"],
                report_number=report["report_number"],
                task_id=task_out.get("task_number"),
            )
        except Exception as notif_err:
            print("ASSIGNMENT NOTIFICATION WARNING:", repr(notif_err))

        return {
            "success": True,
            "message": f"Report #{report['report_number']} successfully assigned to {staff_label}.",
            "report": enriched,
            "task": task_out,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("ASSIGNMENT ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to assign report.",
        ) from exc


@router.post("/manager/{report_id}/verify")
def manager_verify_resolution(
    report_id: str,
    payload: ManagerVerifyResolution,
    current_manager: dict = Depends(require_manager),
) -> dict[str, Any]:
    """Manager only: Approve or reject submitted field resolution."""
    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(status_code=404, detail=f"Report '{report_id}' not found.")
        now_iso = datetime.now(timezone.utc).isoformat()
        manager_name = current_manager.get("full_name") or current_manager.get("email")

        # Manager verifying report: verify manager authorized organization scope
        user_org = (current_manager.get("organization_id") or "").strip().lower()
        rep_org = get_report_organization(admin_supabase, report)
        if user_org and rep_org and user_org != rep_org:
            raise HTTPException(status_code=403, detail="Access forbidden: You can only access reports within your authorized organization.")

        task_res = admin_supabase.table("collection_tasks").select("*").eq("report_id", report["id"]).execute()
        existing_tasks = task_res.data or []
        task = existing_tasks[0] if existing_tasks else None

        if payload.action == "approve":
            new_status = "Resolved"
            task_status = "COMPLETED"
            tag = "VERIFIED_APPROVED"
            msg = f"Resolution for Report #{report['report_number']} approved and marked as Resolved."
        else:
            new_status = "In Progress"
            task_status = "IN_PROGRESS"
            tag = "VERIFIED_REJECTED"
            msg = f"Resolution for Report #{report['report_number']} rejected. Returned to In Progress status."

        rep_res = admin_supabase.table("waste_reports").update({
            "status": new_status,
            "updated_at": now_iso,
        }).eq("id", report["id"]).select("*").execute()
        updated_report = rep_res.data[0] if rep_res.data else report

        updated_task = None
        if task:
            note_entry = f"[{tag} {now_iso[:19]} by {manager_name}]: {payload.manager_note or ''}".strip()
            current_desc = task.get("description") or ""
            updated_desc = (current_desc + f"\n{note_entry}").strip()

            t_res = admin_supabase.table("collection_tasks").update({
                "status": task_status,
                "description": updated_desc,
                "updated_at": now_iso,
            }).eq("id", task["id"]).select("*").execute()
            updated_task = t_res.data[0] if t_res.data else task

        enriched = enrich_report_with_lifecycle(admin_supabase, updated_report, updated_task)

        # Persistent notifications
        try:
            citizen_id = report.get("citizen_id")
            staff_recipient = (task.get("assigned_vehicle") if task else None) or "municipal_staff"
            task_num = (updated_task.get("task_number") if updated_task else None) or (task.get("task_number") if task else None)

            if payload.action == "approve":
                if citizen_id:
                    create_notification(
                        recipient_id=str(citizen_id),
                        recipient_role="citizen",
                        notification_type="REPORT_RESOLVED",
                        title="Waste complaint resolved",
                        message=f"Your report WM-{report['report_number']:04d} has been marked resolved after the required completion process.",
                        report_id=report["id"],
                        report_number=report["report_number"],
                        task_id=task_num,
                    )
                create_notification(
                    recipient_id=staff_recipient,
                    recipient_role="municipal_staff",
                    notification_type="REPORT_RESOLVED",
                    title=f"Resolution Verified & Approved: WM-{report['report_number']:04d}",
                    message=f"Operations Manager ({manager_name}) verified and approved resolution for report WM-{report['report_number']:04d}.",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=task_num,
                )
            else:
                create_notification(
                    recipient_id=staff_recipient,
                    recipient_role="municipal_staff",
                    notification_type="RESOLUTION_REJECTED",
                    title=f"Resolution Verification Rejected: WM-{report['report_number']:04d}",
                    message=f"Manager requested further work on report WM-{report['report_number']:04d}. Reason: {payload.manager_note or 'Rework required'}. Report returned to In Progress.",
                    report_id=report["id"],
                    report_number=report["report_number"],
                    task_id=task_num,
                )
                if citizen_id:
                    create_notification(
                        recipient_id=str(citizen_id),
                        recipient_role="citizen",
                        notification_type="WORK_STARTED",
                        title=f"Work update: WM-{report['report_number']:04d}",
                        message=f"Field crew is continuing collection work on report WM-{report['report_number']:04d} following municipal inspection.",
                        report_id=report["id"],
                        report_number=report["report_number"],
                        task_id=task_num,
                    )
        except Exception as notif_err:
            print("VERIFY NOTIFICATION WARNING:", repr(notif_err))

        return {
            "success": True,
            "message": msg,
            "report": enriched,
            "task": updated_task,
        }
    except HTTPException:
        raise
    except Exception as exc:
        print("MANAGER VERIFY ERROR:", repr(exc))
        raise HTTPException(status_code=500, detail="Failed to verify resolution.") from exc


# =========================================================
# 6. GET SINGLE REPORT DETAILS (ROLE PROTECTED)
# =========================================================

@router.get("/{report_id}")
def get_report_detail(
    report_id: str,
    current_user: dict = Depends(get_authenticated_user),
) -> dict[str, Any]:
    """Retrieve details of a single report by UUID or report_number with role protection."""

    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(
                status_code=404,
                detail=f"Report '{report_id}' not found.",
            )

        # Fetch associated collection tasks if any
        tasks_response = (
            admin_supabase.table("collection_tasks")
            .select("*")
            .eq("report_id", report["id"])
            .order("created_at", desc=True)
            .execute()
        )
        tasks = tasks_response.data or []

        # RBAC: Citizens can only view their own reports
        if current_user["role"] == "citizen" and str(report.get("citizen_id")) != current_user["user_id"]:
            raise HTTPException(
                status_code=403,
                detail="Access forbidden: You can only view your own submitted reports.",
            )

        # RBAC: Municipal Staff can only view reports assigned to them
        if current_user["role"] == "municipal_staff":
            is_assigned, _ = check_report_assignment(report, tasks, current_user)
            if not is_assigned:
                raise HTTPException(
                    status_code=403,
                    detail="Access forbidden: You can only view reports assigned to you.",
                )

        task = tasks[0] if tasks else None
        enriched = enrich_report_with_lifecycle(admin_supabase, report, task)

        return {
            "success": True,
            "report": enriched,
            "tasks": tasks,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("REPORT DETAIL ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="An error occurred while retrieving the report.",
        ) from exc


# =========================================================
# 7. UPDATE REPORT STATUS & DEPARTMENT (MANAGER ONLY)
# =========================================================

@router.patch("/{report_id}/status")
def update_report_status(
    report_id: str,
    payload: ReportStatusUpdate,
    current_manager: dict = Depends(require_manager),
) -> dict[str, Any]:
    """Manager only: Update report status, record department assignment, and log changes."""

    try:
        admin_supabase = get_supabase_admin_client()
        report = get_report_by_id_or_number(admin_supabase, report_id)
        if not report:
            raise HTTPException(
                status_code=404,
                detail=f"Report '{report_id}' not found.",
            )
        now_iso = datetime.now(timezone.utc).isoformat()

        # Update the report status
        update_response = (
            admin_supabase.table("waste_reports")
            .update({
                "status": payload.status,
                "updated_at": now_iso,
            })
            .eq("id", report["id"])
            .select("*")
            .execute()
        )

        updated_reports = update_response.data or []
        if not updated_reports:
            raise RuntimeError("Failed to update report status in database.")

        updated_report = updated_reports[0]
        updated_report["photo_signed_url"] = resolve_photo_url(admin_supabase, updated_report.get("photo_url"))

        # If department or admin note is provided, update or create collection_task
        task = None
        if payload.department or payload.admin_note:
            task_status = (
                "ASSIGNED" if payload.status == "In Progress"
                else ("COMPLETED" if payload.status == "Resolved" else "PENDING")
            )
            task_priority = (
                payload.priority
                or (updated_report.get("ai_priority") or "MEDIUM")
            ).upper()

            task_payload = {
                "task_number": f"TASK-{updated_report['report_number']:04d}",
                "report_id": updated_report["id"],
                "incident_id": f"WM-{updated_report['report_number']:04d}",
                "task_title": f"Dispatch for Waste Report #{updated_report['report_number']}",
                "description": payload.admin_note or updated_report.get("description", ""),
                "priority": task_priority,
                "department": payload.department or "Solid Waste Management",
                "status": task_status,
                "updated_at": now_iso,
            }

            existing_tasks = (
                admin_supabase.table("collection_tasks")
                .select("id")
                .eq("report_id", updated_report["id"])
                .execute()
                .data or []
            )

            if existing_tasks:
                task_res = (
                    admin_supabase.table("collection_tasks")
                    .update(task_payload)
                    .eq("id", existing_tasks[0]["id"])
                    .select("*")
                    .execute()
                )
            else:
                task_res = (
                    admin_supabase.table("collection_tasks")
                    .insert(task_payload)
                    .select("*")
                    .execute()
                )
            task = task_res.data[0] if task_res.data else None

        return {
            "success": True,
            "message": f"Report status successfully updated to '{payload.status}'.",
            "report": updated_report,
            "task": task,
        }

    except HTTPException:
        raise
    except Exception as exc:
        print("REPORT STATUS UPDATE ERROR:", repr(exc))
        raise HTTPException(
            status_code=500,
            detail="Failed to update report status.",
        ) from exc
