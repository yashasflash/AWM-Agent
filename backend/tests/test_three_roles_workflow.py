"""
AWM Three-Role End-to-End Workflow Test Suite
Validates all 5 mandatory workflow tests:
1. Citizen submit and view
2. Manager oversight and staff assignment
3. Municipal Staff work order retrieval and resolution
4. Citizen tracking updated status
5. Strict RBAC enforcement and isolation
"""

import httpx
import pytest

BASE_URL = "http://127.0.0.1:8000"

CITIZEN_CREDENTIALS = {"email": "citizen@awm.gov", "password": "password123"}
STAFF_CREDENTIALS = {"email": "staff@awm.gov", "password": "password123"}
MANAGER_CREDENTIALS = {"email": "tryashas076@gmail.com", "password": "Password123!"}

# Shared report tracker across sequential workflow tests
shared_context = {}


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=120.0) as c:
        yield c


def login_as(client, creds):
    res = client.post("/api/v1/auth/login", json=creds)
    assert res.status_code == 200, f"Login failed for {creds['email']}: {res.text}"
    data = res.json()
    assert data["success"] is True
    return data["access_token"], data["user"]


def test_workflow_1_citizen_submit_and_view(client):
    """
    TEST 1:
    Citizen logs in.
    Citizen submits a waste report.
    Report is saved in Supabase.
    AI classification workflow is handled.
    Citizen sees the submitted report.
    """
    token, user = login_as(client, CITIZEN_CREDENTIALS)
    assert user["role"] == "citizen"

    # Submit a new report
    create_payload = {
        "waste_category": "Street Waste",
        "description": "Scattered plastic bottles and street debris obstructing the sidewalk near the playground.",
        "ward": "Ward 2",
        "address": "42 Park Avenue, North District",
        "latitude": 16.7123,
        "longitude": 74.5234,
    }

    create_res = client.post(
        "/api/v1/reports/",
        json=create_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code in (200, 201), f"Report creation failed: {create_res.text}"
    created_data = create_res.json()
    assert created_data["success"] is True
    report = created_data["report"]

    assert report["report_number"] > 0
    assert report["status"] in ("Submitted", "Under Review", "In Progress")
    assert report["waste_category"] == "Street Waste"

    # Save to shared context for tests 2, 3, 4
    shared_context["report_id"] = report["id"]
    shared_context["report_number"] = report["report_number"]

    # Citizen retrieves their report details
    get_res = client.get(
        f"/api/v1/reports/{report['id']}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    retrieved = get_res.json()["report"]
    assert retrieved["id"] == report["id"]
    assert retrieved["report_number"] == report["report_number"]


def test_workflow_2_manager_sees_and_assigns(client):
    """
    TEST 2:
    Manager logs in.
    Manager sees the new report.
    Manager assigns the report to a municipal staff member.
    Assignment is saved in the database.
    """
    assert "report_id" in shared_context, "Test 1 must run first"
    report_id = shared_context["report_id"]
    report_number = shared_context["report_number"]

    token, user = login_as(client, MANAGER_CREDENTIALS)
    assert user["role"] == "manager"

    # Manager retrieves all reports
    all_res = client.get(
        "/api/v1/reports/manager/all?limit=50",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert all_res.status_code == 200
    all_data = all_res.json()
    assert all_data["success"] is True
    matching = [r for r in all_data["reports"] if r["id"] == report_id or r["report_number"] == report_number]
    assert len(matching) > 0, "Manager should be able to see the citizen's submitted report"

    # Manager assigns report to municipal staff
    assign_payload = {
        "staff_email": "staff@awm.gov",
        "staff_name": "Marcus Chen (Sanitation Crew A)",
        "department": "Rapid Response Team",
        "priority": "HIGH",
        "manager_note": "Urgent sidewalk clearance requested for Ward 2 playground area.",
    }

    assign_res = client.post(
        f"/api/v1/reports/manager/{report_id}/assign",
        json=assign_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert assign_res.status_code == 200, f"Assignment failed: {assign_res.text}"
    assign_data = assign_res.json()
    assert assign_data["success"] is True
    task = assign_data["task"]
    assert task["assigned_vehicle"] == "staff@awm.gov"
    assert task["status"] in ("ASSIGNED", "IN_PROGRESS")

    # Verify duplicate assignment prevention
    dup_res = client.post(
        f"/api/v1/reports/manager/{report_id}/assign",
        json=assign_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert dup_res.status_code == 400
    assert "Duplicate assignment prevented" in dup_res.json()["detail"]


def test_workflow_3_staff_views_and_resolves(client):
    """
    TEST 3:
    Municipal staff logs in.
    Assigned report appears in their dashboard.
    Staff opens the report.
    Staff accepts assignment (stage -> ACCEPTED).
    Staff starts work (stage -> IN_PROGRESS).
    Staff submits resolution (stage -> RESOLUTION_SUBMITTED).
    Manager inspects and verifies resolution (status -> Resolved).
    All states saved through FastAPI and persisted in Supabase.
    """
    assert "report_id" in shared_context, "Test 2 must run first"
    report_id = shared_context["report_id"]
    report_number = shared_context["report_number"]

    token, user = login_as(client, STAFF_CREDENTIALS)
    assert user["role"] == "municipal_staff"

    # Staff checks assigned work orders
    assigned_res = client.get(
        "/api/v1/reports/staff/assigned",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert assigned_res.status_code == 200, f"Staff retrieval failed: {assigned_res.text}"
    assigned_data = assigned_res.json()
    assert assigned_data["success"] is True
    matching = [r for r in assigned_data["reports"] if r["id"] == report_id or r["report_number"] == report_number]
    assert len(matching) > 0, "Assigned report must appear in staff member's dashboard"

    # Staff opens report details
    detail_res = client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["report"]["id"] == report_id

    # 1. Staff accepts assignment
    accept_res = client.patch(
        f"/api/v1/reports/staff/{report_id}/accept",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert accept_res.status_code == 200, f"Staff accept failed: {accept_res.text}"
    assert accept_res.json()["success"] is True
    assert accept_res.json()["report"]["lifecycle_stage"] == "ACCEPTED"

    # 2. Staff starts work
    start_res = client.patch(
        f"/api/v1/reports/staff/{report_id}/start",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert start_res.status_code == 200, f"Staff start work failed: {start_res.text}"
    assert start_res.json()["success"] is True
    assert start_res.json()["report"]["lifecycle_stage"] == "IN_PROGRESS"

    # 3. Staff submits resolution notes
    resolve_res = client.patch(
        f"/api/v1/reports/staff/{report_id}/resolve",
        json={
            "staff_note": "Field collection complete. 3 large bins emptied and surrounding pavement cleaned.",
            "direct_resolve": False,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resolve_res.status_code == 200, f"Staff resolve failed: {resolve_res.text}"
    assert resolve_res.json()["success"] is True
    assert resolve_res.json()["report"]["lifecycle_stage"] == "RESOLUTION_SUBMITTED"

    # 4. Manager verifies and approves resolution
    mgr_token, _ = login_as(client, MANAGER_CREDENTIALS)
    verify_res = client.post(
        f"/api/v1/reports/manager/{report_id}/verify",
        json={
            "action": "approve",
            "manager_note": "Verified by Operations Manager on field audit. Cleaned satisfactorily.",
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert verify_res.status_code == 200, f"Manager verify failed: {verify_res.text}"
    verify_data = verify_res.json()
    assert verify_data["success"] is True
    assert verify_data["report"]["status"] == "Resolved"
    assert verify_data["report"]["lifecycle_stage"] == "RESOLVED"


def test_workflow_4_citizen_sees_updated_status(client):
    """
    TEST 4:
    Citizen logs in again.
    Citizen sees the updated report status.
    Citizen sees lifecycle timestamps, resolution notes, and final banner status.
    """
    assert "report_id" in shared_context, "Test 3 must run first"
    report_id = shared_context["report_id"]

    token, user = login_as(client, CITIZEN_CREDENTIALS)
    assert user["role"] == "citizen"

    # Citizen fetches report details
    detail_res = client.get(
        f"/api/v1/reports/{report_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_res.status_code == 200
    report = detail_res.json()["report"]
    assert report["status"] == "Resolved", "Citizen must see the updated 'Resolved' status"
    assert report["lifecycle_stage"] == "RESOLVED"
    assert "Field collection complete. 3 large bins emptied and surrounding pavement cleaned." in report["resolution_notes"]
    
    # Check that final timeline stage description is 'Complaint Resolved Successfully'
    resolved_stage = [s for s in report["timeline"] if s["stage"] == "RESOLVED"]
    assert len(resolved_stage) == 1
    assert resolved_stage[0]["description"] == "Complaint Resolved Successfully"
    assert resolved_stage[0]["completed"] is True

    # Check Citizen My Reports list also reflects Resolved
    my_reports_res = client.get(
        "/api/v1/reports/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert my_reports_res.status_code == 200
    my_matching = [r for r in my_reports_res.json()["reports"] if r["id"] == report_id]
    assert len(my_matching) == 1
    assert my_matching[0]["status"] == "Resolved"


def test_workflow_5_rbac_and_security_enforcement(client):
    """
    TEST 5:
    Verify that citizens cannot access manager dashboards.
    Verify that staff cannot access manager-only operations.
    Verify that unauthorized users cannot assign reports.
    """
    citizen_token, _ = login_as(client, CITIZEN_CREDENTIALS)
    staff_token, _ = login_as(client, STAFF_CREDENTIALS)

    # 1. Citizen cannot access Manager reports list
    res = client.get(
        "/api/v1/reports/manager/all",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res.status_code == 403, f"Citizen should be forbidden from manager endpoint, got {res.status_code}"

    # 2. Citizen cannot access Staff work orders
    res = client.get(
        "/api/v1/reports/staff/assigned",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res.status_code == 403, f"Citizen should be forbidden from staff endpoint, got {res.status_code}"

    # 3. Citizen cannot assign reports
    res = client.post(
        "/api/v1/reports/manager/125/assign",
        json={"staff_email": "staff@awm.gov"},
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res.status_code == 403, f"Citizen should be forbidden from assigning reports, got {res.status_code}"

    # 4. Staff cannot access Manager reports list
    res = client.get(
        "/api/v1/reports/manager/all",
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res.status_code == 403, f"Staff should be forbidden from manager endpoint, got {res.status_code}"

    # 5. Staff cannot assign reports
    res = client.post(
        "/api/v1/reports/manager/125/assign",
        json={"staff_email": "staff@awm.gov"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res.status_code == 403, f"Staff should be forbidden from assigning reports, got {res.status_code}"

    # 6. Staff cannot assign user roles
    res = client.post(
        "/api/v1/auth/assign-role",
        json={"user_id": "dummy-id", "role": "manager"},
        headers={"Authorization": f"Bearer {staff_token}"},
    )
    assert res.status_code == 403, f"Staff should be forbidden from assigning roles, got {res.status_code}"

    # 7. Citizen cannot view reports belonging to other citizens
    # Report 125 belongs to tryashas076@gmail.com, not citizen@awm.gov
    res = client.get(
        "/api/v1/reports/125",
        headers={"Authorization": f"Bearer {citizen_token}"},
    )
    assert res.status_code == 403, f"Citizen should be forbidden from viewing other citizen's report, got {res.status_code}"
