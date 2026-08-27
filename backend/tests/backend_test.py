import os
import re
import json
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL is missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def test_credentials():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("Missing /app/memory/test_credentials.md")
    c = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if e and pw:
        return {"email": e.group(1), "password": pw.group(1)}
    row = re.search(r'\|\s*`([^`]+@[^`]+)`\s*\|\s*`([^`]+)`\s*\|\s*admin\s*\|', c)
    if row:
        return {"email": row.group(1), "password": row.group(2)}
    pytest.skip("No creds found")


@pytest.fixture(scope="session")
def auth_token(api_client, test_credentials):
    r = api_client.post(f"{API}/auth/login", json=test_credentials)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    tok = r.json().get("access_token")
    assert tok
    return tok


@pytest.fixture(scope="session")
def temp_user(api_client):
    """A throwaway registered user used for password reset flows."""
    email = f"TEST_reset_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "TestPass@123"
    r = api_client.post(f"{API}/auth/register", json={"email": email, "password": pwd, "name": "TEST Reset User"})
    assert r.status_code == 200, r.text
    yield {"email": email.lower(), "password": pwd}


# ---------- module: auth regression ----------
class TestAuthRegression:
    def test_root(self, api_client):
        r = api_client.get(f"{API}/")
        assert r.status_code == 200
        assert r.json()["message"] == "AssetNova API"

    def test_me_requires_auth(self, api_client):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_login_and_me(self, api_client, auth_token, test_credentials):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == test_credentials["email"].lower()
        assert d["role"] == "admin"
        assert "_id" not in d and "password_hash" not in d

    def test_login_bad_password(self, api_client):
        # Iteration 9: use a throwaway email — 5 failures now lock the identifier for 15 min.
        import uuid as _uuid
        r = api_client.post(f"{API}/auth/login", json={
            "email": f"test_qa_bad_{_uuid.uuid4().hex[:8]}@example.com", "password": "wrong-pass"})
        assert r.status_code == 401

    def test_bcrypt_hash_format(self):
        from pymongo import MongoClient
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        u = cl[be["DB_NAME"]].users.find_one({"email": "admin@assetnova.com"})
        assert u is not None
        assert u["password_hash"].startswith("$2b$"), u["password_hash"][:10]
        cl.close()


# ---------- module: portfolio metrics + jitter ----------
class TestMetrics:
    def test_metrics_requires_auth(self):
        r = requests.get(f"{API}/portfolio/metrics")
        assert r.status_code in (401, 403)

    def test_metrics_shape(self, auth_token):
        r = requests.get(f"{API}/portfolio/metrics", headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        d = r.json()
        for k in ["portfolio_health", "ai_findings", "ai_confidence", "energy_last_24h_mwh",
                  "assets_online", "assets_total", "findings", "server_time"]:
            assert k in d, f"missing {k}"
        assert len(d["findings"]) == 4
        codes = [f["code"] for f in d["findings"]]
        assert "INV-04" in codes
        for f in d["findings"]:
            assert 1 <= f["confidence"] <= 99
            assert f["severity"] in ("high", "medium", "low")

    def test_metrics_jitter_changes(self, auth_token):
        h = {"Authorization": f"Bearer {auth_token}"}
        vals = set()
        for _ in range(4):
            d = requests.get(f"{API}/portfolio/metrics", headers=h).json()
            vals.add((d["portfolio_health"], d["ai_confidence"], d["energy_last_24h_mwh"]))
            time.sleep(0.3)
        assert len(vals) > 1, "metrics did not jitter between polls"


# ---------- module: password reset ----------
class TestPasswordReset:
    def test_forgot_unknown_email_no_enumeration(self, api_client):
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": "nobody_xyz@example.com"})
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["demo_reset_link"] is None
        assert "If an account exists" in d["message"]

    def test_forgot_invalid_email_format(self, api_client):
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": "not-an-email"})
        assert r.status_code == 422

    def test_full_reset_flow(self, api_client, temp_user):
        # forgot
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": temp_user["email"]})
        assert r.status_code == 200
        link = r.json()["demo_reset_link"]
        assert link and "/reset-password?token=" in link
        token = link.split("token=")[1]
        assert len(token) > 20

        new_pwd = "NewPass@456"
        # reset
        r2 = api_client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": new_pwd})
        assert r2.status_code == 200, r2.text
        assert r2.json()["ok"] is True

        # old password rejected
        r3 = api_client.post(f"{API}/auth/login", json={"email": temp_user["email"], "password": temp_user["password"]})
        assert r3.status_code == 401
        # new password works
        r4 = api_client.post(f"{API}/auth/login", json={"email": temp_user["email"], "password": new_pwd})
        assert r4.status_code == 200, r4.text
        assert r4.json()["user"]["email"] == temp_user["email"]

        # token reuse blocked
        r5 = api_client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "Another@789"})
        assert r5.status_code == 400
        assert "already been used" in r5.json()["detail"]
        temp_user["password"] = new_pwd

    def test_reset_bad_token(self, api_client):
        r = api_client.post(f"{API}/auth/reset-password", json={"token": "garbage-token", "new_password": "Whatever@123"})
        assert r.status_code == 400
        assert "Invalid or expired" in r.json()["detail"]

    def test_reset_short_password_validation(self, api_client):
        r = api_client.post(f"{API}/auth/reset-password", json={"token": "x" * 40, "new_password": "123"})
        assert r.status_code == 422

    def test_expired_token_rejected(self, api_client, temp_user):
        """Force-expire a freshly created token in DB and verify rejection."""
        from pymongo import MongoClient
        from datetime import datetime, timezone, timedelta
        r = api_client.post(f"{API}/auth/forgot-password", json={"email": temp_user["email"]})
        token = r.json()["demo_reset_link"].split("token=")[1]
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        cl[be["DB_NAME"]].password_reset_tokens.update_one(
            {"token": token},
            {"$set": {"expires_at": datetime.now(timezone.utc) - timedelta(minutes=5)}},
        )
        cl.close()
        r2 = api_client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "Yetanother@123"})
        assert r2.status_code == 400
        assert "expired" in r2.json()["detail"].lower()


