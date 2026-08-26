"""Iteration 12 — RBAC + role-based navigation backend tests."""
import uuid

import pytest
import requests
from dotenv import dotenv_values
from pymongo import MongoClient

DEMO = {
    "executive": ("executive@greensolutions.ai", "Executive@123"),
    "asset_manager": ("assetmgr@greensolutions.ai", "Asset@123"),
    "om_manager": ("ops@greensolutions.ai", "Ops@123"),
    "technician": ("tech@greensolutions.ai", "Tech@123"),
    "admin": ("admin@greensolutions.ai", "Admin@123"),
}


def _login(api, email, password):
    return requests.post(f"{api}/auth/login", json={"email": email, "password": password}, timeout=30)


@pytest.fixture(scope="module")
def role_tokens(api):
    out = {}
    for role, (email, pwd) in DEMO.items():
        r = _login(api, email, pwd)
        assert r.status_code == 200, f"{role} login failed {r.status_code}: {r.text[:200]}"
        d = r.json()
        out[role] = {
            "headers": {"Authorization": f"Bearer {d['access_token']}"},
            "user": d["user"],
        }
    return out


# ---------------- rbac/landing (public) ----------------
class TestRbacLanding:
    def test_landing_map_no_auth(self, api):
        r = requests.get(f"{api}/rbac/landing", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["landing"]["executive"] == "/overview"
        assert d["landing"]["asset_manager"] == "/dashboard"
        assert d["landing"]["om_manager"] == "/operations"
        assert d["landing"]["technician"] == "/my-work"
        assert d["landing"]["admin"] == "/admin"
        # iteration 13 added performance_engineer + client_viewer
        assert {"executive", "asset_manager", "om_manager", "technician", "admin"} <= set(d["mvp_roles"])
        assert {"performance_engineer", "client_viewer"} <= set(d["mvp_roles"])


# ---------------- register with role ----------------
class TestRegisterRole:
    created = []

    @pytest.mark.parametrize("role", ["executive", "asset_manager", "om_manager", "technician"])
    def test_register_with_role(self, api, role):
        email = f"test_qa_r12_{role}_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{api}/auth/register",
                          json={"email": email, "password": "Pass@1234", "name": "TEST_QA R12", "role": role},
                          timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == role
        TestRegisterRole.created.append(email.lower())
        # verify via /auth/me
        me = requests.get(f"{api}/auth/me",
                          headers={"Authorization": f"Bearer {d['access_token']}"}, timeout=30)
        assert me.status_code == 200
        assert me.json()["role"] == role
        assert "_id" not in me.json()

    def test_register_default_role_executive(self, api):
        email = f"test_qa_r12_def_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{api}/auth/register",
                          json={"email": email, "password": "Pass@1234", "name": "TEST_QA Def"}, timeout=30)
        assert r.status_code == 200, r.text
        TestRegisterRole.created.append(email.lower())
        assert r.json()["user"]["role"] == "executive"

    @pytest.mark.parametrize("bad", ["invalid", "admin", "user", ""])
    def test_register_invalid_role_422(self, api, bad):
        email = f"test_qa_r12_bad_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{api}/auth/register",
                          json={"email": email, "password": "Pass@1234", "name": "X", "role": bad}, timeout=30)
        assert r.status_code == 422, f"expected 422 for role={bad!r}, got {r.status_code}"

    @classmethod
    def teardown_class(cls):
        try:
            be = dotenv_values("/app/backend/.env")
            cl = MongoClient(be["MONGO_URL"])
            cl[be["DB_NAME"]].users.delete_many({"email": {"$in": cls.created}})
            cl.close()
        except Exception as e:
            print(f"cleanup skipped: {e}")


# ---------------- demo accounts / JWT role ----------------
class TestDemoAccounts:
    @pytest.mark.parametrize("role", list(DEMO))
    def test_login_role_in_payload(self, api, role_tokens, role):
        u = role_tokens[role]["user"]
        assert u["role"] == role
        assert u["email"] == DEMO[role][0]
        me = requests.get(f"{api}/auth/me", headers=role_tokens[role]["headers"], timeout=30)
        assert me.status_code == 200
        assert me.json()["role"] == role
        assert "password_hash" not in me.json()

    def test_legacy_user_role_migrated(self):
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        n = cl[be["DB_NAME"]].users.count_documents({"role": "user"})
        cl.close()
        assert n == 0, f"{n} users still have legacy role 'user'"


