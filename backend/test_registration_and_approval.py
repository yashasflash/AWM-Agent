import os
import sys
from fastapi.testclient import TestClient
from app.main import app
from app.auth.security import (
    ROLE_CITIZEN,
    ROLE_STAFF,
    ROLE_MANAGER,
    get_authenticated_user,
    require_citizen,
    require_staff,
    require_manager,
    MANAGER_EMAILS,
)

client = TestClient(app)

def test_registration_and_approval_workflow():
    print("\n--- Testing Complete Registration & Approval Lifecycle ---")

    # 1. Test Citizen Registration (Auto-approved)
    citizen_meta = {
        "user_id": "c-auto-01",
        "email": "civic.tester@gmail.com",
        "full_name": "Civic Tester",
        "role": ROLE_CITIZEN,
        "requested_role": ROLE_CITIZEN,
        "approval_status": "approved",
        "is_pending_approval": False,
        "organization": "Central Municipality",
        "district": "Central District",
        "ward": "Ward 2",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "token-cit",
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "is_admin": False,
    }

    assert require_citizen(citizen_meta) == citizen_meta
    print("  [PASS] Citizen auto-approved & granted Citizen access immediately")

    # Citizen trying staff endpoint -> 403
    try:
        require_staff(citizen_meta)
        assert False
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
        print("  [PASS] Citizen cannot access Staff endpoint (403 Forbidden)")

    # 2. Test Municipal Staff Registration (Pending Approval)
    pending_staff = {
        "user_id": "s-pending-01",
        "email": "field.applicant@gmail.com",
        "full_name": "Field Applicant",
        "role": ROLE_CITIZEN,
        "requested_role": ROLE_STAFF,
        "approval_status": "pending",
        "is_pending_approval": True,
        "organization": "City Sanitation Board",
        "district": "North District",
        "ward": "Ward 1",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "token-pending-staff",
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "is_admin": False,
    }

    try:
        require_staff(pending_staff)
        assert False
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
        assert "awaiting Manager approval" in getattr(e, "detail", "")
        print("  [PASS] Pending Municipal Staff blocked with: 'awaiting Manager approval'")

    # 3. Test Manager Registration (Pending Approval)
    pending_manager = {
        "user_id": "m-pending-01",
        "email": "new.director@gmail.com",
        "full_name": "Director Applicant",
        "role": ROLE_CITIZEN,
        "requested_role": ROLE_MANAGER,
        "approval_status": "pending",
        "is_pending_approval": True,
        "organization": "Metropolitan Waste Division",
        "district": "HQ",
        "ward": "Ward 1",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "token-pending-manager",
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "is_admin": False,
    }

    try:
        require_manager(pending_manager)
        assert False
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
        assert "submitted for authorization" in getattr(e, "detail", "")
        print("  [PASS] Pending Manager blocked with: 'submitted for authorization'")

    # 4. Authorized Manager Access & Super-Admin Exemption
    active_manager = {
        "user_id": "m-approved-01",
        "email": "t.r.yashas076@gmail.com",
        "full_name": "Yashas (Manager)",
        "role": ROLE_MANAGER,
        "requested_role": ROLE_MANAGER,
        "approval_status": "approved",
        "is_pending_approval": False,
        "organization": "Central Municipality",
        "district": "HQ",
        "ward": "Ward 1",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "token-manager",
        "is_manager": True,
        "is_staff": False,
        "is_citizen": False,
        "is_admin": True,
    }

    assert require_manager(active_manager) == active_manager
    print("  [PASS] Authorized Manager (t.r.yashas076@gmail.com) granted Manager Dashboard access")

    # 5. After Approval: Staff access granted
    approved_staff = {
        **pending_staff,
        "role": ROLE_STAFF,
        "approval_status": "approved",
        "is_pending_approval": False,
        "is_staff": True,
    }
    assert require_staff(approved_staff) == approved_staff
    print("  [PASS] Approved Staff granted Staff Dashboard access")

    print("\n=======================================================")
    print("ALL REGISTRATION & APPROVAL LIFECYCLE TESTS PASSED!")
    print("=======================================================\n")

if __name__ == "__main__":
    test_registration_and_approval_workflow()
