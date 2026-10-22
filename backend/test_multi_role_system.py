"""
==============================================================================
Test Suite: test_multi_role_system.py
Project: Autonomous Waste Management (AWM) Agent
Description: Validates all 10 core requirements:
  1. Citizen account registration
  2. Citizen login (email + password)
  3. Staff registration request
  4. Staff pending blocking
  5. Staff approval & Registered Staff ID generation
  6. Login using Registered Staff ID & password
  7. Manager registration request
  8. Manager pending blocking
  9. Manager approval & Registered Manager ID generation
  10. Login using Registered Manager ID & password
  11. Unauthorized role access enforcement
==============================================================================
"""

import time
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def run_tests():
    ts = int(time.time())
    print("\n=======================================================")
    print("      AWM MULTI-ROLE AUTH & REGISTRATION TEST SUITE    ")
    print("=======================================================\n")

    # -------------------------------------------------------------------------
    # TEST 1: CITIZEN REGISTRATION
    # -------------------------------------------------------------------------
    print("1. Testing Citizen Registration...")
    cit_email = f"citizen_test_{ts}@awmtest.gov"
    cit_pwd = "Password123!"

    res = client.post("/api/v1/auth/register-citizen", json={
        "full_name": "Citizen Test User",
        "place_ward": "Ward 4B",
        "email": cit_email,
        "password": cit_pwd,
        "confirm_password": cit_pwd,
    })
    assert res.status_code == 200, f"Citizen reg failed: {res.text}"
    cit_data = res.json()
    assert cit_data["success"] is True
    assert "Your Citizen account has been created successfully." in cit_data["message"]
    print("  [PASS] Citizen registered and auto-approved.")

    # -------------------------------------------------------------------------
    # TEST 2: CITIZEN LOGIN (Email + Password)
    # -------------------------------------------------------------------------
    print("\n2. Testing Citizen Login (Email & Password)...")
    login_res = client.post("/api/v1/auth/login", json={
        "identifier": cit_email,
        "password": cit_pwd,
        "portal": "citizen",
    })
    assert login_res.status_code == 200, f"Citizen login failed: {login_res.text}"
    cit_token = login_res.json()["access_token"]
    assert cit_token is not None
    print("  [PASS] Citizen logged in successfully.")

    # -------------------------------------------------------------------------
    # TEST 3: CITIZEN ACCESSING RESTRICTED ENDPOINTS (STAFF / MANAGER)
    # -------------------------------------------------------------------------
    print("\n3. Testing Citizen Unauthorized Role Access...")
    headers_cit = {"Authorization": f"Bearer {cit_token}"}
    
    # Citizen trying staff login portal
    staff_portal_attempt = client.post("/api/v1/auth/login", json={
        "identifier": cit_email,
        "password": cit_pwd,
        "portal": "municipal_staff",
    })
    assert staff_portal_attempt.status_code == 403
    assert "not registered as Municipal Staff" in staff_portal_attempt.json()["detail"]
    print("  [PASS] Citizen blocked from Municipal Staff portal (HTTP 403).")

    # Citizen trying manager login portal
    mgr_portal_attempt = client.post("/api/v1/auth/login", json={
        "identifier": cit_email,
        "password": cit_pwd,
        "portal": "manager",
    })
    assert mgr_portal_attempt.status_code == 403
    assert "not registered as a Manager" in mgr_portal_attempt.json()["detail"]
    print("  [PASS] Citizen blocked from Manager portal (HTTP 403).")

    # Citizen trying manager pending-approvals API
    pending_api_attempt = client.get("/api/v1/auth/pending-approvals", headers=headers_cit)
    assert pending_api_attempt.status_code == 403
    print("  [PASS] Citizen blocked from backend Manager API (HTTP 403).")

    # -------------------------------------------------------------------------
    # TEST 4: MUNICIPAL STAFF REGISTRATION REQUEST
    # -------------------------------------------------------------------------
    print("\n4. Testing Municipal Staff Registration Request...")
    staff_email = f"staff_test_{ts}@awmtest.gov"
    staff_pwd = "Password123!"

    s_reg = client.post("/api/v1/auth/register-staff", json={
        "full_name": "Sanitation Officer Dave",
        "place_municipality": "North District Division",
        "email": staff_email,
        "password": staff_pwd,
        "confirm_password": staff_pwd,
        "organization": "Metropolitan Waste Board",
        "district": "North District",
        "designation": "Route Lead",
    })
    assert s_reg.status_code == 200, f"Staff reg failed: {s_reg.text}"
    s_data = s_reg.json()
    assert "awaiting Manager approval" in s_data["message"]
    staff_user_id = s_data["user"]["id"]
    print("  [PASS] Staff registration submitted with status 'pending'.")

    # -------------------------------------------------------------------------
    # TEST 5: PENDING STAFF BLOCKED FROM STAFF PORTAL
    # -------------------------------------------------------------------------
    print("\n5. Verifying Pending Staff Blocked Before Approval...")
    s_login_attempt = client.post("/api/v1/auth/login", json={
        "identifier": staff_email,
        "password": staff_pwd,
        "portal": "municipal_staff",
    })
    assert s_login_attempt.status_code == 403
    assert "awaiting Manager approval" in s_login_attempt.json()["detail"]
    print("  [PASS] Pending Staff cannot access Staff portal until approved.")

    # -------------------------------------------------------------------------
    # TEST 6: MANAGER APPROVAL & STAFF ID GENERATION
    # -------------------------------------------------------------------------
    print("\n6. Testing Manager Approval & Staff ID Generation...")
    # Manager logs in first
    mgr_login = client.post("/api/v1/auth/login", json={
        "identifier": "tryashas076@gmail.com",
        "password": "Password123!",
        "portal": "manager",
    })
    assert mgr_login.status_code == 200, f"Manager login failed: {mgr_login.text}"
    mgr_token = mgr_login.json()["access_token"]
    mgr_headers = {"Authorization": f"Bearer {mgr_token}"}

    # Manager approves Staff request
    appr_res = client.post("/api/v1/auth/review-approval", json={
        "user_id": staff_user_id,
        "action": "approve",
    }, headers=mgr_headers)
    assert appr_res.status_code == 200, f"Approval failed: {appr_res.text}"
    appr_data = appr_res.json()
    assert appr_data["role"] == "municipal_staff"
    assigned_staff_id = appr_data.get("assigned_id")
    assert assigned_staff_id is not None
    assert assigned_staff_id.startswith("STF-")
    print(f"  [PASS] Staff approved successfully. Assigned Staff ID: {assigned_staff_id}")

    # -------------------------------------------------------------------------
    # TEST 7: LOGIN USING REGISTERED STAFF ID & PASSWORD
    # -------------------------------------------------------------------------
    print("\n7. Testing Login Using Registered Staff ID & Password...")
    id_login_res = client.post("/api/v1/auth/login", json={
        "identifier": assigned_staff_id,
        "password": staff_pwd,
        "portal": "municipal_staff",
    })
    assert id_login_res.status_code == 200, f"Staff ID login failed: {id_login_res.text}"
    staff_user = id_login_res.json()["user"]
    assert staff_user["role"] == "municipal_staff"
    assert staff_user["staff_id"] == assigned_staff_id
    print(f"  [PASS] Logged in successfully using real Registered Staff ID '{assigned_staff_id}'.")

    # -------------------------------------------------------------------------
    # TEST 8: MANAGER REGISTRATION & APPROVAL LIFECYCLE
    # -------------------------------------------------------------------------
    print("\n8. Testing Manager Registration & ID Lifecycle...")
    new_mgr_email = f"mgr_test_{ts}@awmtest.gov"
    new_mgr_pwd = "Password123!"

    m_reg = client.post("/api/v1/auth/register-manager", json={
        "full_name": "Assistant Director Sarah",
        "place_municipality": "Central Command",
        "email": new_mgr_email,
        "password": new_mgr_pwd,
        "confirm_password": new_mgr_pwd,
        "organization": "Municipal Sanitation HQ",
        "district": "Central District",
        "designation": "Assistant Director",
    })
    assert m_reg.status_code == 200
    assert "submitted for authorization" in m_reg.json()["message"]
    new_mgr_user_id = m_reg.json()["user"]["id"]
    print("  [PASS] Manager registration submitted as pending.")

    # Pending manager blocked
    m_block_res = client.post("/api/v1/auth/login", json={
        "identifier": new_mgr_email,
        "password": new_mgr_pwd,
        "portal": "manager",
    })
    assert m_block_res.status_code == 403
    assert "submitted for authorization" in m_block_res.json()["detail"]
    print("  [PASS] Pending Manager blocked prior to authorization.")

    # Authorized manager reviews and approves
    mgr_appr = client.post("/api/v1/auth/review-approval", json={
        "user_id": new_mgr_user_id,
        "action": "approve",
    }, headers=mgr_headers)
    assert mgr_appr.status_code == 200
    assigned_mgr_id = mgr_appr.json().get("assigned_id")
    assert assigned_mgr_id is not None
    assert assigned_mgr_id.startswith("MGR-")
    print(f"  [PASS] Manager request approved. Assigned Manager ID: {assigned_mgr_id}")

    # -------------------------------------------------------------------------
    # TEST 9: LOGIN USING REGISTERED MANAGER ID & PASSWORD
    # -------------------------------------------------------------------------
    print("\n9. Testing Login Using Registered Manager ID & Password...")
    mgr_id_login = client.post("/api/v1/auth/login", json={
        "identifier": assigned_mgr_id,
        "password": new_mgr_pwd,
        "portal": "manager",
    })
    assert mgr_id_login.status_code == 200, f"Manager ID login failed: {mgr_id_login.text}"
    mgr_u = mgr_id_login.json()["user"]
    assert mgr_u["role"] == "manager"
    assert mgr_u["manager_id"] == assigned_mgr_id
    print(f"  [PASS] Logged in successfully using real Registered Manager ID '{assigned_mgr_id}'.")

    print("\n=======================================================")
    print("   ALL MULTI-ROLE SYSTEM & ID TESTS PASSED (10/10)!   ")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