# ---------------- endpoint guards ----------------
ALERT_PAYLOAD = {"code": "TEST_QA_R12", "title": "TEST_QA RBAC alert", "severity": "high", "confidence": 80}
ACTION_PAYLOAD = {"finding_code": "TEST_QA_R12", "finding_title": "TEST_QA finding", "action_text": "TEST_QA action"}


class TestEndpointGuards:
    @pytest.mark.parametrize("role", ["technician", "asset_manager", "om_manager", "admin"])
    def test_post_alerts_allowed(self, api, role_tokens, role):
        r = requests.post(f"{api}/alerts", json=ALERT_PAYLOAD, headers=role_tokens[role]["headers"], timeout=30)
        assert r.status_code == 200, f"{role}: {r.status_code} {r.text[:200]}"
        assert r.json().get("id")

    def test_post_alerts_executive_403(self, api, role_tokens):
        r = requests.post(f"{api}/alerts", json=ALERT_PAYLOAD, headers=role_tokens["executive"]["headers"], timeout=30)
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"

    def test_post_alerts_no_auth_401(self, api):
        r = requests.post(f"{api}/alerts", json=ALERT_PAYLOAD, timeout=30)
        assert r.status_code in (401, 403)

    @pytest.mark.parametrize("role", ["technician", "asset_manager", "om_manager", "admin"])
    def test_post_actions_allowed(self, api, role_tokens, role):
        r = requests.post(f"{api}/actions", json=ACTION_PAYLOAD, headers=role_tokens[role]["headers"], timeout=30)
        assert r.status_code == 200, f"{role}: {r.status_code} {r.text[:200]}"

    def test_post_actions_executive_403(self, api, role_tokens):
        r = requests.post(f"{api}/actions", json=ACTION_PAYLOAD, headers=role_tokens["executive"]["headers"], timeout=30)
        assert r.status_code == 403

    def test_acknowledge_guard(self, api, role_tokens):
        cr = requests.post(f"{api}/alerts", json=ALERT_PAYLOAD,
                           headers=role_tokens["om_manager"]["headers"], timeout=30)
        assert cr.status_code == 200, cr.text
        aid = cr.json()["id"]
        # executive blocked
        r = requests.post(f"{api}/alerts/{aid}/acknowledge",
                          headers=role_tokens["executive"]["headers"], timeout=30)
        assert r.status_code == 403
        # owner role allowed
        r2 = requests.post(f"{api}/alerts/{aid}/acknowledge",
                           headers=role_tokens["om_manager"]["headers"], timeout=30)
        assert r2.status_code == 200, r2.text

    @pytest.mark.parametrize("role", ["executive", "asset_manager", "om_manager", "technician"])
    def test_team_users_admin_only(self, api, role_tokens, role):
        r = requests.get(f"{api}/team/users", headers=role_tokens[role]["headers"], timeout=30)
        assert r.status_code == 403, f"{role} got {r.status_code}"

    def test_team_users_admin_ok(self, api, role_tokens):
        r = requests.get(f"{api}/team/users", headers=role_tokens["admin"]["headers"], timeout=30)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 5
        assert all("_id" not in u and "password_hash" not in u for u in users)

    # fleet endpoints intentionally not role-gated
    @pytest.mark.parametrize("role", ["executive", "technician"])
    def test_fleet_open_to_all_roles(self, api, role_tokens, role):
        r = requests.get(f"{api}/fleet/kpis", headers=role_tokens[role]["headers"], timeout=60)
        assert r.status_code == 200, r.text


