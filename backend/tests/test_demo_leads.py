"""Tests for Demo Leads admin feature (GET/PATCH /api/admin/leads, POST /api/contact)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@assetnova.com", "Admin@123")


@pytest.fixture(scope="module")
def nonadmin_token():
    return _login("assetmgr@assetnova.com", "Asset@123")


def test_public_contact_creates_lead_with_status_new():
    unique = f"TEST_{uuid.uuid4().hex[:8]}"
    payload = {"name": unique, "email": f"{unique}@test.com".lower(), "message": "hello from test"}
    r = requests.post(f"{API}/contact", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True
    pytest.lead_email = payload["email"]
    pytest.lead_name = unique


def test_admin_list_leads(admin_token):
    r = requests.get(f"{API}/admin/leads", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "leads" in data and isinstance(data["leads"], list)
    # Should include the one we just made
    emails = [l.get("email") for l in data["leads"]]
    assert pytest.lead_email in emails
    lead = next(l for l in data["leads"] if l["email"] == pytest.lead_email)
    assert lead.get("status") == "new"
    assert "_id" not in lead
    pytest.lead_id = lead["id"]


def test_admin_list_leads_status_filter(admin_token):
    r = requests.get(f"{API}/admin/leads?status=new", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    assert r.status_code == 200
    for l in r.json()["leads"]:
        assert l["status"] == "new"


def test_patch_lead_status_contacted(admin_token):
    r = requests.patch(
        f"{API}/admin/leads/{pytest.lead_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "contacted"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "contacted"
    # verify via GET
    r2 = requests.get(f"{API}/admin/leads?status=contacted", headers={"Authorization": f"Bearer {admin_token}"}, timeout=30)
    ids = [l["id"] for l in r2.json()["leads"]]
    assert pytest.lead_id in ids


def test_patch_lead_status_closed(admin_token):
    r = requests.patch(
        f"{API}/admin/leads/{pytest.lead_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "closed"},
        timeout=30,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "closed"


def test_patch_invalid_status_rejected(admin_token):
    r = requests.patch(
        f"{API}/admin/leads/{pytest.lead_id}",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "bogus"},
        timeout=30,
    )
    assert r.status_code in (400, 422)


def test_patch_unknown_lead_404(admin_token):
    r = requests.patch(
        f"{API}/admin/leads/does-not-exist",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"status": "new"},
        timeout=30,
    )
    assert r.status_code == 404


def test_nonadmin_forbidden_list(nonadmin_token):
    r = requests.get(f"{API}/admin/leads", headers={"Authorization": f"Bearer {nonadmin_token}"}, timeout=30)
    assert r.status_code == 403


def test_nonadmin_forbidden_patch(nonadmin_token):
    r = requests.patch(
        f"{API}/admin/leads/{pytest.lead_id}",
        headers={"Authorization": f"Bearer {nonadmin_token}"},
        json={"status": "new"},
        timeout=30,
    )
    assert r.status_code == 403


def test_unauthenticated_forbidden():
    r = requests.get(f"{API}/admin/leads", timeout=30)
    assert r.status_code in (401, 403)
