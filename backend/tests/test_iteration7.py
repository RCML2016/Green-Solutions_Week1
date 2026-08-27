"""Iteration 7 regression: portfolios, alerts, branding, snapshots, change-password, auth hygiene."""
import time
import uuid

import requests
from conftest import API


# --- Health / auth basics ---
class TestHealthAndAuth:
    def test_root(self):
        r = requests.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert r.json()["message"] == "AssetNova API"

    def test_login_and_me(self, admin_creds):
        r = requests.post(f"{API}/auth/login", json=admin_creds, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["token_type"] == "bearer"
        assert isinstance(d["access_token"], str) and len(d["access_token"]) > 20
        assert d["user"]["email"] == admin_creds["email"].lower()
        assert d["user"]["role"] == "admin"

        me = requests.get(f"{API}/auth/me",
                          headers={"Authorization": f"Bearer {d['access_token']}"}, timeout=30)
        assert me.status_code == 200
        assert me.json()["email"] == admin_creds["email"].lower()
        assert "password_hash" not in me.json()
        assert "_id" not in me.json()

    def test_login_bad_password(self):
        # Iteration 9: never use the admin email here — 5 bad logins now lock the account.
        r = requests.post(f"{API}/auth/login",
                          json={"email": f"test_qa_nobody_{uuid.uuid4().hex[:8]}@example.com",
                                "password": "wrong-pass-xyz"}, timeout=30)
        assert r.status_code == 401
        assert "Invalid" in r.json()["detail"]

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=30)
        assert r.status_code in (401, 403)

    def test_me_with_garbage_token(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"}, timeout=30)
        assert r.status_code == 401

    def test_repeated_bad_logins_lock_out(self):
        """Iteration 9: 5 consecutive failures lock the identifier for 15 min (429)."""
        email = f"test_qa_i7lock_{uuid.uuid4().hex[:8]}@example.com"
        pwd = "Lock7Pass@123"
        assert requests.post(f"{API}/auth/register",
                             json={"email": email, "password": pwd, "name": "TEST_i7lock"},
                             timeout=30).status_code == 200
        for _ in range(5):
            assert requests.post(f"{API}/auth/login",
                                 json={"email": email, "password": "bad"}, timeout=30).status_code == 401
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=30)
        assert r.status_code == 429, r.text
        try:
            from pymongo import MongoClient
            from dotenv import dotenv_values
            be = dotenv_values("/app/backend/.env")
            cl = MongoClient(be["MONGO_URL"])
            cl[be["DB_NAME"]].login_attempts.delete_many({"identifier": email.lower()})
            cl[be["DB_NAME"]].users.delete_many({"email": email.lower()})
            cl.close()
        except Exception as e:
            print(f"cleanup skipped: {e}")


