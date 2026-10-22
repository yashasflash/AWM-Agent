"""
End-to-End Municipal Workflow Verification Suite
Tests the complete 14-step municipal workflow across Citizen, Municipal Staff, and Operations Manager.
Covers Section 18 (TEST 1 to TEST 10) using actual backend handlers and persistence.
"""

import sys
import os
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.auth.security import (
    ROLE_CITIZEN,
    ROLE_STAFF,
    ROLE_MANAGER,
    get_authenticated_user,
    require_manager,
    require_staff,
)
from app.services.notification_service import notification_service
from app.database import get_supabase_admin_client

# Use a patch so that get_supabase_client always returns the admin client in tests.
# This is necessary because the test fixtures use mock tokens that cannot authenticate
# with Supabase Auth, but all data operations must still hit the real database.
_admin_client_for_tests = None

def _get_admin_client_for_tests(*args, **kwargs):
    global _admin_client_for_tests
    if _admin_client_for_tests is None:
        _admin_client_for_tests = get_supabase_admin_client()
    return _admin_client_for_tests

# Apply the patch so the entire test run uses the admin client for all Supabase calls
supabase_patch = patch("app.api.routes.reports.get_supabase_client", side_effect=_get_admin_client_for_tests)
supabase_patch.start()

client = TestClient(app)

# Test User Fixtures — using real Supabase user IDs so FK constraints are satisfied.
# The citizen/staff/manager accounts below exist in the test Supabase project.
CITIZEN_USER = {
    "user_id": "79aff92f-8bf3-48f6-a3b5-78bf295fb0fd",
    "email": "citizen_test_1792231046@awmtest.gov",
    "full_name": "Ramesh Kumar (Citizen)",
    "role": ROLE_CITIZEN,
    "place": "Ward 4 - Commercial Hub",
    "state": "State",
    "municipality": "Central Municipality",
    "organization_id": "MUNICIPALITY-MAIN",
    "is_profile_complete": True,
    "access_token": "mock-token-cit",
    "is_manager": False,
    "is_staff": False,
    "is_citizen": True,
    "is_admin": False,
    "is_pending_approval": False,
}

STAFF_USER = {
    "user_id": "55245f2e-2149-44e6-a5ed-558c1112f8ab",
    "email": "staff_test_1792231046@awmtest.gov",
    "full_name": "Suresh Patel (Sanitation Officer)",
    "role": ROLE_STAFF,
    "staff_id": "STF-50101",
    "place": "Ward 4 - Commercial Hub",
    "state": "State",
    "municipality": "Central Municipality",
    "organization": "Solid Waste Management",
    "organization_id": "MUNICIPALITY-MAIN",
    "is_profile_complete": True,
    "access_token": "mock-token-stf",
    "is_manager": False,
    "is_staff": True,
    "is_citizen": False,
    "is_admin": False,
    "is_pending_approval": False,
}

MANAGER_USER = {
    "user_id": "8692b994-120d-40a7-92f9-aee87d338475",
    "email": "mgr_test_1792231046@awmtest.gov",
    "full_name": "Yashas (Operations Manager)",
    "role": ROLE_MANAGER,
    "place": "Headquarters",
    "state": "State",
    "municipality": "Central Municipality",
    "organization_id": "MUNICIPALITY-MAIN",
    "is_profile_complete": True,
    "access_token": "mock-token-mgr",
    "is_manager": True,
    "is_staff": False,
    "is_citizen": False,
    "is_admin": True,
    "is_pending_approval": False,
}

