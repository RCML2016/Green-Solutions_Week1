"""Iteration 13 — Performance Engineer + Client Viewer roles, workspace switcher,
multi-role assignment, client scope, evidence upload (Emergent Object Storage)."""
import base64
import io
import uuid

import pytest
import requests

from conftest import API

# 1x1 transparent PNG
PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


# ---------------- New demo accounts ----------------
class TestNewDemoAccounts:
    @pytest.mark.parametrize("email,pwd,role", [
        ("perf@greensolutions.ai", "Perf@123", "performance_engineer"),
        ("client@greensolutions.ai", "Client@123", "client_viewer"),
    ])
    def test_demo_login_and_role(self, email, pwd, role):
        r = _login(email, pwd)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == role
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 10
        # /auth/me reflects same role
        me = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {d['access_token']}"}, timeout=30)
        assert me.status_code == 200
        assert me.json()["role"] == role


# ---------------- Register role validation ----------------
class TestRegisterRoles:
    @pytest.mark.parametrize("role", [
        "executive", "asset_manager", "om_manager", "technician",
        "performance_engineer", "client_viewer",
    ])
    def test_register_with_role(self, role):
        email = f"test_qa_i13_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "UserPass@123", "name": "TEST_QA i13", "role": role,
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == role

    def test_register_invalid_role_422(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"test_qa_i13_{uuid.uuid4().hex[:8]}@example.com",
            "password": "UserPass@123", "name": "x", "role": "invalid",
        }, timeout=30)
        assert r.status_code == 422, r.text

    def test_register_missing_role_defaults_executive(self):
        r = requests.post(f"{API}/auth/register", json={
            "email": f"test_qa_i13_{uuid.uuid4().hex[:8]}@example.com",
            "password": "UserPass@123", "name": "x",
        }, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "executive"


# ---------------- /api/rbac/my-roles + /api/rbac/switch ----------------
class TestWorkspaceSwitch:
    def test_my_roles_shape(self, normal_user):
        r = requests.get(f"{API}/rbac/my-roles", headers=normal_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["active_role"] == "executive"
        assert isinstance(d["roles"], list) and "executive" in d["roles"]

    def test_my_roles_requires_auth(self):
        r = requests.get(f"{API}/rbac/my-roles", timeout=30)
        assert r.status_code in (401, 403)

    def test_switch_to_unheld_role_403(self, normal_user):
        r = requests.post(f"{API}/rbac/switch", json={"role": "technician"},
                          headers=normal_user["headers"], timeout=30)
        assert r.status_code == 403, r.text

    def test_admin_switch_is_reversible(self, admin_headers):
        """BUG REPRO (do NOT run against the real admin account — it demotes it
        permanently). Uses a throwaway admin-role user instead."""
        email = f"test_qa_i13_adm_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "UserPass@123", "name": "TEST_QA Adm",
            "role": "executive"}, timeout=30)
        uid = reg.json()["user"]["id"]
        pr = requests.patch(f"{API}/team/users/{uid}/roles", json={"roles": ["admin"]},
                            headers=admin_headers, timeout=30)
        assert pr.status_code == 200, pr.text
        li = _login(email, "UserPass@123")
        hdrs = {"Authorization": f"Bearer {li.json()['access_token']}"}
        assert li.json()["user"]["role"] == "admin"

        sw = requests.post(f"{API}/rbac/switch", json={"role": "om_manager"},
                           headers=hdrs, timeout=30)
        assert sw.status_code == 200, sw.text
        assert sw.json()["active_role"] == "om_manager"
        new_hdrs = {"Authorization": f"Bearer {sw.json()['access_token']}"}
        back = requests.post(f"{API}/rbac/switch", json={"role": "admin"},
                             headers=new_hdrs, timeout=30)
        requests.delete(f"{API}/team/users/{uid}", headers=admin_headers, timeout=30)
        assert back.status_code == 200, (
            "ADMIN LOCKOUT: switching away from admin removes admin from effective "
            f"roles, so switching back is rejected ({back.status_code}: {back.text[:120]})")

    def test_seeded_admin_has_roles_array(self):
        """Root cause of the admin-lockout bug: the seeded admin doc has no
        `roles` array, so once it switches workspace, `admin` is lost forever."""
        from pymongo import MongoClient
        from dotenv import dotenv_values
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        u = cl[be["DB_NAME"]].users.find_one({"email": "admin@greensolutions.ai"})
        cl.close()
        assert u is not None
        assert "admin" in (u.get("roles") or []), (
            "seeded admin has no roles=['admin'] — /rbac/switch away from admin "
            "permanently demotes the super-admin account")

    def test_multirole_switch_flow(self, admin_headers):
        email = f"test_qa_i13_multi_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "UserPass@123", "name": "TEST_QA Multi",
            "role": "technician"}, timeout=30)
        assert reg.status_code == 200, reg.text
        uid = reg.json()["user"]["id"]
        hdrs = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        # admin grants 2 roles
        pr = requests.patch(f"{API}/team/users/{uid}/roles",
                            json={"roles": ["technician", "performance_engineer"]},
                            headers=admin_headers, timeout=30)
        assert pr.status_code == 200, pr.text
        assert pr.json()["active_role"] == "technician"
        assert pr.json()["roles"] == ["technician", "performance_engineer"]

        mr = requests.get(f"{API}/rbac/my-roles", headers=hdrs, timeout=30)
        assert mr.status_code == 200
        assert set(mr.json()["roles"]) == {"technician", "performance_engineer"}

        sw = requests.post(f"{API}/rbac/switch", json={"role": "performance_engineer"},
                           headers=hdrs, timeout=30)
        assert sw.status_code == 200, sw.text
        assert sw.json()["active_role"] == "performance_engineer"
        new_hdrs = {"Authorization": f"Bearer {sw.json()['access_token']}"}
        me = requests.get(f"{API}/auth/me", headers=new_hdrs, timeout=30)
        assert me.json()["role"] == "performance_engineer"

        # cleanup
        requests.delete(f"{API}/team/users/{uid}", headers=admin_headers, timeout=30)


