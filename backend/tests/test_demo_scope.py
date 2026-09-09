"""Tests for the Demo/Pilot Asset Display Limit feature."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://demo-staging-check.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CATEGORIES = [
    "Utility-Scale Solar",
    "Commercial Rooftop Solar",
    "Community Solar",
    "Battery Energy Storage",
    "Wind Farm",
    "Residential/C&I Distributed Solar",
    "Small Hydro",
    "Small Distributed Wind",
]


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def admin_headers():
    return {"Authorization": f"Bearer {_login('admin@assetnova.com', 'Admin@123')}"}


@pytest.fixture(scope="module")
def mgr_headers():
    return {"Authorization": f"Bearer {_login('assetmgr@assetnova.com', 'Asset@123')}"}


@pytest.fixture(scope="module")
def client_headers():
    return {"Authorization": f"Bearer {_login('client@assetnova.com', 'Client@123')}"}


# --- Workspace state ---------------------------------------------------------

def test_workspace_in_demo_mode(admin_headers):
    r = requests.get(f"{API}/workspace", headers=admin_headers, timeout=30)
    assert r.status_code == 200
    j = r.json()
    assert j.get("mode") in ("demo", "pilot"), f"workspace mode must be demo/pilot, got {j.get('mode')}"
    # New fields from feature spec
    assert "demo_mode_enabled" in j
    assert "demo_asset_limit_per_category" in j
    assert j["demo_asset_limit_per_category"] == 5


# --- Admin exemption ---------------------------------------------------------

def test_admin_sees_full_portfolio(admin_headers):
    cats = requests.get(f"{API}/fleet/categories", headers=admin_headers, timeout=30).json()
    total_sites = sum(c.get("site_count", 0) for c in cats)
    total_assets = sum(c.get("asset_count", 0) for c in cats)
    assert total_sites >= 300, f"admin should see full sites, got {total_sites}"
    assert total_assets >= 4000, f"admin should see full assets, got {total_assets}"


def test_admin_fleet_admin_assets_full(admin_headers):
    r = requests.get(f"{API}/fleet-admin/assets", headers=admin_headers, timeout=30, params={"limit": 1})
    assert r.status_code == 200
    j = r.json()
    total = j.get("total") or j.get("count") or (j.get("pagination", {}) or {}).get("total")
    assert total and total >= 4000, f"admin should see full assets: {j}"


# --- Non-admin demo scope ----------------------------------------------------

def test_nonadmin_categories_capped(mgr_headers):
    r = requests.get(f"{API}/fleet/categories", headers=mgr_headers, timeout=30)
    assert r.status_code == 200
    cats = r.json()
    seen = {c["site_type"]: c for c in cats if "site_type" in c}
    for cat in CATEGORIES:
        if cat in seen:
            assert seen[cat]["site_count"] <= 5, f"{cat} has {seen[cat]['site_count']} sites, expected <=5"


def test_nonadmin_sites_capped_and_deterministic(mgr_headers):
    r1 = requests.get(f"{API}/fleet/sites", headers=mgr_headers, params={"category": "Utility-Scale Solar"}, timeout=30)
    assert r1.status_code == 200
    sites1 = r1.json()
    if isinstance(sites1, dict):
        sites1 = sites1.get("sites") or sites1.get("items") or sites1.get("data") or []
    assert len(sites1) <= 5
    ids1 = sorted([s["site_id"] for s in sites1])

    r2 = requests.get(f"{API}/fleet/sites", headers=mgr_headers, params={"category": "Utility-Scale Solar"}, timeout=30)
    sites2 = r2.json()
    if isinstance(sites2, dict):
        sites2 = sites2.get("sites") or sites2.get("items") or sites2.get("data") or []
    ids2 = sorted([s["site_id"] for s in sites2])
    assert ids1 == ids2, f"non-deterministic: {ids1} != {ids2}"


def test_nonadmin_total_sites_around_40(mgr_headers):
    r = requests.get(f"{API}/fleet/sites", headers=mgr_headers, timeout=30)
    assert r.status_code == 200
    j = r.json()
    sites = j if isinstance(j, list) else (j.get("sites") or j.get("items") or j.get("data") or [])
    # allow featured toggles => not strictly 40
    assert len(sites) <= 40, f"non-admin should see <=40 sites in demo mode, got {len(sites)}"
    assert len(sites) >= 30


def test_nonadmin_site_detail_asset_breakdown_capped(mgr_headers):
    r = requests.get(f"{API}/fleet/sites", headers=mgr_headers, params={"category": "Utility-Scale Solar"}, timeout=30)
    sites = r.json()
    if isinstance(sites, dict):
        sites = sites.get("sites") or sites.get("items") or []
    assert sites, "no sites returned"
    site_id = sites[0]["site_id"]
    d = requests.get(f"{API}/fleet/sites/{site_id}", headers=mgr_headers, timeout=30)
    assert d.status_code == 200
    detail = d.json()
    breakdown = detail.get("asset_breakdown") or []
    for row in breakdown:
        cnt = row.get("count") or row.get("asset_count") or 0
        assert cnt <= 5, f"asset_breakdown row {row} exceeds 5"


def test_nonadmin_fleet_admin_assets_scoped(mgr_headers, admin_headers):
    m = requests.get(f"{API}/fleet-admin/assets", headers=mgr_headers, params={"limit": 1}, timeout=30).json()
    a = requests.get(f"{API}/fleet-admin/assets", headers=admin_headers, params={"limit": 1}, timeout=30).json()
    m_total = m.get("total") or (m.get("pagination", {}) or {}).get("total")
    a_total = a.get("total") or (a.get("pagination", {}) or {}).get("total")
    assert m_total and a_total
    assert m_total < a_total, f"mgr({m_total}) should be less than admin({a_total})"
    assert m_total <= 600, f"mgr should see ~351 demo-scoped assets, got {m_total}"


def test_nonadmin_states_sum_40(mgr_headers):
    r = requests.get(f"{API}/fleet/states", headers=mgr_headers, timeout=30)
    assert r.status_code == 200
    j = r.json()
    rows = j if isinstance(j, list) else (j.get("states") or j.get("data") or [])
    total = sum((row.get("site_count") or row.get("count") or 0) for row in rows)
    assert total <= 45, f"states breakdown sum={total}, should be ~40"


def test_nonadmin_alarms_and_workorders_scoped(mgr_headers, admin_headers):
    for path in ("alarms", "work-orders"):
        m = requests.get(f"{API}/fleet/{path}", headers=mgr_headers, timeout=30)
        a = requests.get(f"{API}/fleet/{path}", headers=admin_headers, timeout=30)
        assert m.status_code == 200 and a.status_code == 200, f"{path} failed"
        mj, aj = m.json(), a.json()
        m_items = mj if isinstance(mj, list) else (mj.get("items") or mj.get("alarms") or mj.get("work_orders") or mj.get("data") or [])
        a_items = aj if isinstance(aj, list) else (aj.get("items") or aj.get("alarms") or aj.get("work_orders") or aj.get("data") or [])
        assert len(m_items) <= len(a_items), f"{path}: mgr sees more than admin"


# --- Featured toggle ---------------------------------------------------------

def _get_utility_scale_ids(headers):
    r = requests.get(f"{API}/fleet/sites", headers=headers, params={"category": "Utility-Scale Solar"}, timeout=30)
    j = r.json()
    sites = j if isinstance(j, list) else (j.get("sites") or j.get("items") or [])
    return set(s["site_id"] for s in sites)


def test_featured_toggle_moves_site_into_demo_scope(admin_headers, mgr_headers):
    before = _get_utility_scale_ids(mgr_headers)
    # pick a Utility-Scale Solar site that is NOT currently featured (admin sees all)
    all_j = requests.get(
        f"{API}/fleet/sites", headers=admin_headers, params={"category": "Utility-Scale Solar"}, timeout=30
    ).json()
    items = all_j if isinstance(all_j, list) else (all_j.get("sites") or all_j.get("items") or [])
    us_sites = [s for s in items if s["site_id"] not in before]
    assert us_sites, "no candidate Utility-Scale site outside demo scope"
    target = us_sites[0]["site_id"]

    tr = requests.post(f"{API}/fleet-admin/sites/{target}/toggle-featured", headers=admin_headers, timeout=30)
    assert tr.status_code == 200, f"toggle failed: {tr.status_code} {tr.text}"

    try:
        after = _get_utility_scale_ids(mgr_headers)
        assert target in after, f"{target} should now be in demo scope"
        assert len(after) <= 5
    finally:
        # revert
        requests.post(f"{API}/fleet-admin/sites/{target}/toggle-featured", headers=admin_headers, timeout=30)


def test_toggle_featured_non_admin_forbidden(mgr_headers, admin_headers):
    j = requests.get(f"{API}/fleet/sites", headers=admin_headers, params={"category": "Utility-Scale Solar"}, timeout=30).json()
    items = j if isinstance(j, list) else (j.get("sites") or j.get("items") or [])
    site_id = items[0]["site_id"]
    r = requests.post(f"{API}/fleet-admin/sites/{site_id}/toggle-featured", headers=mgr_headers, timeout=30)
    assert r.status_code in (401, 403), f"non-admin toggle should be forbidden, got {r.status_code}"


# --- Client viewer -----------------------------------------------------------

def test_client_portfolio_intersects_demo(client_headers):
    r = requests.get(f"{API}/client/portfolio", headers=client_headers, timeout=30)
    assert r.status_code == 200, f"client portfolio failed: {r.status_code} {r.text}"
    j = r.json()
    # ensure error-free (has sites or scope_empty)
    assert "sites" in j


# --- Workspace mode switch: production restores full data --------------------

def test_workspace_mode_switch_restores_full_data(admin_headers, mgr_headers):
    # Snapshot before
    before = requests.get(f"{API}/fleet-admin/assets", headers=mgr_headers, params={"limit": 1}, timeout=30).json()
    before_total = before.get("total") or (before.get("pagination", {}) or {}).get("total")

    # Switch to production (scenario is required by API)
    p = requests.patch(f"{API}/workspace", headers=admin_headers, json={"mode": "production", "scenario": "portfolio_overview", "features": {}}, timeout=30)
    assert p.status_code == 200, f"switch to production failed: {p.text}"
    try:
        prod = requests.get(f"{API}/fleet-admin/assets", headers=mgr_headers, params={"limit": 1}, timeout=30).json()
        prod_total = prod.get("total") or (prod.get("pagination", {}) or {}).get("total")
        assert prod_total > before_total, f"production should return more assets: {prod_total} vs {before_total}"
        assert prod_total >= 4000
    finally:
        # Restore demo mode
        requests.patch(f"{API}/workspace", headers=admin_headers, json={"mode": "demo", "scenario": "portfolio_overview", "features": {}}, timeout=30)
