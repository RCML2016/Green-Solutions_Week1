"""Iteration 9 tests: /api/actions, /api/snapshots (list+revoke), login rate limit, weekly digest."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from dotenv import dotenv_values

BE = dotenv_values("/app/backend/.env")


def _mongo():
    from pymongo import MongoClient
    cl = MongoClient(BE["MONGO_URL"])
    return cl, cl[BE["DB_NAME"]]


# --- Recommended Actions ---
class TestActions:
    def test_actions_requires_auth(self, api):
        r = requests.post(f"{api}/actions", json={
            "finding_code": "INV-04", "finding_title": "T", "action_text": "do it"}, timeout=30)
        assert r.status_code in (401, 403), r.text
        r2 = requests.get(f"{api}/actions", timeout=30)
        assert r2.status_code in (401, 403), r2.text

    @pytest.mark.parametrize("payload", [
        {},
        {"finding_code": "INV-04"},
        {"finding_code": "", "finding_title": "T", "action_text": "x"},
        {"finding_code": "INV-04", "finding_title": "T", "action_text": ""},
    ])
    def test_actions_validation(self, api, normal_user, payload):
        r = requests.post(f"{api}/actions", json=payload, headers=normal_user["headers"], timeout=30)
        assert r.status_code == 422, f"{payload} -> {r.status_code} {r.text[:200]}"

    def test_create_and_list_action(self, api, normal_user):
        body = {"finding_code": "TEST_INV-04", "finding_title": "TEST_ Communication Dropout",
                "action_text": "TEST_ Dispatch tech to inverter 4."}
        r = requests.post(f"{api}/actions", json=body, headers=normal_user["headers"], timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "_id" not in d
        assert isinstance(d["id"], str) and len(d["id"]) > 0
        assert d["finding_code"] == body["finding_code"]
        assert d["finding_title"] == body["finding_title"]
        assert d["action_text"] == body["action_text"]
        assert d["status"] == "accepted"
        assert d["created_at"]

        g = requests.get(f"{api}/actions", headers=normal_user["headers"], timeout=30)
        assert g.status_code == 200, g.text
        items = g.json()
        assert isinstance(items, list)
        match = [i for i in items if i["id"] == d["id"]]
        assert len(match) == 1, "created action not persisted / not listed"
        assert "_id" not in match[0]
        assert match[0]["action_text"] == body["action_text"]

    def test_actions_scoped_per_user(self, api, normal_user, admin_headers):
        body = {"finding_code": "TEST_SCOPE", "finding_title": "TEST_scope",
                "action_text": "TEST_ should not be visible to admin"}
        r = requests.post(f"{api}/actions", json=body, headers=normal_user["headers"], timeout=30)
        assert r.status_code == 200
        aid = r.json()["id"]
        g = requests.get(f"{api}/actions", headers=admin_headers, timeout=30)
        assert g.status_code == 200
        assert all(i["id"] != aid for i in g.json()), "actions leak across users"


# --- Snapshot manager ---
class TestSnapshots:
    def test_snapshots_requires_auth(self, api):
        assert requests.get(f"{api}/snapshots", timeout=30).status_code in (401, 403)
        assert requests.delete(f"{api}/snapshots/xyz", timeout=30).status_code in (401, 403)

    def test_list_snapshots_no_metrics_and_sorted(self, api, normal_user):
        tokens = []
        for i in range(2):
            r = requests.post(f"{api}/snapshots", json={"title": f"TEST_snap_{i}"},
                              headers=normal_user["headers"], timeout=60)
            assert r.status_code == 200, r.text
            tokens.append(r.json()["token"])
        g = requests.get(f"{api}/snapshots", headers=normal_user["headers"], timeout=30)
        assert g.status_code == 200, g.text
        items = g.json()
        assert len(items) >= 2
        for it in items:
            assert "metrics" not in it, "heavy metrics blob leaked in list"
            assert "_id" not in it
            assert "token" in it and "created_at" in it
        # newest first
        dates = [it["created_at"] for it in items]
        assert dates == sorted(dates, reverse=True), "snapshots not newest-first"
        assert items[0]["token"] == tokens[-1]

    def test_revoke_own_snapshot_and_public_404(self, api, normal_user):
        r = requests.post(f"{api}/snapshots", json={"title": "TEST_revoke"},
                          headers=normal_user["headers"], timeout=60)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        pub = requests.get(f"{api}/public/snapshots/{token}", timeout=30)
        assert pub.status_code == 200

        d = requests.delete(f"{api}/snapshots/{token}", headers=normal_user["headers"], timeout=30)
        assert d.status_code == 200, d.text
        assert d.json().get("ok") is True

        assert requests.get(f"{api}/public/snapshots/{token}", timeout=30).status_code == 404
        g = requests.get(f"{api}/snapshots", headers=normal_user["headers"], timeout=30)
        assert all(it["token"] != token for it in g.json())

    def test_revoke_other_users_snapshot_404(self, api, normal_user, admin_headers):
        r = requests.post(f"{api}/snapshots", json={"title": "TEST_foreign"},
                          headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        token = r.json()["token"]
        d = requests.delete(f"{api}/snapshots/{token}", headers=normal_user["headers"], timeout=30)
        assert d.status_code == 404, f"cross-user revoke allowed! {d.status_code}"
        # still public-readable
        assert requests.get(f"{api}/public/snapshots/{token}", timeout=30).status_code == 200
        requests.delete(f"{api}/snapshots/{token}", headers=admin_headers, timeout=30)

    def test_revoke_unknown_token_404(self, api, normal_user):
        d = requests.delete(f"{api}/snapshots/does-not-exist-{uuid.uuid4().hex}",
                            headers=normal_user["headers"], timeout=30)
        assert d.status_code == 404


# --- Login rate limiting ---
class TestLoginRateLimit:
    def test_lockout_after_five_failures(self, api):
        email = f"test_qa_lock_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "LockPass@123"
        reg = requests.post(f"{api}/auth/register",
                            json={"email": email, "password": pwd, "name": "TEST_Lock"}, timeout=30)
        assert reg.status_code == 200, reg.text

        for i in range(5):
            r = requests.post(f"{api}/auth/login", json={"email": email, "password": "wrong!"}, timeout=30)
            assert r.status_code == 401, f"attempt {i+1}: {r.status_code} {r.text[:200]}"

        r6 = requests.post(f"{api}/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert r6.status_code == 429, f"expected 429 got {r6.status_code} {r6.text[:200]}"
        detail = r6.json().get("detail", "")
        assert "Too many failed attempts" in detail, detail
        assert "Try again in ~" in detail, detail

        # clear the lock and confirm login restored
        cl, db = _mongo()
        try:
            db.login_attempts.delete_many({"identifier": email.lower()})
        finally:
            cl.close()
        ok = requests.post(f"{api}/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert ok.status_code == 200, ok.text

        cl, db = _mongo()
        try:
            db.users.delete_many({"email": email.lower()})
            db.login_attempts.delete_many({"identifier": email.lower()})
        finally:
            cl.close()

    def test_success_clears_counter(self, api):
        email = f"test_qa_clear_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "ClearPass@123"
        assert requests.post(f"{api}/auth/register",
                             json={"email": email, "password": pwd, "name": "TEST_Clear"},
                             timeout=30).status_code == 200
        for _ in range(3):
            assert requests.post(f"{api}/auth/login",
                                 json={"email": email, "password": "nope"}, timeout=30).status_code == 401
        assert requests.post(f"{api}/auth/login",
                             json={"email": email, "password": pwd}, timeout=30).status_code == 200
        cl, db = _mongo()
        try:
            assert db.login_attempts.find_one({"identifier": email.lower()}) is None, \
                "counter not cleared after successful login"
            # 4 more failures must NOT lock (counter restarted)
        finally:
            cl.close()
        for i in range(4):
            assert requests.post(f"{api}/auth/login",
                                 json={"email": email, "password": "nope"}, timeout=30).status_code == 401
        assert requests.post(f"{api}/auth/login",
                             json={"email": email, "password": pwd}, timeout=30).status_code == 200
        cl, db = _mongo()
        try:
            db.users.delete_many({"email": email.lower()})
            db.login_attempts.delete_many({"identifier": email.lower()})
        finally:
            cl.close()


# --- AI weekly digest ---
class TestWeeklyDigest:
    def test_digest_requires_auth(self, api):
        assert requests.post(f"{api}/reports/weekly-digest", timeout=30).status_code in (401, 403)

    def test_digest_generation(self, api, normal_user):
        # seed one action so actions_count >= 1
        requests.post(f"{api}/actions", json={
            "finding_code": "TEST_DIG", "finding_title": "TEST_digest finding",
            "action_text": "TEST_ Clean array row 3."}, headers=normal_user["headers"], timeout=30)
        r = requests.post(f"{api}/reports/weekly-digest", headers=normal_user["headers"], timeout=120)
        assert r.status_code == 200, f"{r.status_code} {r.text[:400]}"
        d = r.json()
        assert d["ok"] is True
        assert isinstance(d["digest"], str) and len(d["digest"].strip()) > 30, d["digest"][:200]
        assert isinstance(d["alerts_count"], int) and d["alerts_count"] >= 0
        assert isinstance(d["actions_count"], int) and d["actions_count"] >= 1
        gen = datetime.fromisoformat(d["generated_at"].replace("Z", "+00:00"))
        assert abs((datetime.now(timezone.utc) - gen)) < timedelta(minutes=5)