def run_all_workflow_tests():
    print("=" * 60)
    print("AWM AGENT — END-TO-END MUNICIPAL WORKFLOW TEST SUITE")
    print("=" * 60)

    # -------------------------------------------------------------
    # TEST 1: Citizen submits a new report
    # -------------------------------------------------------------
    print("\n[TEST 1] Citizen submits a new report...")
    app.dependency_overrides[get_authenticated_user] = lambda: CITIZEN_USER
    
    report_payload = {
        "waste_category": "Garbage Overflow",
        "description": "Large garbage heap spilling onto pedestrian walkway near bus stand.",
        "ward": "Ward 4 - Commercial Hub",
        "address": "Opposite Central Metro Station, Main Road",
        "latitude": 12.9716,
        "longitude": 77.5946,
    }
    
    create_res = client.post("/api/v1/reports/", json=report_payload)
    assert create_res.status_code in (200, 201), f"Submit failed: {create_res.text}"
    create_data = create_res.json()
    assert create_data.get("success") is True, "Create response must indicate success"
    
    created_report = create_data.get("report")
    assert created_report is not None, "Report object must be returned"
    report_id = created_report["id"]
    report_num = created_report.get("report_number")
    print(f"  -> Report created successfully: ID={report_id}, Number=WM-{report_num}")
    print(f"  -> Initial Status: {created_report.get('status')}")
    print("  [PASS] TEST 1: Citizen report submitted and saved.")

    # -------------------------------------------------------------
    # TEST 2: Manager assigns the report
    # -------------------------------------------------------------
    print("\n[TEST 2] Manager assigns report to municipal staff...")
    app.dependency_overrides[get_authenticated_user] = lambda: MANAGER_USER
    app.dependency_overrides[require_manager] = lambda: MANAGER_USER
    
    assign_payload = {
        "staff_email": STAFF_USER["email"],
        "staff_name": STAFF_USER["full_name"],
        "department": "Solid Waste Management",
        "priority": "HIGH",
        "manager_note": "Immediate dispatch required. Clear sidewalk and disinfect area.",
    }
    
    assign_res = client.post(f"/api/v1/reports/manager/{report_id}/assign", json=assign_payload)
    assert assign_res.status_code == 200, f"Assignment failed: {assign_res.text}"
    assign_data = assign_res.json()
    assert assign_data.get("success") is True
    assigned_rep = assign_data.get("report")
    assert assigned_rep["status"] in ["Assigned", "In Progress"]
    assert assigned_rep.get("assigned_staff") == STAFF_USER["email"]
    print(f"  -> Assigned to: {assigned_rep.get('assigned_staff_name')} ({assigned_rep.get('assigned_staff')})")
    print(f"  -> Task Number: {assigned_rep.get('task_number') or assigned_rep.get('task_id')}")

    # Verify citizen received persistent notification
    cit_notifs = notification_service.get_notifications_for_user(
        CITIZEN_USER["user_id"], CITIZEN_USER["email"], CITIZEN_USER["role"]
    )
    assign_notifs = [n for n in cit_notifs if n.get("type") == "WORK_ASSIGNED" and str(n.get("report_id")) == str(report_id)]
    assert len(assign_notifs) > 0, "Citizen must receive WORK_ASSIGNED persistent notification"
    print(f"  -> Citizen persistent notification verified: '{assign_notifs[0]['title']}'")
    print("  [PASS] TEST 2: Manager assignment saved and citizen notification verified.")

    # -------------------------------------------------------------
    # TEST 3: Municipal staff accepts and starts work
    # -------------------------------------------------------------
    print("\n[TEST 3] Municipal staff accepts and starts work...")
    app.dependency_overrides[get_authenticated_user] = lambda: STAFF_USER
    app.dependency_overrides[require_staff] = lambda: STAFF_USER

    # Staff checks assigned work
    staff_res = client.get("/api/v1/reports/staff/assigned")
    assert staff_res.status_code == 200
    staff_orders = staff_res.json().get("reports", [])
    matching_order = [o for o in staff_orders if str(o["id"]) == str(report_id)]
    assert len(matching_order) > 0, "Staff must see assigned report in My Assigned Work"
    print(f"  -> Found {len(staff_orders)} work orders in staff dispatch queue.")

    # Staff accepts assignment
    accept_res = client.patch(f"/api/v1/reports/staff/{report_id}/accept")
    assert accept_res.status_code == 200, f"Accept failed: {accept_res.text}"
    accept_data = accept_res.json()
    assert accept_data.get("success") is True
    print(f"  -> Staff accepted assignment for report #{report_num}")

    # Staff starts work
    start_res = client.patch(f"/api/v1/reports/staff/{report_id}/start")
    assert start_res.status_code == 200, f"Start work failed: {start_res.text}"
    start_data = start_res.json()
    assert start_data.get("success") is True
    assert start_data["report"]["status"] == "In Progress"
    print(f"  -> Work started. Updated report status: {start_data['report']['status']}")
    print("  [PASS] TEST 3: Staff accept and start work transitions verified.")

    # -------------------------------------------------------------
    # TEST 4: Municipal staff submits completion details
    # -------------------------------------------------------------
    print("\n[TEST 4] Municipal staff submits completion details...")
    app.dependency_overrides[get_authenticated_user] = lambda: STAFF_USER
    app.dependency_overrides[require_staff] = lambda: STAFF_USER

    resolve_payload = {
        "staff_note": "Waste completely cleared using compactor vehicle. Walkway sanitised with lime powder.",
        "photo_url": "https://supabase-storage.awm.gov/evidence/cleanup_001.jpg",
        "direct_resolve": False,  # requires manager verification
    }
    
    submit_res = client.patch(f"/api/v1/reports/staff/{report_id}/resolve", json=resolve_payload)
    assert submit_res.status_code == 200, f"Submit resolution failed: {submit_res.text}"
    submit_data = submit_res.json()
    assert submit_data.get("success") is True
    assert submit_data["report"]["status"] == "Under Review"
    print(f"  -> Resolution submitted. Status: {submit_data['report']['status']} (Awaiting Manager Verification)")

    # Verify notifications generated for citizen and manager
    cit_notifs_after = notification_service.get_notifications_for_user(
        CITIZEN_USER["user_id"], CITIZEN_USER["email"], CITIZEN_USER["role"]
    )
    comp_notifs = [n for n in cit_notifs_after if n.get("type") == "WORK_COMPLETED" and str(n.get("report_id")) == str(report_id)]
    assert len(comp_notifs) > 0, "Citizen must receive WORK_COMPLETED notification"
    print(f"  -> Citizen completion notification verified: '{comp_notifs[0]['title']}'")
    print("  [PASS] TEST 4: Municipal completion details submitted and notifications issued.")

    # -------------------------------------------------------------
    # TEST 5: Manager reviews and verifies resolution
    # -------------------------------------------------------------
    print("\n[TEST 5] Manager reviews and verifies resolution...")
    app.dependency_overrides[get_authenticated_user] = lambda: MANAGER_USER
    app.dependency_overrides[require_manager] = lambda: MANAGER_USER

    verify_payload = {
        "action": "approve",
        "manager_note": "Inspected photo evidence and work completion log. Verified satisfactory clearance.",
    }
    verify_res = client.post(f"/api/v1/reports/manager/{report_id}/verify", json=verify_payload)
    assert verify_res.status_code == 200, f"Verification failed: {verify_res.text}"
    verify_data = verify_res.json()
    assert verify_data.get("success") is True
    assert verify_data["report"]["status"] == "Resolved"
    print(f"  -> Report marked Genuine Resolved: status={verify_data['report']['status']}")

    # Verify citizen final resolution notification
    cit_notifs_final = notification_service.get_notifications_for_user(
        CITIZEN_USER["user_id"], CITIZEN_USER["email"], CITIZEN_USER["role"]
    )
    resolved_notifs = [n for n in cit_notifs_final if n.get("type") == "REPORT_RESOLVED" and str(n.get("report_id")) == str(report_id)]
    assert len(resolved_notifs) > 0, "Citizen must receive REPORT_RESOLVED notification"
    print(f"  -> Final Citizen resolution notification verified: '{resolved_notifs[0]['title']}'")
    print("  [PASS] TEST 5: Resolution verification completed and report marked Resolved.")

    # -------------------------------------------------------------
    # TEST 6: Citizen Track Complaint endpoint & Real-time Timeline
    # -------------------------------------------------------------
    print("\n[TEST 6] Citizen retrieves live Track Complaint details...")
    app.dependency_overrides[get_authenticated_user] = lambda: CITIZEN_USER

    track_res = client.get(f"/api/v1/reports/{report_id}")
    assert track_res.status_code == 200, f"Track complaint fetch failed: {track_res.text}"
    track_data = track_res.json()
    rep = track_data["report"]

    # Verify 12 required fields
    assert "id" in rep and rep["id"] is not None
    assert "waste_category" in rep and rep["waste_category"] is not None
    assert "description" in rep and rep["description"] is not None
    assert "address" in rep
    assert "ward" in rep
    assert "created_at" in rep
    assert "priority" in rep or "ai_priority" in rep
    assert "status" in rep and rep["status"] == "Resolved"
    assert "assigned_department" in rep
    assert "assigned_staff_name" in rep or "assigned_officer" in rep
    assert "task_id" in rep or "task_number" in rep
    assert "last_updated_at" in rep or "updated_at" in rep

    # Verify Prompt Status Banner Message
    assert rep.get("status_message") == "Your waste complaint has been resolved.", \
        f"Banner mismatch: {rep.get('status_message')}"
    print(f"  -> Status Message Banner: '{rep.get('status_message')}'")

    # Verify timeline nodes have state: COMPLETED, CURRENT, PENDING
    timeline = rep.get("timeline", [])
    assert len(timeline) >= 5, "Timeline must contain workflow nodes"
    for event in timeline:
        assert event.get("state") in ["COMPLETED", "CURRENT", "PENDING"], \
            f"Event {event.get('stage')} has invalid state: {event.get('state')}"
        print(f"     • Stage: {event.get('title'):<22} State: {event.get('state'):<10} Time: {event.get('timestamp')}")
    print("  [PASS] TEST 6: Citizen Track Complaint has all 12 fields, exact banner, and verified timeline.")

    # -------------------------------------------------------------
    # TEST 7: Persistent Notification opened & read status persisted
    # -------------------------------------------------------------
    print("\n[TEST 7] Notification read tracking...")
    app.dependency_overrides[get_authenticated_user] = lambda: CITIZEN_USER

    notifs_res = client.get("/api/v1/notifications/")
    assert notifs_res.status_code == 200
    n_list = notifs_res.json().get("notifications", [])
    assert len(n_list) > 0, "Should have notifications in feed"
    target_notif = n_list[0]
    notif_id = target_notif["id"]

    # Mark as read
    read_res = client.patch(f"/api/v1/notifications/{notif_id}/read")
    assert read_res.status_code == 200, f"Mark read failed: {read_res.text}"
    read_data = read_res.json()
    assert read_data.get("success") is True

    # Re-fetch and verify persistent read state
    refetch_res = client.get("/api/v1/notifications/")
    updated_notif = next((n for n in refetch_res.json()["notifications"] if n["id"] == notif_id), None)
    assert updated_notif is not None
    assert updated_notif.get("is_read") == 1
    print(f"  -> Notification {notif_id} persistently marked as read (is_read=1)")
    print("  [PASS] TEST 7: Notification read status persisted.")

    # -------------------------------------------------------------
    # TEST 8: RBAC Security enforcement
    # -------------------------------------------------------------
    print("\n[TEST 8] Testing RBAC Security & Unauthorized Access Denial...")
    app.dependency_overrides[get_authenticated_user] = lambda: CITIZEN_USER
    # Remove any manager/staff overrides so RBAC checks fire correctly
    app.dependency_overrides.pop(require_manager, None)
    app.dependency_overrides.pop(require_staff, None)

    # Citizen trying to assign report -> 403 Forbidden
    unauth_assign = client.post(f"/api/v1/reports/manager/{report_id}/assign", json={
        "staff_email": "staff@awm.gov",
        "department": "Sanitation"
    })
    assert unauth_assign.status_code == 403, f"Expected 403, got {unauth_assign.status_code}"
    print("  -> Citizen assignment attempt correctly denied with HTTP 403")

    # Citizen trying to verify resolution -> 403 Forbidden
    unauth_verify = client.post(f"/api/v1/reports/manager/{report_id}/verify", json={
        "action": "approve"
    })
    assert unauth_verify.status_code == 403, f"Expected 403, got {unauth_verify.status_code}"
    print("  -> Citizen verification attempt correctly denied with HTTP 403")

    # Citizen trying to view manager reports queue -> 403 Forbidden
    unauth_mgr_q = client.get("/api/v1/reports/manager/all")
    assert unauth_mgr_q.status_code == 403, f"Expected 403, got {unauth_mgr_q.status_code}"
    print("  -> Citizen manager queue attempt correctly denied with HTTP 403")
    print("  [PASS] TEST 8: RBAC Security correctly blocks unauthorized operations.")

    # -------------------------------------------------------------
    # TEST 9: API Error Handling on non-existent entities
    # -------------------------------------------------------------
    print("\n[TEST 9] Testing Error Handling on non-existent resources...")
    app.dependency_overrides[get_authenticated_user] = lambda: CITIZEN_USER

    invalid_res = client.get("/api/v1/reports/non-existent-report-999999")
    assert invalid_res.status_code in [404, 400], f"Expected 404 or 400, got {invalid_res.status_code}"
    print("  -> Non-existent report correctly returns HTTP 404/400 error instead of false success")

    app.dependency_overrides[get_authenticated_user] = lambda: STAFF_USER
    invalid_staff_action = client.patch("/api/v1/reports/staff/non-existent-report-999999/accept")
    assert invalid_staff_action.status_code in [404, 400], f"Expected 404, got {invalid_staff_action.status_code}"
    print("  -> Invalid staff action correctly returns HTTP 404 error")
    print("  [PASS] TEST 9: Robust error handling verified.")

    # -------------------------------------------------------------
    # TEST 10: Deduplication on retried operations
    # -------------------------------------------------------------
    print("\n[TEST 10] Testing Deduplication on retried operations...")
    app.dependency_overrides[get_authenticated_user] = lambda: MANAGER_USER
    app.dependency_overrides[require_manager] = lambda: MANAGER_USER

    # Count notifications for citizen before duplicate assignment attempt
    notifs_before = notification_service.get_notifications_for_user(
        CITIZEN_USER["user_id"], CITIZEN_USER["email"], CITIZEN_USER["role"]
    )
    assigned_count_before = len([n for n in notifs_before if n.get("type") == "WORK_ASSIGNED" and str(n.get("report_id")) == str(report_id)])

    # Retry assignment on the same report
    re_assign = client.post(f"/api/v1/reports/manager/{report_id}/assign", json=assign_payload)
    assert re_assign.status_code == 200

    notifs_after = notification_service.get_notifications_for_user(
        CITIZEN_USER["user_id"], CITIZEN_USER["email"], CITIZEN_USER["role"]
    )
    assigned_count_after = len([n for n in notifs_after if n.get("type") == "WORK_ASSIGNED" and str(n.get("report_id")) == str(report_id)])
    assert assigned_count_after == assigned_count_before, \
        f"Duplicate notification was created! Before: {assigned_count_before}, After: {assigned_count_after}"
    print(f"  -> Retried assignment did NOT create duplicate notification (count remained {assigned_count_before})")
    print("  [PASS] TEST 10: Idempotent assignment and notification deduplication verified.")

    print("\n" + "=" * 60)
    print("ALL 10 WORKFLOW VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

    # -------------------------------------------------------------
    # CLEANUP: Delete test records from Supabase and SQLite
    # -------------------------------------------------------------
    print("\n[CLEANUP] Removing test records from Supabase and SQLite notifications...")
    try:
        from app.database import get_supabase_admin_client
        _cleanup_admin = get_supabase_admin_client()
        # Delete collection_task
        _cleanup_admin.table("collection_tasks").delete().eq("report_id", report_id).execute()
        # Delete report
        _cleanup_admin.table("waste_reports").delete().eq("id", report_id).execute()
        print(f"  -> Deleted test report {report_id} and associated task from Supabase")
    except Exception as ce:
        print(f"  WARNING: Supabase cleanup failed: {ce}")

    # Remove test notifications from SQLite
    try:
        import sqlite3, os
        db_path = os.path.join(os.path.dirname(__file__), "awm_notifications.db")
        with sqlite3.connect(db_path) as conn:
            conn.execute("DELETE FROM notifications WHERE report_id = ?", (report_id,))
            conn.execute(
                "DELETE FROM notifications WHERE recipient_id IN (?, ?, ?)",
                (CITIZEN_USER["user_id"], STAFF_USER["user_id"], MANAGER_USER["user_id"]),
            )
            conn.commit()
        print("  -> Cleaned SQLite test notification records")
    except Exception as se:
        print(f"  WARNING: SQLite cleanup failed: {se}")

    print("[CLEANUP] Complete.")


if __name__ == "__main__":
    run_all_workflow_tests()
