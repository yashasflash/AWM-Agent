"""
Automated Test for Google Authentication, Role Verification, and Post-Login Routing.
Verifies all 3 roles independently:
1. Citizen Google login resolves to Citizen role and does not gain elevated access.
2. Approved Staff Google login resolves to Municipal Staff and preserves staff role.
3. Approved Manager Google login resolves to Manager and preserves manager role.
4. Pending accounts (Staff / Manager applicants) resolve to pending approval.
5. Logging in from any portal does NOT demote an account to Citizen.
"""

from fastapi.testclient import TestClient
from app.main import app
from app.auth.security import (
    get_authenticated_user,
    ROLE_CITIZEN,
    ROLE_STAFF,
    ROLE_MANAGER,
)

client = TestClient(app)

def test_google_login_citizen():
    print("\n--- 1. Testing Citizen Google Login ---")
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "00000000-0000-0000-0000-000000000001",
        "email": "resident.user@gmail.com",
        "full_name": "Resident User",
        "role": ROLE_CITIZEN,
        "approval_status": "approved",
        "is_pending_approval": False,
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "organization_id": "MUNICIPALITY-MAIN",
    }

    res = client.post("/api/v1/auth/google-sync", json={})
    assert res.status_code == 200, res.text
    data = res.json()["user"]
    assert data["role"] == "citizen"
    assert data["is_citizen"] is True
    assert data["is_manager"] is False
    assert data["is_staff"] is False
    assert data["approval_status"] == "approved"
    assert data["is_pending_approval"] is False
    print("  [PASS] Citizen Google login resolved to role='citizen', approved")


def test_google_login_manager_preservation():
    print("\n--- 2. Testing Manager Google Login & Preservation ---")
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "00000000-0000-0000-0000-000000000002",
        "email": "t.r.yashas076@gmail.com",
        "full_name": "Yashas Manager",
        "role": ROLE_MANAGER,
        "approval_status": "approved",
        "is_pending_approval": False,
        "is_manager": True,
        "is_staff": False,
        "is_citizen": False,
        "manager_id": "MGR-80101",
        "organization_id": "MUNICIPALITY-MAIN",
    }

    # Even if requested_role is citizen (e.g. from /login/user or default), manager role MUST NOT be demoted
    res = client.post("/api/v1/auth/google-sync", json={"requested_role": "citizen"})
    assert res.status_code == 200, res.text
    data = res.json()["user"]
    assert data["role"] == "manager", f"Manager was demoted to {data['role']}!"
    assert data["is_manager"] is True
    assert data["manager_id"] == "MGR-80101"
    assert data["approval_status"] == "approved"
    assert data["is_pending_approval"] is False
    print("  [PASS] Manager Google login preserved role='manager' (no demotion to citizen)")


def test_google_login_staff_preservation():
    print("\n--- 3. Testing Municipal Staff Google Login & Preservation ---")
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "00000000-0000-0000-0000-000000000003",
        "email": "sanitation.lead@gmail.com",
        "full_name": "Sanitation Officer Lead",
        "role": ROLE_STAFF,
        "approval_status": "approved",
        "is_pending_approval": False,
        "is_manager": False,
        "is_staff": True,
        "is_citizen": False,
        "staff_id": "STF-60259",
        "organization_id": "MUNICIPALITY-MAIN",
    }

    # Even if requested_role is citizen, staff role MUST NOT be demoted
    res = client.post("/api/v1/auth/google-sync", json={"requested_role": "citizen"})
    assert res.status_code == 200, res.text
    data = res.json()["user"]
    assert data["role"] == "municipal_staff", f"Staff was demoted to {data['role']}!"
    assert data["is_staff"] is True
    assert data["staff_id"] == "STF-60259"
    assert data["approval_status"] == "approved"
    assert data["is_pending_approval"] is False
    print("  [PASS] Staff Google login preserved role='municipal_staff' (no demotion to citizen)")


def test_google_login_pending_applicant():
    print("\n--- 4. Testing Pending Applicant Google Login ---")
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "00000000-0000-0000-0000-000000000004",
        "email": "applicant@gmail.com",
        "full_name": "Applicant",
        "role": ROLE_CITIZEN,
        "requested_role": "municipal_staff",
        "approval_status": "pending",
        "is_pending_approval": True,
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "staff_id": "STF-12345",
        "organization_id": "MUNICIPALITY-MAIN",
    }

    res = client.post("/api/v1/auth/google-sync", json={})
    assert res.status_code == 200, res.text
    data = res.json()["user"]
    assert data["approval_status"] == "pending"
    assert data["is_pending_approval"] is True
    assert data["is_staff"] is False
    assert data["is_manager"] is False
    print("  [PASS] Pending applicant correctly tagged approval_status='pending', is_pending_approval=True")

    app.dependency_overrides.clear()

if __name__ == "__main__":
    test_google_login_citizen()
    test_google_login_manager_preservation()
    test_google_login_staff_preservation()
    test_google_login_pending_applicant()
    print("\n=======================================================")
    print("ALL GOOGLE AUTH, ROLE PRESERVATION & ROUTING TESTS PASSED!")
    print("=======================================================\n")
