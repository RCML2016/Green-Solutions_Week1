"""Iteration 15 — nav reorganization support checks.

Backend was not changed in this iteration; these tests verify the endpoints the
3 new frontend pages depend on (/fleet/sites, /fleet/sites/{id}, /fleet/work-orders,
/reports/weekly-digest, /contact) plus multi-role setup used by the workspace switcher.
"""
import os
import re
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")


def _creds(role_email):
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    m = re.search(rf"`{re.escape(role_email)}`\s*\|\s*`([^`]+)`", content)
    if not m:
        pytest.skip(f"credentials for {role_email} not found")
    return role_email, m.group(1)


def _token(email):
    e, p = _creds(email)
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": e, "password": p}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login failed for {e}: {r.status_code} {r.text[:300]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def am_headers():
    return {"Authorization": f"Bearer {_token('assetmgr@assetnova.com')}"}


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_token('admin@assetnova.com')}"}


# ---------------- Contact (Book a Demo modal) ----------------
class TestContactBookDemo:
    def test_contact_accepts_book_demo_payload(self):
        payload = {
            "name": "TEST_QA Demo",
            "email": "qa_bookdemo_i15@example.com",
            "message": "[BOOK-A-DEMO] Role: Investor - Company: TEST_Co - Slot: Next week\n\nnotes",
        }
        r = requests.post(f"{BASE_URL}/api/contact", json=payload, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert isinstance(body.get("message"), str) and body["message"]

    def test_contact_rejects_invalid_email(self):
        r = requests.post(
            f"{BASE_URL}/api/contact",
            json={"name": "TEST_QA", "email": "not-an-email", "message": "x"},
            timeout=30,
        )
        assert r.status_code == 422


# ---------------- Assets page data source ----------------
class TestAssetsPageData:
    def test_sites_list_and_asset_payload(self, am_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/sites", params={"limit": 50}, headers=am_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] >= 380
        assert len(data["items"]) == 50
        site_id = data["items"][0]["site_id"]

        d = requests.get(f"{BASE_URL}/api/fleet/sites/{site_id}", headers=am_headers, timeout=60)
        assert d.status_code == 200, d.text
        detail = d.json()
        assert detail["site"]["site_id"] == site_id
        assert isinstance(detail["assets"], list) and len(detail["assets"]) > 0
        a = detail["assets"][0]
        for key in ("asset_id", "asset_type", "make", "model", "status", "site_id"):
            assert key in a, f"missing {key} in asset payload"
        assert "_id" not in a

    def test_sites_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/fleet/sites", params={"limit": 5}, timeout=30)
        assert r.status_code in (401, 403)


# ---------------- Work Orders page data source ----------------
class TestWorkOrdersPageData:
    def test_work_orders_total_and_breakdown(self, am_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/work-orders", params={"limit": 200}, headers=am_headers, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["total"] == 141
        assert len(data["items"]) == 141
        bd = {x["status"]: x["count"] for x in data["status_breakdown"]}
        # UI only renders Created/Dispatched/Resolved tiles — assert what backend returns
        assert sum(bd.values()) == 141, f"breakdown {bd} does not sum to total"
        assert set(bd) >= {"Created", "Dispatched", "Resolved"}
        # documents the extra status the UI tiles omit
        assert "Assigned" in bd

    def test_work_orders_status_filter(self, am_headers):
        r = requests.get(
            f"{BASE_URL}/api/fleet/work-orders",
            params={"limit": 200, "status": "Dispatched"},
            headers=am_headers,
            timeout=60,
        )
        assert r.status_code == 200
        data = r.json()
        assert all(w["status"] == "Dispatched" for w in data["items"])
        assert data["total"] == len(data["items"])


# ---------------- AI Intelligence page data source ----------------
class TestAiIntelligenceData:
    def test_weekly_digest(self, am_headers):
        r = requests.post(f"{BASE_URL}/api/reports/weekly-digest", json={}, headers=am_headers, timeout=180)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data["digest"], str) and len(data["digest"]) > 50
        assert isinstance(data["alerts_count"], int)
        assert isinstance(data["actions_count"], int)
        assert "generated_at" in data

    def test_high_severity_alarms_for_findings(self, am_headers):
        r = requests.get(
            f"{BASE_URL}/api/fleet/alarms",
            params={"severity": "High", "limit": 6},
            headers=am_headers,
            timeout=60,
        )
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) > 0
        assert all(i["severity"] == "High" for i in items)
        assert "root_cause_category" in items[0]


# ---------------- Multi-role / workspace switcher ----------------
class TestWorkspaceSwitcher:
    def test_assign_two_roles_and_switch(self, admin_headers):
        users = requests.get(f"{BASE_URL}/api/team/users", headers=admin_headers, timeout=30)
        assert users.status_code == 200
        target = next(u for u in users.json() if u["email"] == "assetmgr@assetnova.com")
        uid = target["id"]
        original = target.get("roles") or [target["role"]]
        try:
            r = requests.patch(
                f"{BASE_URL}/api/team/users/{uid}/roles",
                json={"roles": ["asset_manager", "om_manager"]},
                headers=admin_headers,
                timeout=30,
            )
            assert r.status_code == 200, r.text

            tok = _token("assetmgr@assetnova.com")
            h = {"Authorization": f"Bearer {tok}"}
            mine = requests.get(f"{BASE_URL}/api/rbac/my-roles", headers=h, timeout=30)
            assert mine.status_code == 200
            assert set(mine.json()["roles"]) == {"asset_manager", "om_manager"}

            sw = requests.post(f"{BASE_URL}/api/rbac/switch", json={"role": "om_manager"}, headers=h, timeout=30)
            assert sw.status_code == 200, sw.text
            new_tok = sw.json()["access_token"]
            me = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {new_tok}"}, timeout=30)
            assert me.status_code == 200
            assert me.json()["role"] == "om_manager"
        finally:
            requests.patch(
                f"{BASE_URL}/api/team/users/{uid}/roles",
                json={"roles": original},
                headers=admin_headers,
                timeout=30,
            )
