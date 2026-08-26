import os
import re
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = _base.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api():
    return API


@pytest.fixture(scope="session")
def admin_creds():
    p = Path("/app/memory/test_credentials.md")
    if not p.exists():
        pytest.skip("missing test_credentials.md")
    c = p.read_text(encoding="utf-8")
    e = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?email(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    pw = re.search(r'(?im)^\s*(?:[-*]\s*)?(?:\*\*)?password(?:\*\*)?\s*:\s*`?([^`\s]+)', c)
    if not e or not pw:
        pytest.skip("no creds in test_credentials.md")
    return {"email": e.group(1), "password": pw.group(1)}


@pytest.fixture(scope="session")
def admin_headers(admin_creds):
    r = requests.post(f"{API}/auth/login", json=admin_creds, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


_created_emails = []


@pytest.fixture(scope="session")
def normal_user():
    """Registers a plain (non-admin) user."""
    email = f"test_qa_user_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "UserPass@123"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": pwd, "name": "TEST_QA User"}, timeout=30)
    assert r.status_code == 200, r.text
    d = r.json()
    _created_emails.append(email.lower())
    return {"email": email, "password": pwd, "id": d["user"]["id"],
            "headers": {"Authorization": f"Bearer {d['access_token']}"}}


@pytest.fixture(scope="session", autouse=True)
def _global_cleanup():
    yield
    try:
        from pymongo import MongoClient
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        d = cl[be["DB_NAME"]]
        # only delete users this worker created (parallel workers must not clobber each other)
        ids = [u["id"] for u in d.users.find({"email": {"$in": _created_emails}}, {"id": 1})]
        d.users.delete_many({"email": {"$in": _created_emails}})
        for uid in ids:
            sess_ids = [s["id"] for s in d.ai_sessions.find({"user_id": uid}, {"id": 1})]
            d.ai_sessions.delete_many({"user_id": uid})
            for sid in sess_ids:
                d.ai_messages.delete_many({"session_id": sid})
            d.report_schedules.delete_many({"user_id": uid})
        cl.close()
    except Exception as e:
        print(f"cleanup skipped: {e}")
