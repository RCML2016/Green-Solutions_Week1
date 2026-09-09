"""Iteration 24 backend tests:
- Revenue masking for technician role (KPIs, sites, site_detail, work_orders)
- Other roles (admin/asset_manager) NOT masked
- Weather alerts endpoint
- Weather Risk filter on /fleet/sites and RISK column via show_weather_risk
"""
import os
import pytest
import requests

def _load_frontend_env_url():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env_url() or "").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "admin": ("admin@assetnova.com", "Admin@123"),
    "technician": ("tech@assetnova.com", "Tech@123"),
    "asset_manager": ("assetmgr@assetnova.com", "Asset@123"),
}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def tokens():
    return {role: _login(e, p) for role, (e, p) in CREDS.items()}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Revenue Masking ----------

def test_tech_kpis_masked(tokens):
    r = requests.get(f"{API}/fleet/kpis", headers=_h(tokens["technician"]), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # revenue field should be nulled for technician
    assert data.get("total_revenue_loss_usd") is None, data


def test_admin_kpis_not_masked(tokens):
    r = requests.get(f"{API}/fleet/kpis", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # non-tech should get a numeric value (0 or >0) -- not None
    assert data.get("total_revenue_loss_usd") is not None, data


def test_tech_sites_revenue_masked(tokens):
    r = requests.get(f"{API}/fleet/sites?limit=20", headers=_h(tokens["technician"]), timeout=30)
    assert r.status_code == 200, r.text
    js = r.json()
    sites = js.get("sites") or js.get("items") or []
    assert len(sites) > 0
    for s in sites[:10]:
        # accept either latest_revenue_loss_usd or revenue_loss keys
        for k in ("latest_revenue_loss_usd", "total_revenue_loss_usd", "revenue_loss_usd"):
            if k in s:
                assert s[k] is None, f"expected {k} nulled for tech, got {s[k]}"


def test_admin_sites_revenue_present(tokens):
    r = requests.get(f"{API}/fleet/sites?limit=20", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text
    js = r.json()
    sites = js.get("sites") or js.get("items") or []
    assert len(sites) > 0
    # at least one site should have a numeric revenue field
    found = any(
        (s.get("latest_revenue_loss_usd") is not None) or (s.get("total_revenue_loss_usd") is not None)
        for s in sites
    )
    assert found, "admin should see numeric revenue loss on at least one site"


def test_tech_work_orders_parts_cost_masked(tokens):
    r = requests.get(f"{API}/fleet/work-orders?limit=25", headers=_h(tokens["technician"]), timeout=30)
    assert r.status_code == 200, r.text
    js = r.json()
    items = js.get("items") or js.get("work_orders") or js
    if isinstance(items, dict):
        items = items.get("items", [])
    assert isinstance(items, list) and len(items) > 0
    for w in items[:15]:
        if "parts_cost_usd" in w:
            assert w["parts_cost_usd"] is None, f"parts_cost should be null for tech, got {w['parts_cost_usd']}"


def test_admin_work_orders_parts_cost_present(tokens):
    r = requests.get(f"{API}/fleet/work-orders?limit=50", headers=_h(tokens["admin"]), timeout=30)
    assert r.status_code == 200, r.text
    js = r.json()
    items = js.get("items") or js.get("work_orders") or []
    if isinstance(items, dict):
        items = items.get("items", [])
    assert len(items) > 0
    # at least some WO should have non-null parts_cost
    has_cost = any((w.get("parts_cost_usd") is not None) for w in items)
    assert has_cost, "admin should see at least one non-null parts_cost_usd"


def test_tech_site_detail_masked(tokens):
    # pick a site id
    r = requests.get(f"{API}/fleet/sites?limit=1", headers=_h(tokens["admin"]), timeout=30)
    sites = r.json().get("sites") or r.json().get("items") or []
    assert sites, "no sites available"
    sid = sites[0]["site_id"]
    r2 = requests.get(f"{API}/fleet/sites/{sid}", headers=_h(tokens["technician"]), timeout=30)
    assert r2.status_code == 200, r2.text
    detail = r2.json()
    # top-level revenue loss key(s) should be null-ish for tech
    for k in ("total_revenue_loss_usd", "latest_revenue_loss_usd", "revenue_loss_usd"):
        if k in detail:
            assert detail[k] is None, f"{k} should be null for tech"
    # work-order line items parts_cost also masked
    wos = detail.get("work_orders") or []
    for w in wos[:10]:
        if "parts_cost_usd" in w:
            assert w["parts_cost_usd"] is None


# ---------- Weather Alerts ----------

def test_weather_alerts_endpoint_admin(tokens):
    r = requests.get(f"{API}/fleet/weather/alerts", headers=_h(tokens["admin"]), timeout=60)
    assert r.status_code == 200, r.text
    js = r.json()
    assert "alerts" in js
    assert isinstance(js["alerts"], list)
    for a in js["alerts"]:
        assert "site_id" in a and "risk_label" in a
        assert a["risk_label"] in ("Storm Risk", "Heat Risk", "Storm & Heat Risk")


# ---------- Weather Risk filter on /fleet/sites ----------

def test_sites_show_weather_risk_annotation(tokens):
    r = requests.get(
        f"{API}/fleet/sites?limit=10&show_weather_risk=true",
        headers=_h(tokens["admin"]),
        timeout=90,
    )
    assert r.status_code == 200, r.text
    js = r.json()
    sites = js.get("sites") or js.get("items") or []
    assert sites, "expected some sites"
    # every returned site should have weather_risk field present (may be 'Clear' or a risk label)
    for s in sites:
        assert "weather_risk" in s, f"missing weather_risk on {s.get('site_id')}"


def test_sites_weather_risk_filter_storm(tokens):
    r = requests.get(
        f"{API}/fleet/sites?limit=200&weather_risk=storm",
        headers=_h(tokens["admin"]),
        timeout=90,
    )
    assert r.status_code == 200, r.text
    js = r.json()
    sites = js.get("sites") or js.get("items") or []
    for s in sites:
        assert s.get("weather_risk") in ("Storm Risk", "Storm & Heat Risk"), s


def test_sites_no_weather_params_skips_weather(tokens):
    # baseline endpoint without weather params should be reasonably quick and NOT contain weather_risk
    import time
    t0 = time.time()
    r = requests.get(f"{API}/fleet/sites?limit=500", headers=_h(tokens["admin"]), timeout=60)
    dt = time.time() - t0
    assert r.status_code == 200
    js = r.json()
    sites = js.get("sites") or js.get("items") or []
    assert sites
    # weather_risk should be absent OR None
    for s in sites[:5]:
        assert s.get("weather_risk") in (None, "", "-") or "weather_risk" not in s, (
            f"unexpected weather_risk populated on default sites list: {s.get('weather_risk')}"
        )
    print(f"/fleet/sites?limit=500 took {dt:.2f}s")
    assert dt < 20, "/fleet/sites should be fast without weather params"