# ---------------- PATCH /api/team/users/{id}/roles guards ----------------
class TestMultiRoleAdminGuards:
    def test_invalid_role_in_list_422(self, admin_headers, normal_user):
        r = requests.patch(f"{API}/team/users/{normal_user['id']}/roles",
                           json={"roles": ["executive", "wizard"]},
                           headers=admin_headers, timeout=30)
        assert r.status_code == 422, r.text

    def test_non_admin_403(self, normal_user):
        r = requests.patch(f"{API}/team/users/{normal_user['id']}/roles",
                           json={"roles": ["executive"]},
                           headers=normal_user["headers"], timeout=30)
        assert r.status_code == 403, r.text

    def test_unknown_user_404(self, admin_headers):
        r = requests.patch(f"{API}/team/users/does-not-exist-xyz/roles",
                           json={"roles": ["executive"]},
                           headers=admin_headers, timeout=30)
        assert r.status_code == 404, r.text


# ---------------- Client scope ----------------
@pytest.fixture(scope="class")
def client_user():
    r = _login("client@greensolutions.ai", "Client@123")
    assert r.status_code == 200, r.text
    d = r.json()
    return {"id": d["user"]["id"], "headers": {"Authorization": f"Bearer {d['access_token']}"}}


class TestClientScope:
    def test_admin_get_client_scope(self, admin_headers, client_user):
        r = requests.get(f"{API}/team/users/{client_user['id']}/client-scope",
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d["allowed_site_ids"], list)
        assert len(d["allowed_site_ids"]) == 20

    def test_admin_scope_unknown_user_404(self, admin_headers):
        for m in ("get", "patch"):
            fn = getattr(requests, m)
            kw = {"json": {"allowed_site_ids": [], "allowed_categories": []}} if m == "patch" else {}
            r = fn(f"{API}/team/users/nope-xyz/client-scope", headers=admin_headers, timeout=30, **kw)
            assert r.status_code == 404, f"{m}: {r.status_code} {r.text[:200]}"

    def test_my_scope_client(self, client_user):
        r = requests.get(f"{API}/client/scope", headers=client_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["unrestricted"] is False
        assert len(d["allowed_site_ids"]) == 20

    def test_my_scope_non_client_unrestricted(self, normal_user):
        r = requests.get(f"{API}/client/scope", headers=normal_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["unrestricted"] is True

    def test_client_portfolio(self, client_user):
        r = requests.get(f"{API}/client/portfolio", headers=client_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["scope_empty"] is False
        assert d["kpis"]["site_count"] == 20
        assert len(d["sites"]) == 20
        assert all(s["site_type"] == "Utility-Scale Solar" for s in d["sites"])
        assert all("performance_ratio_pct" in s and "availability_pct" in s for s in d["sites"])
        assert d["kpis"]["total_capacity_MW"] > 0

    def test_portfolio_empty_scope_then_restore(self, admin_headers, client_user):
        orig = requests.get(f"{API}/team/users/{client_user['id']}/client-scope",
                            headers=admin_headers, timeout=30).json()
        try:
            p = requests.patch(f"{API}/team/users/{client_user['id']}/client-scope",
                               json={"allowed_site_ids": [], "allowed_categories": []},
                               headers=admin_headers, timeout=30)
            assert p.status_code == 200, p.text
            r = requests.get(f"{API}/client/portfolio", headers=client_user["headers"], timeout=30)
            assert r.status_code == 200
            d = r.json()
            assert d["scope_empty"] is True
            assert d["kpis"]["site_count"] == 0
            assert d["sites"] == []
        finally:
            requests.patch(f"{API}/team/users/{client_user['id']}/client-scope",
                           json={"allowed_site_ids": orig.get("allowed_site_ids", []),
                                 "allowed_categories": orig.get("allowed_categories", [])},
                           headers=admin_headers, timeout=30)
        back = requests.get(f"{API}/client/portfolio", headers=client_user["headers"], timeout=30)
        assert back.json()["kpis"]["site_count"] == 20

    def test_scope_persists_custom_sites(self, admin_headers, client_user):
        orig = requests.get(f"{API}/team/users/{client_user['id']}/client-scope",
                            headers=admin_headers, timeout=30).json()
        try:
            r = requests.patch(f"{API}/team/users/{client_user['id']}/client-scope",
                               json={"allowed_site_ids": ["S00001", "S00002"],
                                     "allowed_categories": []},
                               headers=admin_headers, timeout=30)
            assert r.status_code == 200
            got = requests.get(f"{API}/team/users/{client_user['id']}/client-scope",
                               headers=admin_headers, timeout=30).json()
            assert got["allowed_site_ids"] == ["S00001", "S00002"]
            pf = requests.get(f"{API}/client/portfolio", headers=client_user["headers"], timeout=30).json()
            assert pf["kpis"]["site_count"] == 2
            assert {s["site_id"] for s in pf["sites"]} == {"S00001", "S00002"}
        finally:
            requests.patch(f"{API}/team/users/{client_user['id']}/client-scope",
                           json={"allowed_site_ids": orig.get("allowed_site_ids", []),
                                 "allowed_categories": orig.get("allowed_categories", [])},
                           headers=admin_headers, timeout=30)


# ---------------- Evidence upload (Emergent Object Storage) ----------------
@pytest.fixture(scope="class")
def tech_headers():
    r = _login("tech@greensolutions.ai", "Tech@123")
    assert r.status_code == 200, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}


class TestEvidence:
    uploaded_id = None

    def test_upload_image(self, tech_headers):
        files = {"file": ("evidence.png", io.BytesIO(PNG_BYTES), "image/png")}
        data = {"alarm_id": "AL0000001", "site_id": "S00001",
                "work_order_id": "WO0000001", "note": "TEST_QA evidence"}
        r = requests.post(f"{API}/evidence", files=files, data=data,
                          headers=tech_headers, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["storage_path"].startswith("green-solutions/evidence/")
        assert d["content_type"] == "image/png"
        assert d["alarm_id"] == "AL0000001"
        assert d["note"] == "TEST_QA evidence"
        assert "_id" not in d
        assert d["size"] > 0
        TestEvidence.uploaded_id = d["id"]

    def test_list_evidence_by_alarm(self, tech_headers):
        r = requests.get(f"{API}/evidence", params={"alarm_id": "AL0000001"},
                         headers=tech_headers, timeout=30)
        assert r.status_code == 200, r.text
        items = r.json()
        assert any(i["id"] == TestEvidence.uploaded_id for i in items)
        assert all(i["alarm_id"] == "AL0000001" for i in items)

    def test_fetch_file_with_query_token(self, tech_headers):
        token = tech_headers["Authorization"].split(" ")[1]
        r = requests.get(f"{API}/evidence/{TestEvidence.uploaded_id}/file",
                         params={"auth": token}, timeout=60)
        assert r.status_code == 200, r.text[:300]
        assert r.headers["Content-Type"].startswith("image/")
        assert len(r.content) > 0

    def test_fetch_file_with_header(self, tech_headers):
        r = requests.get(f"{API}/evidence/{TestEvidence.uploaded_id}/file",
                         headers=tech_headers, timeout=60)
        assert r.status_code == 200, r.text[:300]

    def test_fetch_file_no_token_401(self):
        r = requests.get(f"{API}/evidence/{TestEvidence.uploaded_id}/file", timeout=30)
        assert r.status_code == 401, r.text[:200]

    def test_fetch_other_users_evidence_403(self, normal_user):
        r = requests.get(f"{API}/evidence/{TestEvidence.uploaded_id}/file",
                         headers=normal_user["headers"], timeout=30)
        assert r.status_code == 403, r.text[:200]

    def test_fetch_missing_404(self, tech_headers):
        r = requests.get(f"{API}/evidence/{uuid.uuid4()}/file",
                         headers=tech_headers, timeout=30)
        assert r.status_code == 404, r.text[:200]

    def test_non_image_upload_415(self, tech_headers):
        files = {"file": ("notes", io.BytesIO(b"hello world"), "text/plain")}
        r = requests.post(f"{API}/evidence", files=files, data={"alarm_id": "AL0000001"},
                          headers=tech_headers, timeout=60)
        assert r.status_code == 415, f"{r.status_code}: {r.text[:200]}"

    def test_evidence_scoped_to_own_uploads(self, normal_user):
        r = requests.get(f"{API}/evidence", params={"alarm_id": "AL0000001"},
                         headers=normal_user["headers"], timeout=30)
        assert r.status_code == 200
        assert all(i["id"] != TestEvidence.uploaded_id for i in r.json())

    def test_upload_requires_auth(self):
        files = {"file": ("evidence.png", io.BytesIO(PNG_BYTES), "image/png")}
        r = requests.post(f"{API}/evidence", files=files, timeout=30)
        assert r.status_code in (401, 403)
