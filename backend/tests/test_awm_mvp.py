"""
AWM MVP Complete Automated Test Suite
Validates backend APIs, authentication, Supabase persistence, RBAC,
AI classification display, and admin triage capabilities.
"""

import httpx
import pytest

BASE_URL = "http://localhost:8000"
DEMO_EMAIL = "tryashas076@gmail.com"
DEMO_PASSWORD = "123456"


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as c:
        yield c


@pytest.fixture(scope="session")
def auth_token(client):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert data["success"] is True
    assert "access_token" in data
    return data["access_token"]


def test_health_check(client):
    """Verify backend and Supabase database health."""
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    db_resp = client.get("/health/database")
    assert db_resp.status_code == 200
    assert db_resp.json()["status"] == "connected"


def test_auth_login_invalid_credentials(client):
    """Verify bad credentials return HTTP 401."""
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": DEMO_EMAIL, "password": "wrong_password_999"},
    )
    assert resp.status_code == 401


def test_auth_me_profile(client, auth_token):
    """Verify session validation and role determination."""
    resp = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    user = data["user"]
    assert user["email"] == DEMO_EMAIL
    assert user["role"] in ("manager", "admin")


def test_citizen_reports_retrieval(client, auth_token):
    """Verify retrieving citizen reports with stats and pagination."""
    resp = client.get(
        "/api/v1/reports/?limit=10",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert "reports" in data
    assert len(data["reports"]) <= 10
    assert "stats" in data
    assert data["stats"]["total"] >= 100


def test_report_125_ai_classification(client, auth_token):
    """Verify exact AI classification fields for Report #125."""
    resp = client.get(
        "/api/v1/reports/125",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    report = data["report"]

    assert report["report_number"] == 125
    assert report["waste_category"] == "Other"
    assert report["ai_category"] == "Electronic Waste"
    assert report["ai_priority"] == "High"
    assert (
        report["ai_summary"]
        == "Recommend safe collection by an authorized e-waste handler."
    )


def test_admin_reports_rbac(client):
    """Verify unauthenticated user cannot access admin console."""
    resp = client.get("/api/v1/reports/admin/all")
    assert resp.status_code in (401, 403)


def test_admin_reports_all(client, auth_token):
    """Verify admin report overview with 6-stat KPI metrics."""
    resp = client.get(
        "/api/v1/reports/admin/all?limit=5",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    stats = data["stats"]
    assert "total" in stats
    assert "pending" in stats
    assert "under_review" in stats
    assert "in_progress" in stats
    assert "resolved" in stats
    assert "high_priority" in stats
    assert stats["high_priority"] >= 5


def test_admin_update_status_and_revert(client, auth_token):
    """Verify updating report status and assigning department."""
    # Update Report #125 to Under Review with Hazmat department
    patch_resp = client.patch(
        "/api/v1/reports/125/status",
        json={
            "status": "Under Review",
            "department": "Hazardous Materials Unit",
            "admin_note": "Inspection dispatched for electronic waste components",
        },
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert patch_resp.status_code == 200
    patch_data = patch_resp.json()
    assert patch_data["success"] is True
    assert patch_data["report"]["status"] == "Under Review"
    assert patch_data["task"] is not None
    assert patch_data["task"]["department"] == "Hazardous Materials Unit"

    # Verify via GET /reports/125
    get_resp = client.get(
        "/api/v1/reports/125",
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["report"]["status"] == "Under Review"

    # Revert back to Submitted to preserve database integrity
    revert_resp = client.patch(
        "/api/v1/reports/125/status",
        json={"status": "Submitted"},
        headers={"Authorization": f"Bearer {auth_token}"},
    )
    assert revert_resp.status_code == 200
    assert revert_resp.json()["report"]["status"] == "Submitted"