# --- Portfolios CRUD ---
class TestPortfolios:
    def test_list_autoseeds_default(self, admin_headers):
        r = requests.get(f"{API}/portfolios", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        assert all("_id" not in i for i in items)
        assert any(i["name"] == "Main Renewable Fleet" for i in items)

    def test_create_get_delete(self, admin_headers):
        name = f"TEST_pf_{uuid.uuid4().hex[:6]}"
        c = requests.post(f"{API}/portfolios", headers=admin_headers,
                          json={"name": name, "region": "EU"}, timeout=30)
        assert c.status_code == 200, c.text
        pf = c.json()
        assert pf["name"] == name and pf["region"] == "EU"
        assert isinstance(pf["id"], str) and "_id" not in pf

        listed = requests.get(f"{API}/portfolios", headers=admin_headers, timeout=30).json()
        assert any(i["id"] == pf["id"] and i["name"] == name for i in listed)

        # metrics scoped to portfolio works
        m = requests.get(f"{API}/portfolio/metrics", headers=admin_headers,
                         params={"portfolio_id": pf["id"]}, timeout=30)
        assert m.status_code == 200
        assert len(m.json()["findings"]) == 4

        d = requests.delete(f"{API}/portfolios/{pf['id']}", headers=admin_headers, timeout=30)
        assert d.status_code == 200 and d.json()["ok"] is True
        listed2 = requests.get(f"{API}/portfolios", headers=admin_headers, timeout=30).json()
        assert not any(i["id"] == pf["id"] for i in listed2)

    def test_delete_missing_404(self, admin_headers):
        r = requests.delete(f"{API}/portfolios/{uuid.uuid4()}", headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_metrics_unknown_portfolio_404(self, admin_headers):
        r = requests.get(f"{API}/portfolio/metrics", headers=admin_headers,
                         params={"portfolio_id": str(uuid.uuid4())}, timeout=30)
        assert r.status_code == 404

    def test_portfolio_isolation(self, admin_headers, normal_user):
        c = requests.post(f"{API}/portfolios", headers=admin_headers,
                          json={"name": "TEST_private_pf"}, timeout=30)
        pid = c.json()["id"]
        try:
            other = requests.get(f"{API}/portfolios", headers=normal_user["headers"], timeout=30).json()
            assert not any(i["id"] == pid for i in other)
            d = requests.delete(f"{API}/portfolios/{pid}", headers=normal_user["headers"], timeout=30)
            assert d.status_code == 404
        finally:
            requests.delete(f"{API}/portfolios/{pid}", headers=admin_headers, timeout=30)

    def test_create_validation(self, admin_headers):
        r = requests.post(f"{API}/portfolios", headers=admin_headers, json={"name": ""}, timeout=30)
        assert r.status_code == 422


# --- Alerts ---
class TestAlerts:
    def test_push_list_filter_ack(self, admin_headers):
        code = f"TESTALRT{uuid.uuid4().hex[:4]}"
        p = requests.post(f"{API}/alerts", headers=admin_headers, json={
            "code": code, "title": "TEST_ alert title", "severity": "high", "confidence": 95,
        }, timeout=30)
        assert p.status_code == 200, p.text
        a = p.json()
        assert a["severity"] == "high" and a["confidence"] == 95
        assert a["acknowledged"] is False and "_id" not in a

        lst = requests.get(f"{API}/alerts", headers=admin_headers, timeout=30)
        assert lst.status_code == 200
        items = lst.json()
        assert any(i["id"] == a["id"] for i in items)
        assert items == sorted(items, key=lambda x: x["created_at"], reverse=True)

        hi = requests.get(f"{API}/alerts", headers=admin_headers,
                          params={"severity": "high"}, timeout=30).json()
        assert all(i["severity"] == "high" for i in hi)
        bycode = requests.get(f"{API}/alerts", headers=admin_headers,
                              params={"code": code}, timeout=30).json()
        assert len(bycode) == 1 and bycode[0]["id"] == a["id"]

        ack = requests.post(f"{API}/alerts/{a['id']}/acknowledge", headers=admin_headers, timeout=30)
        assert ack.status_code == 200
        again = requests.get(f"{API}/alerts", headers=admin_headers,
                             params={"code": code}, timeout=30).json()
        assert again[0]["acknowledged"] is True

    def test_ack_missing_404(self, admin_headers):
        r = requests.post(f"{API}/alerts/{uuid.uuid4()}/acknowledge", headers=admin_headers, timeout=30)
        assert r.status_code == 404

    def test_invalid_severity_422(self, admin_headers):
        r = requests.post(f"{API}/alerts", headers=admin_headers, json={
            "code": "X", "title": "t", "severity": "urgent", "confidence": 10}, timeout=30)
        assert r.status_code == 422

    def test_alerts_require_auth(self):
        r = requests.get(f"{API}/alerts", timeout=30)
        assert r.status_code in (401, 403)


# --- Branding ---
class TestBranding:
    def test_get_default_and_save_roundtrip(self, admin_headers):
        original = requests.get(f"{API}/reports/branding", headers=admin_headers, timeout=30)
        assert original.status_code == 200
        prev = original.json()
        assert "_id" not in prev

        payload = {"company_name": "TEST_ Acme Energy", "cover_note": "TEST_ quarterly review",
                   "logo_data_url": ""}
        s = requests.post(f"{API}/reports/branding", headers=admin_headers, json=payload, timeout=30)
        assert s.status_code == 200 and s.json()["ok"] is True

        g = requests.get(f"{API}/reports/branding", headers=admin_headers, timeout=30).json()
        assert g["company_name"] == payload["company_name"]
        assert g["cover_note"] == payload["cover_note"]

        # restore
        requests.post(f"{API}/reports/branding", headers=admin_headers, json={
            "company_name": prev.get("company_name", ""),
            "cover_note": prev.get("cover_note", ""),
            "logo_data_url": prev.get("logo_data_url", "")}, timeout=30)

    def test_oversized_logo_rejected(self, admin_headers):
        r = requests.post(f"{API}/reports/branding", headers=admin_headers, json={
            "company_name": "x", "cover_note": "", "logo_data_url": "a" * 200001}, timeout=30)
        assert r.status_code == 422


# --- Snapshots ---
class TestSnapshots:
    def test_create_and_public_read(self, admin_headers):
        c = requests.post(f"{API}/snapshots", headers=admin_headers,
                          json={"title": "TEST_ snapshot"}, timeout=30)
        assert c.status_code == 200, c.text
        d = c.json()
        assert d["ok"] is True and isinstance(d["token"], str) and len(d["token"]) >= 16
        assert d["url"].endswith(f"/s/{d['token']}")

        # public read: NO auth header
        pub = requests.get(f"{API}/public/snapshots/{d['token']}", timeout=30)
        assert pub.status_code == 200, pub.text
        snap = pub.json()
        assert snap["title"] == "TEST_ snapshot"
        assert "user_id" not in snap and "_id" not in snap
        assert "findings" in snap["metrics"] and len(snap["metrics"]["findings"]) == 4

        # immutability: second read identical metrics
        pub2 = requests.get(f"{API}/public/snapshots/{d['token']}", timeout=30).json()
        assert pub2["metrics"] == snap["metrics"]

    def test_unknown_token_404(self):
        r = requests.get(f"{API}/public/snapshots/nope-{uuid.uuid4().hex}", timeout=30)
        assert r.status_code == 404

    def test_snapshot_requires_auth(self):
        r = requests.post(f"{API}/snapshots", json={"title": "x"}, timeout=30)
        assert r.status_code in (401, 403)


# --- Change password (restores original) ---
class TestChangePassword:
    def test_change_and_revert(self, admin_creds):
        login = requests.post(f"{API}/auth/login", json=admin_creds, timeout=30)
        assert login.status_code == 200
        h = {"Authorization": f"Bearer {login.json()['access_token']}"}
        tmp = "TempQA@98765"

        bad = requests.post(f"{API}/auth/change-password", headers=h, json={
            "current_password": "definitely-wrong", "new_password": tmp}, timeout=30)
        assert bad.status_code == 400
        assert "incorrect" in bad.json()["detail"].lower()

        same = requests.post(f"{API}/auth/change-password", headers=h, json={
            "current_password": admin_creds["password"], "new_password": admin_creds["password"]}, timeout=30)
        assert same.status_code == 400

        short = requests.post(f"{API}/auth/change-password", headers=h, json={
            "current_password": admin_creds["password"], "new_password": "123"}, timeout=30)
        assert short.status_code == 422

        ok = requests.post(f"{API}/auth/change-password", headers=h, json={
            "current_password": admin_creds["password"], "new_password": tmp}, timeout=30)
        assert ok.status_code == 200, ok.text
        assert ok.json()["ok"] is True

        assert requests.post(f"{API}/auth/login", json={
            "email": admin_creds["email"], "password": tmp}, timeout=30).status_code == 200

        # revert
        rev = requests.post(f"{API}/auth/change-password", headers=h, json={
            "current_password": tmp, "new_password": admin_creds["password"]}, timeout=30)
        assert rev.status_code == 200
        assert requests.post(f"{API}/auth/login", json=admin_creds, timeout=30).status_code == 200


# --- Metrics polling behaviour used by dashboard ---
class TestMetricsPolling:
    def test_values_change_between_polls(self, admin_headers):
        a = requests.get(f"{API}/portfolio/metrics", headers=admin_headers, timeout=30).json()
        time.sleep(0.5)
        b = requests.get(f"{API}/portfolio/metrics", headers=admin_headers, timeout=30).json()
        assert a["server_time"] != b["server_time"]
        changed = any(a[k] != b[k] for k in
                      ("portfolio_health", "ai_confidence", "energy_last_24h_mwh"))
        assert changed, "metrics identical across polls; KPI refresh not observable"
