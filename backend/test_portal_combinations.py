import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_portal_logins():
    print("=" * 60)
    print("TESTING 3-ROLE LOGIN AND PORTAL COMBINATIONS")
    print("=" * 60)

    # 1. Valid logins
    print("\n--- 1. Valid Portal Logins (Questions 2 & 4) ---")
    valid_cases = [
        ("citizen@awm.gov", "citizen", "citizen"),
        ("staff@awm.gov", "municipal_staff", "municipal_staff"),
        ("manager@awm.gov", "manager", "manager"),
    ]
    for email, portal, expected_role in valid_cases:
        res = client.post("/api/v1/auth/login", json={
            "identifier": email,
            "password": "Password123!",
            "portal": portal,
        })
        print(f"Login {email} + portal '{portal}': status={res.status_code}")
        if res.status_code != 200:
            print(f"FAILED: {res.text}")
            sys.exit(1)
        data = res.json()
        returned_role = data.get("user", {}).get("role")
        print(f"  -> Returned role: {returned_role}")
        assert returned_role == expected_role, f"Expected {expected_role}, got {returned_role}"
        print(f"  [PASS] {email} verified on {portal} portal.")

    # 2. Invalid combinations
    print("\n--- 2. Invalid Portal Logins (Question 3) ---")
    invalid_cases = [
        ("citizen@awm.gov", "manager", "Citizen using manager portal"),
        ("staff@awm.gov", "manager", "Staff using manager portal"),
        ("citizen@awm.gov", "municipal_staff", "Citizen using municipal_staff portal"),
        ("manager@awm.gov", "citizen", "Manager using citizen portal"),
        ("manager@awm.gov", "municipal_staff", "Manager using municipal_staff portal"),
    ]
    for email, portal, desc in invalid_cases:
        res = client.post("/api/v1/auth/login", json={
            "identifier": email,
            "password": "Password123!",
            "portal": portal,
        })
        print(f"Attempt: {desc} ({email} + '{portal}')")
        print(f"  -> Status code: {res.status_code}")
        print(f"  -> Detail: {res.json().get('detail')}")
        assert res.status_code == 403, f"Expected 403 for {desc}, got {res.status_code}: {res.text}"
        print(f"  [PASS] Correctly rejected with HTTP 403.")

    print("\n" + "=" * 60)
    print("ALL LOGIN COMBINATIONS & REJECTIONS VERIFIED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    test_portal_logins()
