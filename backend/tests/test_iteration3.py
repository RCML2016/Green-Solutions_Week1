"""Iteration 3 backend tests: AI sessions, Team RBAC, Report scheduler."""
import json
import uuid

import pytest
import requests

from conftest import API


def stream_ask(headers, question, session_id=None, finding_code=None, auto=False, timeout=120):
    """POST /api/ai/insight and consume the SSE stream. Returns (session_id, text, done, errors)."""
    body = {"question": question, "auto": auto}
    if session_id:
        body["session_id"] = session_id
    if finding_code:
        body["finding_code"] = finding_code
    r = requests.post(f"{API}/ai/insight", json=body, headers=headers, stream=True, timeout=timeout)
    assert r.status_code == 200, f"{r.status_code}: {r.text[:300]}"
    sid, text, done, errors = None, "", False, []
    for raw in r.iter_lines(decode_unicode=True):
        if not raw or not raw.startswith("data:"):
            continue
        p = json.loads(raw[5:].strip())
        if "session_id" in p:
            sid = p["session_id"]
        if "delta" in p:
            text += p["delta"]
        if "error" in p:
            errors.append(p["error"])
            break
        if p.get("done"):
            done = True
            break
    return sid, text, done, errors


# ---------- AI session history ----------
class TestAiSessions:
    def test_sessions_require_auth(self):
        assert requests.get(f"{API}/ai/sessions", timeout=30).status_code in (401, 403)

    def test_session_created_and_continued(self, admin_headers):
        sid, text, done, errs = stream_ask(admin_headers, "TEST_QA What is inverter comms dropout?")
        assert not errs, errs
        assert sid and len(sid) == 36, f"first SSE event must carry session_id uuid, got {sid}"
        assert done and len(text.strip()) > 20

        # continue same session
        sid2, text2, done2, errs2 = stream_ask(admin_headers, "TEST_QA And how do I fix it?", session_id=sid)
        assert not errs2, errs2
        assert sid2 == sid, "session_id changed when continuing a session"
        assert done2 and len(text2.strip()) > 20

        # session appears in list
        r = requests.get(f"{API}/ai/sessions", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        sessions = r.json()
        assert isinstance(sessions, list) and len(sessions) >= 1
        assert all("_id" not in s for s in sessions)
        ids = [s["id"] for s in sessions]
        assert sid in ids
        # most-recent-first ordering
        ups = [s["updated_at"] for s in sessions]
        assert ups == sorted(ups, reverse=True), "sessions not sorted most-recent-first"
        mine = next(s for s in sessions if s["id"] == sid)
        assert mine["title"].startswith("TEST_QA What is inverter")

        # detail returns 2 user + 2 assistant messages
        rd = requests.get(f"{API}/ai/sessions/{sid}", headers=admin_headers, timeout=30)
        assert rd.status_code == 200
        d = rd.json()
        assert d["session"]["id"] == sid
        msgs = d["messages"]
        assert len([m for m in msgs if m["role"] == "user"]) >= 2
        assert len([m for m in msgs if m["role"] == "assistant"]) >= 2
        assert all("_id" not in m for m in msgs)
        created = [m["created_at"] for m in msgs]
        assert created == sorted(created), "messages not in chronological order"

        # cross-user isolation: another user cannot read it
        pytest.session_for_delete = sid

    def test_other_user_gets_404(self, admin_headers, normal_user):
        sid, _, _, errs = stream_ask(admin_headers, "TEST_QA isolation check question")
        assert not errs, errs
        r = requests.get(f"{API}/ai/sessions/{sid}", headers=normal_user["headers"], timeout=30)
        assert r.status_code == 404
        rd = requests.delete(f"{API}/ai/sessions/{sid}", headers=normal_user["headers"], timeout=30)
        assert rd.status_code == 404
        # posting insight with someone else's session_id must 404
        rp = requests.post(f"{API}/ai/insight", json={"question": "hi", "session_id": sid},
                           headers=normal_user["headers"], timeout=60)
        assert rp.status_code == 404
        # cleanup
        requests.delete(f"{API}/ai/sessions/{sid}", headers=admin_headers, timeout=30)

    def test_delete_session_removes_messages(self, admin_headers):
        sid, _, done, errs = stream_ask(admin_headers, "TEST_QA delete me session")
        assert not errs and done
        r = requests.delete(f"{API}/ai/sessions/{sid}", headers=admin_headers, timeout=30)
        assert r.status_code == 200 and r.json()["ok"] is True
        assert requests.get(f"{API}/ai/sessions/{sid}", headers=admin_headers, timeout=30).status_code == 404
        ids = [s["id"] for s in requests.get(f"{API}/ai/sessions", headers=admin_headers, timeout=30).json()]
        assert sid not in ids
        from pymongo import MongoClient
        from dotenv import dotenv_values
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        assert cl[be["DB_NAME"]].ai_messages.count_documents({"session_id": sid}) == 0
        cl.close()

    def test_unknown_session_404(self, admin_headers):
        assert requests.get(f"{API}/ai/sessions/{uuid.uuid4()}", headers=admin_headers,
                            timeout=30).status_code == 404

    def test_auto_flag_persisted(self, admin_headers):
        sid, _, done, errs = stream_ask(admin_headers, "TEST_QA auto alert high sev finding",
                                        finding_code="INV-04", auto=True)
        assert not errs and done
        msgs = requests.get(f"{API}/ai/sessions/{sid}", headers=admin_headers, timeout=30).json()["messages"]
        assert any(m["role"] == "user" and m.get("auto") is True for m in msgs), "auto flag not persisted"
        assert any(m.get("finding_code") == "INV-04" for m in msgs)
        requests.delete(f"{API}/ai/sessions/{sid}", headers=admin_headers, timeout=30)


# ---------- Team RBAC ----------
class TestTeamRBAC:
    def test_requires_auth(self):
        assert requests.get(f"{API}/team/users", timeout=30).status_code in (401, 403)

    def test_non_admin_forbidden(self, normal_user):
        h = normal_user["headers"]
        assert requests.get(f"{API}/team/users", headers=h, timeout=30).status_code == 403
        r = requests.post(f"{API}/team/invite", headers=h,
                          json={"email": "test_qa_x@example.com", "name": "X", "role": "owner"}, timeout=30)
        assert r.status_code == 403
        assert requests.delete(f"{API}/team/users/{normal_user['id']}", headers=h,
                               timeout=30).status_code == 403

    def test_invalid_role_422(self, admin_headers):
        r = requests.post(f"{API}/team/invite", headers=admin_headers,
                          json={"email": "test_qa_bad@example.com", "name": "Bad", "role": "superuser"}, timeout=30)
        assert r.status_code == 422

    def test_invalid_email_422(self, admin_headers):
        r = requests.post(f"{API}/team/invite", headers=admin_headers,
                          json={"email": "not-an-email", "name": "Bad", "role": "owner"}, timeout=30)
        assert r.status_code == 422

    @pytest.mark.parametrize("role", ["owner", "technician", "compliance", "admin"])
    def test_invite_each_role_and_login(self, admin_headers, role):
        email = f"test_qa_{role}_{uuid.uuid4().hex[:6]}@example.com"
        r = requests.post(f"{API}/team/invite", headers=admin_headers,
                          json={"email": email, "name": f"TEST_QA {role}", "role": role}, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["user"]["role"] == role
        assert d["user"]["email"] == email.lower()
        temp = d["temporary_password"]
        assert isinstance(temp, str) and len(temp) >= 8

        # appears in team list
        users = requests.get(f"{API}/team/users", headers=admin_headers, timeout=30).json()
        match = [u for u in users if u["email"] == email.lower()]
        assert match, "invited user missing from /team/users"
        assert match[0]["role"] == role
        assert "password_hash" not in match[0] and "_id" not in match[0]

        # temp password actually works
        lr = requests.post(f"{API}/auth/login", json={"email": email, "password": temp}, timeout=30)
        assert lr.status_code == 200, lr.text
        assert lr.json()["user"]["role"] == role

        # duplicate invite rejected
        dup = requests.post(f"{API}/team/invite", headers=admin_headers,
                            json={"email": email, "name": "dupe", "role": role}, timeout=30)
        assert dup.status_code == 400

        # delete
        uid = d["user"]["id"]
        dr = requests.delete(f"{API}/team/users/{uid}", headers=admin_headers, timeout=30)
        assert dr.status_code == 200 and dr.json()["ok"] is True
        users2 = requests.get(f"{API}/team/users", headers=admin_headers, timeout=30).json()
        assert not [u for u in users2 if u["email"] == email.lower()], "user still present after delete"
        # login no longer works
        assert requests.post(f"{API}/auth/login", json={"email": email, "password": temp},
                             timeout=30).status_code == 401

    def test_admin_cannot_remove_self(self, admin_headers):
        me = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30).json()
        r = requests.delete(f"{API}/team/users/{me['id']}", headers=admin_headers, timeout=30)
        assert r.status_code == 400
        assert "cannot remove yourself" in r.json()["detail"].lower()
        # still exists
        assert requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30).status_code == 200

    def test_delete_unknown_user_404(self, admin_headers):
        r = requests.delete(f"{API}/team/users/{uuid.uuid4()}", headers=admin_headers, timeout=30)
        assert r.status_code == 404