# ---------- module: AI insight SSE ----------
class TestAiInsight:
    def test_requires_auth(self):
        r = requests.post(f"{API}/ai/insight", json={"question": "hello"})
        assert r.status_code in (401, 403)

    def test_validation_empty_question(self, auth_token):
        r = requests.post(f"{API}/ai/insight", json={"question": ""},
                          headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 422

    def test_stream_general(self, auth_token):
        r = requests.post(
            f"{API}/ai/insight",
            json={"question": "Why is portfolio health trending up?"},
            headers={"Authorization": f"Bearer {auth_token}"},
            stream=True, timeout=90,
        )
        assert r.status_code == 200, r.text[:300]
        assert "text/event-stream" in r.headers.get("content-type", "")
        deltas, done, errors = [], False, []
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            payload = json.loads(raw[5:].strip())
            if "delta" in payload:
                deltas.append(payload["delta"])
            if payload.get("done"):
                done = True
                break
            if "error" in payload:
                errors.append(payload["error"])
                break
        assert not errors, f"AI stream error: {errors}"
        assert len(deltas) > 0, "no delta chunks received"
        assert done, "no final done event"
        assert len("".join(deltas).strip()) > 20

    def test_stream_with_finding_context(self, auth_token):
        r = requests.post(
            f"{API}/ai/insight",
            json={"question": "Explain this finding and what to do next.", "finding_code": "INV-04"},
            headers={"Authorization": f"Bearer {auth_token}"},
            stream=True, timeout=90,
        )
        assert r.status_code == 200
        text, done, errors = "", False, []
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            p = json.loads(raw[5:].strip())
            if "delta" in p:
                text += p["delta"]
            if p.get("done"):
                done = True
                break
            if "error" in p:
                errors.append(p["error"])
                break
        assert not errors, f"AI stream error: {errors}"
        assert done
        assert len(text.strip()) > 20


# ---------- module: contact ----------
class TestContact:
    def test_contact_ok(self, api_client):
        r = api_client.post(f"{API}/contact", json={
            "name": "TEST_QA", "email": "TEST_qa@example.com", "message": "TEST message"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_contact_validation(self, api_client):
        r = api_client.post(f"{API}/contact", json={"name": "", "email": "bad", "message": ""})
        assert r.status_code == 422


# ---------- cleanup ----------
@pytest.fixture(scope="session", autouse=True)
def cleanup():
    yield
    try:
        from pymongo import MongoClient
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        d = cl[be["DB_NAME"]]
        d.users.delete_many({"email": {"$regex": "^test_reset_"}})
        d.contact_messages.delete_many({"name": "TEST_QA"})
        cl.close()
    except Exception as e:
        print(f"cleanup skipped: {e}")
