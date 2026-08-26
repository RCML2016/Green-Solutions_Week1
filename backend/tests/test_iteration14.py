"""Iteration 14 — re-test of the 6 fixes:
1. CRITICAL admin self-lockout (roles backfill + reversible /rbac/switch)
2. LOW client-portal empty state / PR clamp (frontend, tested via Playwright)
3. PERF /api/client/portfolio $group aggregation
4. THREADPOOL evidence upload/download non-blocking
"""
import base64
import concurrent.futures as cf
import io
import time
import uuid

import pytest
import requests

from conftest import API

PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
)


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email} failed: {r.status_code} {r.text[:200]}"
    return r.json()


# ---------------- CRITICAL: admin self-lockout ----------------
class TestAdminNoSelfLockout:
    def test_admin_my_roles_contains_admin(self, admin_headers):
        r = requests.get(f"{API}/rbac/my-roles", headers=admin_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "admin" in d["roles"], f"admin missing from roles: {d}"
        assert d["active_role"] == "admin"

    def test_admin_switch_is_reversible(self, admin_creds):
        """admin -> executive keeps 'admin' in roles, and switching back works."""
        d = _login(admin_creds["email"], admin_creds["password"])
        h = {"Authorization": f"Bearer {d['access_token']}"}

        sw = requests.post(f"{API}/rbac/switch", json={"role": "executive"}, headers=h, timeout=30)
        assert sw.status_code == 200, sw.text
        body = sw.json()
        assert body["active_role"] == "executive"
        assert "admin" in body["roles"], f"admin lost from roles after switch: {body}"
        assert "executive" in body["roles"]
        h2 = {"Authorization": f"Bearer {body['access_token']}"}

        # my-roles reflects executive active but admin still held
        mr = requests.get(f"{API}/rbac/my-roles", headers=h2, timeout=30)
        assert mr.status_code == 200
        assert mr.json()["active_role"] == "executive"
        assert "admin" in mr.json()["roles"]

        # switch back to admin
        back = requests.post(f"{API}/rbac/switch", json={"role": "admin"}, headers=h2, timeout=30)
        assert back.status_code == 200, back.text
        assert back.json()["active_role"] == "admin"
        h3 = {"Authorization": f"Bearer {back.json()['access_token']}"}

        # admin-only endpoint works again
        t = requests.get(f"{API}/team/users", headers=h3, timeout=30)
        assert t.status_code == 200, f"admin lost admin powers: {t.status_code} {t.text[:200]}"

        me = requests.get(f"{API}/auth/me", headers=h3, timeout=30)
        assert me.status_code == 200 and me.json()["role"] == "admin"

    def test_non_admin_switch_still_403_for_unheld_role(self, normal_user):
        r = requests.post(f"{API}/rbac/switch", json={"role": "admin"},
                          headers=normal_user["headers"], timeout=30)
        assert r.status_code == 403, r.text


# ---------------- PERF: /api/client/portfolio aggregation ----------------
class TestClientPortfolioAggregation:
    def test_portfolio_shape_default_client(self):
        d = _login("client@greensolutions.ai", "Client@123")
        h = {"Authorization": f"Bearer {d['access_token']}"}
        t0 = time.time()
        r = requests.get(f"{API}/client/portfolio", headers=h, timeout=60)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["scope_empty"] is False
        assert isinstance(body["sites"], list) and len(body["sites"]) > 0
        k = body["kpis"]
        for key in ["site_count", "total_capacity_MW", "avg_performance_ratio_pct",
                    "avg_availability_pct", "actual_kWh_day", "expected_kWh_day"]:
            assert key in k, f"missing kpi {key}"
        s = body["sites"][0]
        for key in ["site_id", "site_name", "site_type", "state", "site_capacity_kW",
                    "performance_ratio_pct", "availability_pct"]:
            assert key in s, f"missing tile field {key}"
        assert k["site_count"] == len(body["sites"])
        # latest perf must be populated for at least most tiles
        with_perf = [x for x in body["sites"] if x["performance_ratio_pct"] is not None]
        assert len(with_perf) >= len(body["sites"]) * 0.5
        print(f"portfolio(20 sites) latency={elapsed:.2f}s")

    def test_portfolio_200_site_scope(self, admin_headers):
        """Scope a throwaway client_viewer to 200 sites; response must still be correct."""
        email = f"test_qa_i14_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "UserPass@123", "name": "TEST_QA i14 client",
            "role": "client_viewer"}, timeout=30)
        assert reg.status_code == 200, reg.text
        uid = reg.json()["user"]["id"]
        h = {"Authorization": f"Bearer {reg.json()['access_token']}"}

        sites = requests.get(f"{API}/fleet/sites?limit=200", headers=admin_headers, timeout=60)
        assert sites.status_code == 200, sites.text
        payload = sites.json()
        rows = payload if isinstance(payload, list) else payload.get("sites") or payload.get("items")
        site_ids = [s["site_id"] for s in rows][:200]
        assert len(site_ids) >= 100, f"only got {len(site_ids)} sites to scope"

        p = requests.patch(f"{API}/team/users/{uid}/client-scope",
                           json={"allowed_site_ids": site_ids, "allowed_categories": []},
                           headers=admin_headers, timeout=30)
        assert p.status_code == 200, p.text

        t0 = time.time()
        r = requests.get(f"{API}/client/portfolio", headers=h, timeout=60)
        elapsed = time.time() - t0
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["scope_empty"] is False
        assert len(body["sites"]) == min(200, len(site_ids))
        assert body["kpis"]["site_count"] == len(body["sites"])
        assert body["kpis"]["total_capacity_MW"] > 0
        print(f"portfolio({len(site_ids)} sites) latency={elapsed:.2f}s")
        assert elapsed < 20, f"portfolio too slow: {elapsed:.1f}s"

    def test_portfolio_empty_scope(self, admin_headers):
        email = f"test_qa_i14_{uuid.uuid4().hex[:8]}@example.com"
        reg = requests.post(f"{API}/auth/register", json={
            "email": email, "password": "UserPass@123", "name": "TEST_QA i14 empty",
            "role": "client_viewer"}, timeout=30)
        assert reg.status_code == 200, reg.text
        h = {"Authorization": f"Bearer {reg.json()['access_token']}"}
        r = requests.get(f"{API}/client/portfolio", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["scope_empty"] is True
        assert body["sites"] == []
        assert body["kpis"]["site_count"] == 0


# ---------------- THREADPOOL: evidence upload / download ----------------
class TestEvidenceThreadpool:
    def test_upload_and_download(self):
        d = _login("tech@greensolutions.ai", "Tech@123")
        h = {"Authorization": f"Bearer {d['access_token']}"}
        r = requests.post(f"{API}/evidence",
                          files={"file": ("TEST_i14.png", io.BytesIO(PNG_BYTES), "image/png")},
                          data={"site_id": "S00001", "note": "TEST_QA i14"},
                          headers=h, timeout=120)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["content_type"] == "image/png"
        assert rec["storage_path"].startswith("green-solutions/evidence/")
        assert "_id" not in rec

        f = requests.get(f"{API}/evidence/{rec['id']}/file", headers=h, timeout=120)
        assert f.status_code == 200, f.text
        assert f.headers["content-type"].startswith("image/png")
        assert f.content[:4] == b"\x89PNG"

        # query-param auth path
        f2 = requests.get(f"{API}/evidence/{rec['id']}/file?auth={d['access_token']}", timeout=120)
        assert f2.status_code == 200
        assert f2.headers["content-type"].startswith("image/png")

    def test_event_loop_not_blocked_during_large_upload(self):
        """Fire a ~4MB upload and hit /api/healthz twice concurrently; the health
        checks must return quickly (event loop free)."""
        d = _login("tech@greensolutions.ai", "Tech@123")
        h = {"Authorization": f"Bearer {d['access_token']}"}
        big = PNG_BYTES + b"\x00" * (4 * 1024 * 1024)

        def upload():
            return requests.post(
                f"{API}/evidence",
                files={"file": ("TEST_i14_big.png", io.BytesIO(big), "image/png")},
                data={"note": "TEST_QA i14 big"}, headers=h, timeout=180)

        def health():
            t0 = time.time()
            r = requests.get(f"{API}/healthz", timeout=60)
            return r.status_code, time.time() - t0

        with cf.ThreadPoolExecutor(max_workers=3) as ex:
            up = ex.submit(upload)
            time.sleep(0.3)
            h1 = ex.submit(health)
            h2 = ex.submit(health)
            r1, t1 = h1.result()
            r2, t2 = h2.result()
            upres = up.result()

        print(f"healthz during upload: {r1} in {t1:.2f}s / {r2} in {t2:.2f}s; upload={upres.status_code}")
        assert r1 == 200 and r2 == 200
        assert upres.status_code in (200, 413), upres.text
        assert max(t1, t2) < 10, f"healthz blocked during upload: {t1:.1f}s / {t2:.1f}s"


# ---------------- REGRESSION: RBAC guards ----------------
class TestRbacRegression:
    def test_client_viewer_blocked_from_admin_endpoints(self):
        d = _login("client@greensolutions.ai", "Client@123")
        h = {"Authorization": f"Bearer {d['access_token']}"}
        r = requests.get(f"{API}/team/users", headers=h, timeout=30)
        assert r.status_code == 403, r.text

    def test_perf_engineer_blocked_from_alert_write(self):
        d = _login("perf@greensolutions.ai", "Perf@123")
        h = {"Authorization": f"Bearer {d['access_token']}"}
        r = requests.post(f"{API}/actions", json={"title": "TEST_QA i14", "site_id": "S00001"},
                          headers=h, timeout=30)
        assert r.status_code == 403, r.text

    def test_client_scope_endpoint(self):
        d = _login("client@greensolutions.ai", "Client@123")
        h = {"Authorization": f"Bearer {d['access_token']}"}
        r = requests.get(f"{API}/client/scope", headers=h, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["unrestricted"] is False
        assert len(body["allowed_site_ids"]) > 0
