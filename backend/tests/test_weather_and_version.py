"""Tests for Weather Integration + optimistic-concurrency (version) regression.
Covers: /api/fleet/sites/{id}/weather, /assets/{id}/weather, /weather/batch,
/weather/correlation, sites list location_label, and PATCH version check.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://demo-staging-check.preview.emergentagent.com").rstrip("/")
ADMIN_EMAIL = "admin@assetnova.com"
ADMIN_PASSWORD = "Admin@123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


# --- Weather endpoints ---

class TestWeather:
    def test_site_weather_live(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/sites/S00001/weather", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("available") is True, data
        assert data.get("provider") == "WeatherAPI.com"
        assert data.get("data_status") in ("live", "cached")
        assert "current" in data and "temp_c" in data["current"]
        assert isinstance(data.get("forecast"), list) and len(data["forecast"]) >= 3
        assert "location_label" in data
        assert data.get("source") == "site"

    def test_site_weather_not_found(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/sites/NOPE99/weather", headers=auth_headers, timeout=15)
        assert r.status_code == 404

    def test_asset_weather_inherits_from_site(self, auth_headers):
        # find one asset with no zip override
        r = requests.get(f"{BASE_URL}/api/fleet/sites/S00001", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assets = r.json().get("assets") or []
        assert assets, "No assets in S00001"
        # find asset with zip_code null/absent
        inh = next((a for a in assets if not a.get("zip_code")), assets[0])
        aid = inh["asset_id"]
        r2 = requests.get(f"{BASE_URL}/api/fleet/assets/{aid}/weather", headers=auth_headers, timeout=20)
        assert r2.status_code == 200, r2.text
        w = r2.json()
        assert w.get("available") is True
        assert w.get("inherited_from_site") is True
        assert w.get("source") == "site"

    def test_weather_batch(self, auth_headers):
        ids = ",".join(f"S{n:05d}" for n in range(1, 11))
        r = requests.get(f"{BASE_URL}/api/fleet/weather/batch?site_ids={ids}",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        out = r.json()
        assert isinstance(out, dict) and len(out) >= 5
        # at least one entry should have temperature
        avail_count = sum(1 for v in out.values() if v.get("available"))
        assert avail_count >= 1

    def test_weather_correlation(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/weather/correlation?days=14",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "points" in data
        assert isinstance(data["points"], list)
        if data["points"]:
            p = data["points"][0]
            for k in ("date", "avg_pr_pct", "total_lost_kWh", "avg_ghi_w_m2",
                      "avg_module_temp_c", "avg_ambient_temp_c", "avg_wind_mps"):
                assert k in p, f"missing key {k} in correlation point: {p}"


# --- Sites list & detail: location_label + version fields ---

class TestSitesLocationLabel:
    def test_sites_list_has_location_label(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/sites?limit=25", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        items = r.json().get("items") or []
        assert len(items) > 0
        with_label = [i for i in items if i.get("location_label") and "—" in i["location_label"]]
        assert len(with_label) >= 1, "No sites have formatted location_label"
        # at least some backfilled with city/state
        with_city = [i for i in items if i.get("city") and i.get("state")]
        assert len(with_city) >= 5, f"Only {len(with_city)}/25 sites have city+state"

    def test_site_detail_has_label_and_assets_version(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/sites/S00001", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert "location_label" in data
        assert data.get("site", {}).get("site_id") == "S00001"
        assets = data.get("assets") or []
        assert assets
        # Assets should have version field (may be int)
        with_version = [a for a in assets if "version" in a]
        assert len(with_version) >= 1, "Assets missing 'version' field"
        # zip_code field present (may be null) — sanity check inheritance path
        assert any("zip_code" in a for a in assets)


# --- Optimistic concurrency regression on PATCH ---

class TestVersionConcurrency:
    def test_patch_site_version_ok_and_stale_rejected(self, auth_headers):
        # Fetch a site
        r = requests.get(f"{BASE_URL}/api/fleet/sites/S00001", headers=auth_headers, timeout=15)
        site = r.json()["site"]
        # Sites without prior updates default to version=1 via $ifNull in PATCH pipeline
        current_version = site.get("version") or 1

        # Success PATCH with correct version — no-op update (send existing site_name)
        body = {"version": current_version, "site_name": site.get("site_name")}
        r1 = requests.patch(f"{BASE_URL}/api/fleet-admin/sites/S00001",
                            headers=auth_headers, json=body, timeout=15)
        assert r1.status_code in (200, 204), f"Expected 200, got {r1.status_code}: {r1.text}"

        # Verify version bumped by 1
        r2 = requests.get(f"{BASE_URL}/api/fleet/sites/S00001", headers=auth_headers, timeout=15)
        new_version = r2.json()["site"].get("version")
        assert new_version == current_version + 1, f"version not bumped: {current_version} -> {new_version}"

        # Stale version rejected
        stale_body = {"version": current_version, "site_name": site.get("site_name")}
        r3 = requests.patch(f"{BASE_URL}/api/fleet-admin/sites/S00001",
                            headers=auth_headers, json=stale_body, timeout=15)
        assert r3.status_code == 409, f"Expected 409 for stale version, got {r3.status_code}: {r3.text}"

    def test_patch_asset_version(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/sites/S00001", headers=auth_headers, timeout=15)
        assets = r.json().get("assets") or []
        target = next((a for a in assets if "version" in a), None)
        assert target, "No asset with version field"
        aid = target["asset_id"]
        cv = target["version"]

        body = {"version": cv, "asset_name": target.get("asset_name")}
        r1 = requests.patch(f"{BASE_URL}/api/fleet-admin/assets/{aid}",
                            headers=auth_headers, json=body, timeout=15)
        assert r1.status_code in (200, 204), f"PATCH failed: {r1.status_code} {r1.text}"

        # Stale
        r2 = requests.patch(f"{BASE_URL}/api/fleet-admin/assets/{aid}",
                            headers=auth_headers, json=body, timeout=15)
        assert r2.status_code == 409, f"Expected 409, got {r2.status_code}: {r2.text}"


# --- Light regression: dashboard endpoints + demo leads ---

class TestRegressionSmoke:
    def test_kpis(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/kpis", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert "total_sites" in r.json() or "kpis" in r.json() or isinstance(r.json(), dict)

    def test_categories(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/categories", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_work_orders(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/fleet/work-orders?limit=5", headers=auth_headers, timeout=15)
        assert r.status_code == 200

    def test_admin_leads_lists(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/admin/leads", headers=auth_headers, timeout=15)
        assert r.status_code == 200