# ---------- Report scheduler ----------
class TestReportScheduler:
    def test_requires_auth(self):
        assert requests.get(f"{API}/reports/schedule", timeout=30).status_code in (401, 403)
        assert requests.post(f"{API}/reports/preview", timeout=30).status_code in (401, 403)

    def test_default_schedule(self, normal_user):
        r = requests.get(f"{API}/reports/schedule", headers=normal_user["headers"], timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["frequency"] == "weekly"
        assert d["recipients"] == []
        assert d["enabled"] is False
        assert "_id" not in d

    def test_bad_frequency_422(self, normal_user):
        r = requests.post(f"{API}/reports/schedule", headers=normal_user["headers"],
                          json={"frequency": "hourly", "recipients": ["a@b.com"], "enabled": True}, timeout=30)
        assert r.status_code == 422

    def test_bad_recipient_422(self, normal_user):
        r = requests.post(f"{API}/reports/schedule", headers=normal_user["headers"],
                          json={"frequency": "daily", "recipients": ["not-an-email"], "enabled": True}, timeout=30)
        assert r.status_code == 422

    def test_upsert_and_persist(self, normal_user):
        h = normal_user["headers"]
        payload = {"frequency": "daily", "recipients": ["TEST_QA_ops@Example.com", "b@example.com"],
                   "enabled": True}
        r = requests.post(f"{API}/reports/schedule", headers=h, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        s = r.json()["schedule"]
        assert s["frequency"] == "daily"
        assert s["recipients"] == ["test_qa_ops@example.com", "b@example.com"], s["recipients"]
        assert s["enabled"] is True

        g = requests.get(f"{API}/reports/schedule", headers=h, timeout=30).json()
        assert g["frequency"] == "daily"
        assert g["recipients"] == ["test_qa_ops@example.com", "b@example.com"]
        assert g["enabled"] is True
        assert "created_at" in g and "updated_at" in g

        # upsert (update, not duplicate)
        r2 = requests.post(f"{API}/reports/schedule", headers=h,
                           json={"frequency": "monthly", "recipients": ["c@example.com"], "enabled": False},
                           timeout=30)
        assert r2.status_code == 200
        g2 = requests.get(f"{API}/reports/schedule", headers=h, timeout=30).json()
        assert g2["frequency"] == "monthly"
        assert g2["recipients"] == ["c@example.com"]
        assert g2["enabled"] is False

    def test_preview_reflects_saved_config(self, normal_user):
        h = normal_user["headers"]
        requests.post(f"{API}/reports/schedule", headers=h,
                      json={"frequency": "weekly", "recipients": ["prev@example.com"], "enabled": True},
                      timeout=30)
        r = requests.post(f"{API}/reports/preview", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True
        assert d["frequency"] == "weekly"
        assert d["recipients"] == ["prev@example.com"]
        assert "1 recipient" in d["message"]

    def test_schedule_isolated_per_user(self, admin_headers, normal_user):
        requests.post(f"{API}/reports/schedule", headers=normal_user["headers"],
                      json={"frequency": "daily", "recipients": ["iso@example.com"], "enabled": True}, timeout=30)
        a = requests.get(f"{API}/reports/schedule", headers=admin_headers, timeout=30).json()
        assert "iso@example.com" not in a.get("recipients", [])
