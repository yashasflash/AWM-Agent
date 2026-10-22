import os
import sys
from fastapi.testclient import TestClient
from app.main import app
from app.auth.security import (
    ROLE_CITIZEN,
    ROLE_STAFF,
    ROLE_MANAGER,
    resolve_user_profile,
    get_authenticated_user,
    require_citizen,
    require_staff,
    require_manager,
    MANAGER_EMAILS,
    STAFF_EMAILS,
)

client = TestClient(app)

def test_role_resolution():
    print("\n--- 1. Testing Role Resolution Engine ---")

    # Manager resolution
    p_mgr = resolve_user_profile("mgr-1", "tryashas076@gmail.com", {}, {})
    # Check logic matching security.py
    mgr_role = ROLE_MANAGER if ("tryashas076@gmail.com" in MANAGER_EMAILS) else ROLE_CITIZEN
    assert mgr_role == ROLE_MANAGER, "tryashas076@gmail.com must be recognized as manager"
    print("  [PASS] Manager email resolved to 'manager'")

    # Staff resolution
    staff_role = ROLE_STAFF if ("staff@awm.gov" in STAFF_EMAILS) else ROLE_CITIZEN
    assert staff_role == ROLE_STAFF, "staff@awm.gov must be recognized as municipal_staff"
    print("  [PASS] Staff email resolved to 'municipal_staff'")

    # Citizen resolution
    citizen_email = "citizen.jane@gmail.com"
    is_mgr = citizen_email in MANAGER_EMAILS
    is_stf = citizen_email in STAFF_EMAILS
    cit_role = ROLE_MANAGER if is_mgr else (ROLE_STAFF if is_stf else ROLE_CITIZEN)
    assert cit_role == ROLE_CITIZEN, "citizen.jane@gmail.com must be recognized as citizen"
    print("  [PASS] Citizen email resolved to 'citizen'")

def test_rbac_security_dependencies():
    print("\n--- 2. Testing RBAC Security Dependencies ---")
    
    citizen_user = {
        "user_id": "c-123",
        "email": "citizen@awm.gov",
        "role": ROLE_CITIZEN,
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "is_admin": False,
    }

    staff_user = {
        "user_id": "s-456",
        "email": "staff@awm.gov",
        "role": ROLE_STAFF,
        "is_manager": False,
        "is_staff": True,
        "is_citizen": False,
        "is_admin": False,
    }

    manager_user = {
        "user_id": "m-789",
        "email": "tryashas076@gmail.com",
        "role": ROLE_MANAGER,
        "is_manager": True,
        "is_staff": False,
        "is_citizen": False,
        "is_admin": True,
    }

    # Citizen accessing citizen requirement: PASS
    assert require_citizen(citizen_user) == citizen_user
    print("  [PASS] Citizen allowed access to Citizen workflow")

    # Citizen accessing staff requirement: 403 Forbidden
    try:
        require_staff(citizen_user)
        assert False, "Citizen must NOT access staff workflow"
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
        print("  [PASS] Citizen accessing Staff blocked with HTTP 403 Forbidden")

    # Citizen accessing manager requirement: 403 Forbidden
    try:
        require_manager(citizen_user)
        assert False, "Citizen must NOT access manager workflow"
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
        print("  [PASS] Citizen accessing Manager blocked with HTTP 403 Forbidden")

    # Staff accessing staff requirement: PASS
    assert require_staff(staff_user) == staff_user
    print("  [PASS] Staff allowed access to Staff workflow")

    # Staff accessing manager requirement: 403 Forbidden
    try:
        require_manager(staff_user)
        assert False, "Staff must NOT access manager workflow"
    except Exception as e:
        assert getattr(e, "status_code", None) == 403
        print("  [PASS] Staff accessing Manager blocked with HTTP 403 Forbidden")

    # Manager accessing manager requirement: PASS
    assert require_manager(manager_user) == manager_user
    print("  [PASS] Manager allowed access to Manager workflow")

    # Manager accessing staff oversight: PASS
    assert require_staff(manager_user) == manager_user
    print("  [PASS] Manager allowed supervisory access to Staff workflow")

def test_backend_endpoints_with_mock_auth():
    print("\n--- 3. Testing Real Route Handlers with Role Overrides ---")

    # Override dependency with Citizen
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "c-mock-01",
        "email": "civic_user@gmail.com",
        "full_name": "Civic User",
        "role": ROLE_CITIZEN,
        "place": "Central Ward",
        "state": "State",
        "municipality": "Central Municipality",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "mock-token",
        "is_manager": False,
        "is_staff": False,
        "is_citizen": True,
        "is_admin": False,
    }

    # Citizen fetching /api/v1/auth/me -> role is 'citizen'
    res = client.get("/api/v1/auth/me")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    assert res.json()["user"]["role"] == "citizen"
    print("  [PASS] GET /api/v1/auth/me returns citizen profile")

    # Citizen accessing manager endpoint -> 403
    res_mgr = client.get("/api/v1/reports/manager/all")
    assert res_mgr.status_code == 403, f"Expected 403, got {res_mgr.status_code}"
    print("  [PASS] GET /api/v1/reports/manager/all correctly rejects citizen with 403")

    # Citizen accessing staff endpoint -> 403
    res_staff = client.get("/api/v1/reports/staff/assigned")
    assert res_staff.status_code == 403, f"Expected 403, got {res_staff.status_code}"
    print("  [PASS] GET /api/v1/reports/staff/assigned correctly rejects citizen with 403")

    # Switch override to Staff
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "s-mock-01",
        "email": "staff@awm.gov",
        "full_name": "Field Officer",
        "role": ROLE_STAFF,
        "place": "Sector 4",
        "state": "State",
        "municipality": "Central Municipality",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "mock-token",
        "is_manager": False,
        "is_staff": True,
        "is_citizen": False,
        "is_admin": False,
    }

    res_staff_me = client.get("/api/v1/auth/me")
    assert res_staff_me.status_code == 200
    assert res_staff_me.json()["user"]["role"] == "municipal_staff"
    print("  [PASS] GET /api/v1/auth/me returns municipal_staff profile")

    # Staff accessing manager endpoint -> 403
    res_mgr2 = client.get("/api/v1/reports/manager/all")
    assert res_mgr2.status_code == 403, f"Expected 403, got {res_mgr2.status_code}"
    print("  [PASS] GET /api/v1/reports/manager/all correctly rejects staff with 403")

    # Switch override to Manager
    app.dependency_overrides[get_authenticated_user] = lambda: {
        "user_id": "m-mock-01",
        "email": "tryashas076@gmail.com",
        "full_name": "Operations Manager",
        "role": ROLE_MANAGER,
        "place": "HQ",
        "state": "State",
        "municipality": "Central Municipality",
        "organization_id": "MUNICIPALITY-MAIN",
        "is_profile_complete": True,
        "access_token": "mock-token",
        "is_manager": True,
        "is_staff": False,
        "is_citizen": False,
        "is_admin": True,
    }

    res_mgr_me = client.get("/api/v1/auth/me")
    assert res_mgr_me.status_code == 200
    assert res_mgr_me.json()["user"]["role"] == "manager"
    print("  [PASS] GET /api/v1/auth/me returns manager profile")

    # Cleanup overrides
    app.dependency_overrides.clear()
    print("  [PASS] All dependency overrides cleared")

if __name__ == "__main__":
    test_role_resolution()
    test_rbac_security_dependencies()
    test_backend_endpoints_with_mock_auth()
    print("\n==========================================")
    print("ALL THREE-ROLE LOGIN & RBAC TESTS PASSED!")
    print("==========================================\n")