# ---------------- role change (admin only) ----------------
class TestRoleChange:
    emails = []

    @pytest.fixture(scope="class")
    def target_user(self, api):
        email = f"test_qa_r12_target_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{api}/auth/register",
                          json={"email": email, "password": "Pass@1234", "name": "TEST_QA Target",
                                "role": "technician"}, timeout=30)
        assert r.status_code == 200, r.text
        TestRoleChange.emails.append(email.lower())
        return {"id": r.json()["user"]["id"], "email": email,
                "headers": {"Authorization": f"Bearer {r.json()['access_token']}"}}

    def test_admin_changes_role_and_persists(self, api, role_tokens, target_user):
        r = requests.patch(f"{api}/team/users/{target_user['id']}/role",
                           json={"role": "om_manager"},
                           headers=role_tokens["admin"]["headers"], timeout=30)
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "om_manager"
        # verify persisted via team list
        lst = requests.get(f"{api}/team/users", headers=role_tokens["admin"]["headers"], timeout=30).json()
        match = [u for u in lst if u["id"] == target_user["id"]]
        assert match and match[0]["role"] == "om_manager"

    def test_non_admin_403(self, api, role_tokens, target_user):
        for role in ["executive", "asset_manager", "om_manager", "technician"]:
            r = requests.patch(f"{api}/team/users/{target_user['id']}/role",
                               json={"role": "executive"},
                               headers=role_tokens[role]["headers"], timeout=30)
            assert r.status_code == 403, f"{role} got {r.status_code}"

    def test_admin_cannot_demote_self(self, api, role_tokens):
        admin_id = role_tokens["admin"]["user"]["id"]
        r = requests.patch(f"{api}/team/users/{admin_id}/role", json={"role": "executive"},
                           headers=role_tokens["admin"]["headers"], timeout=30)
        assert r.status_code == 400, r.text
        # admin role intact
        me = requests.get(f"{api}/auth/me", headers=role_tokens["admin"]["headers"], timeout=30)
        assert me.json()["role"] == "admin"

    def test_invalid_role_422(self, api, role_tokens, target_user):
        r = requests.patch(f"{api}/team/users/{target_user['id']}/role", json={"role": "wizard"},
                           headers=role_tokens["admin"]["headers"], timeout=30)
        assert r.status_code == 422

    def test_unknown_user_404(self, api, role_tokens):
        r = requests.patch(f"{api}/team/users/{uuid.uuid4()}/role", json={"role": "executive"},
                           headers=role_tokens["admin"]["headers"], timeout=30)
        assert r.status_code == 404

    @classmethod
    def teardown_class(cls):
        try:
            be = dotenv_values("/app/backend/.env")
            cl = MongoClient(be["MONGO_URL"])
            cl[be["DB_NAME"]].users.delete_many({"email": {"$in": cls.emails}})
            cl.close()
        except Exception as e:
            print(f"cleanup skipped: {e}")


# ---------------- auth playbook checks ----------------
class TestAuthPlaybook:
    def test_bcrypt_hash_format(self):
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        u = cl[be["DB_NAME"]].users.find_one({"email": "admin@greensolutions.ai"})
        cl.close()
        assert u and u["password_hash"].startswith("$2b$"), u["password_hash"][:10] if u else "no admin"

    def test_bad_password_401(self, api):
        r = _login(api, "executive@greensolutions.ai", "WrongPass@999")
        assert r.status_code in (401, 429)

    def test_brute_force_lockout(self, api):
        email = f"test_qa_r12_bf_{uuid.uuid4().hex[:6]}@example.com"
        reg = requests.post(f"{api}/auth/register",
                            json={"email": email, "password": "Pass@1234", "name": "TEST_QA BF"}, timeout=30)
        assert reg.status_code == 200
        codes = [_login(api, email, "nope").status_code for _ in range(6)]
        assert 429 in codes, f"no lockout after 6 bad attempts: {codes}"
        try:
            be = dotenv_values("/app/backend/.env")
            cl = MongoClient(be["MONGO_URL"])
            cl[be["DB_NAME"]].users.delete_many({"email": email.lower()})
            cl[be["DB_NAME"]].login_attempts.delete_many({"identifier": email.lower()})
            cl.close()
        except Exception:
            pass
