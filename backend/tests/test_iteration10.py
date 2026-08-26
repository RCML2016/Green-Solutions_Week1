"""Iteration 10 — fleet dataset APIs (routers/fleet.py) + regression on legacy endpoints."""
import time

import pytest
import requests

from conftest import API

CATEGORIES = [
    ("Utility-Scale Solar", 80),
    ("Commercial Rooftop Solar", 60),
    ("Community Solar", 40),
    ("Battery Energy Storage", 35),
    ("Wind Farm", 30),
]


# ---------- health / seed ----------
class TestHealthAndSeed:
    def test_healthz_reports_seeded_sites(self):
        r = requests.get(f"{API}/healthz", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True
        assert d["fleet_sites"] == 380

    def test_root(self):
        r = requests.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        assert "message" in r.json()


# ---------- auth gate ----------
class TestFleetAuthRequired:
    @pytest.mark.parametrize("path", [
        "/fleet/categories", "/fleet/kpis", "/fleet/sites", "/fleet/sites/S00001",
        "/fleet/telemetry?site_id=S00001", "/fleet/alarms", "/fleet/work-orders",
        "/fleet/states", "/fleet/performance/trend?site_id=S00001",
    ])
    def test_requires_bearer(self, path):
        r = requests.get(f"{API}{path}", timeout=30)
        assert r.status_code == 401, f"{path} -> {r.status_code}"

    def test_bad_token_rejected(self):
        r = requests.get(f"{API}/fleet/kpis", headers={"Authorization": "Bearer garbage"}, timeout=30)
        assert r.status_code == 401


# ---------- categories ----------
class TestCategories:
    def test_eight_categories_with_real_counts(self, admin_headers):
        r = requests.get(f"{API}/fleet/categories", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        data = r.json()
        assert len(data) == 8
        assert [c["priority"] for c in data] == list(range(1, 9))
        by_cat = {c["category"]: c for c in data}
        for name, count in CATEGORIES:
            assert name in by_cat, f"missing category {name}"
            assert by_cat[name]["site_count"] == count, f"{name} site_count={by_cat[name]['site_count']}"
            assert by_cat[name]["asset_count"] > 0
            assert by_cat[name]["total_capacity_kW"] > 0
        assert sum(c["site_count"] for c in data) == 380
        assert sum(c["asset_count"] for c in data) == 5473


# ---------- KPIs ----------
class TestKpis:
    def test_fleet_kpis_all(self, admin_headers):
        r = requests.get(f"{API}/fleet/kpis", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["category"] == "All Categories"
        assert d["site_count"] == 380
        assert d["asset_count"] == 5473
        assert d["total_capacity_MW"] > 30
        assert 90 <= d["avg_performance_ratio_pct"] <= 99, d["avg_performance_ratio_pct"]
        assert 0 < d["avg_availability_pct"] <= 100
        assert d["alarms_total"] == 800
        assert d["work_orders_open"] > 0
        assert d["total_revenue_loss_usd"] > 0
        assert d["expected_kWh_day"] > 0 and d["actual_kWh_day"] > 0
        assert "server_time" in d

    def test_fleet_kpis_filtered(self, admin_headers):
        r = requests.get(f"{API}/fleet/kpis", params={"category": "Utility-Scale Solar"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["category"] == "Utility-Scale Solar"
        assert d["site_count"] == 80
        assert d["asset_count"] == 2126
        assert d["alarms_total"] < 800

    def test_unknown_category_returns_zeros_not_full_fleet(self, admin_headers):
        """Guard against the empty-site_ids fallthrough returning fleet-wide aggregates."""
        r = requests.get(f"{API}/fleet/kpis", params={"category": "NoSuchCategory"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["site_count"] == 0
        assert d["asset_count"] == 0, "asset_count leaked full fleet for unknown category"
        assert d["alarms_total"] == 0, "alarms_total leaked full fleet for unknown category"
        assert d["avg_performance_ratio_pct"] == 0, "PR leaked full-fleet average"


# ---------- sites ----------
class TestSites:
    def test_list_sites_limit_and_fields(self, admin_headers):
        r = requests.get(f"{API}/fleet/sites", params={"limit": 5}, headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 380
        assert len(d["items"]) == 5
        for s in d["items"]:
            for f in ["site_id", "site_name", "site_type", "state", "site_capacity_kW",
                      "latest_performance_ratio_pct", "open_alarms"]:
                assert f in s, f"missing {f}"
            assert "_id" not in s
            assert isinstance(s["open_alarms"], int)

    def test_pagination_and_category_filter(self, admin_headers):
        r1 = requests.get(f"{API}/fleet/sites", params={"limit": 3, "skip": 0}, headers=admin_headers, timeout=60)
        r2 = requests.get(f"{API}/fleet/sites", params={"limit": 3, "skip": 3}, headers=admin_headers, timeout=60)
        assert r1.status_code == r2.status_code == 200
        ids1 = [s["site_id"] for s in r1.json()["items"]]
        ids2 = [s["site_id"] for s in r2.json()["items"]]
        assert set(ids1).isdisjoint(ids2)

        rc = requests.get(f"{API}/fleet/sites", params={"category": "Wind Farm", "limit": 50},
                          headers=admin_headers, timeout=60)
        assert rc.status_code == 200
        dc = rc.json()
        assert dc["total"] == 30
        assert all(s["site_type"] == "Wind Farm" for s in dc["items"])

    def test_search_filter(self, admin_headers):
        r = requests.get(f"{API}/fleet/sites", params={"search": "S00001"}, headers=admin_headers, timeout=60)
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) >= 1
        assert any(s["site_id"] == "S00001" for s in items)

    def test_state_filter(self, admin_headers):
        states = requests.get(f"{API}/fleet/states", headers=admin_headers, timeout=60).json()
        top = states[0]["state"]
        r = requests.get(f"{API}/fleet/sites", params={"state": top, "limit": 500},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        assert r.json()["total"] == states[0]["site_count"]
        assert all(s["state"] == top for s in r.json()["items"])

    def test_site_detail(self, admin_headers):
        r = requests.get(f"{API}/fleet/sites/S00001", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        for k in ["site", "assets", "asset_breakdown", "latest_performance",
                  "latest_weather", "recent_alarms", "work_orders"]:
            assert k in d, f"missing {k}"
        assert d["site"]["site_id"] == "S00001"
        assert isinstance(d["assets"], list) and len(d["assets"]) > 0
        assert all(a["site_id"] == "S00001" for a in d["assets"])
        assert sum(b["count"] for b in d["asset_breakdown"]) == len(d["assets"])
        assert d["latest_performance"] and "performance_ratio_pct" in d["latest_performance"]
        assert d["latest_weather"] is not None

    def test_site_detail_404(self, admin_headers):
        r = requests.get(f"{API}/fleet/sites/DOES_NOT_EXIST", headers=admin_headers, timeout=60)
        assert r.status_code == 404


# ---------- telemetry ----------
class TestTelemetry:
    def test_telemetry_rows(self, admin_headers):
        r = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 6},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["live"] is True
        assert d["site_id"] == "S00001"
        assert len(d["rows"]) == 6
        for row in d["rows"]:
            assert "power_kW" in row and "expected_power_kW" in row and "timestamp" in row

    def test_telemetry_window_slides(self, admin_headers):
        """offset advances every 30s of wall-clock -> poll twice, 35s apart."""
        a = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 6},
                         headers=admin_headers, timeout=60).json()
        time.sleep(35)
        b = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 6},
                         headers=admin_headers, timeout=60).json()
        assert a["offset"] != b["offset"], f"offset stuck at {a['offset']}"

    def test_telemetry_unknown_site(self, admin_headers):
        r = requests.get(f"{API}/fleet/telemetry", params={"site_id": "NOPE"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        assert r.json()["rows"] == [] and r.json()["live"] is False

    def test_telemetry_hours_validation(self, admin_headers):
        assert requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 0},
                            headers=admin_headers, timeout=30).status_code == 422
        assert requests.get(f"{API}/fleet/telemetry", headers=admin_headers, timeout=30).status_code == 422


# ---------- alarms ----------
class TestAlarms:
    def test_alarms_default(self, admin_headers):
        r = requests.get(f"{API}/fleet/alarms", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 800
        assert len(d["items"]) == 100
        assert d["root_causes"] and all("root_cause" in rc and "count" in rc for rc in d["root_causes"])
        assert "_id" not in d["items"][0]

    def test_alarms_severity_filter(self, admin_headers):
        r = requests.get(f"{API}/fleet/alarms", params={"severity": "High"}, headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert 0 < d["total"] < 800
        assert all(i["severity"] == "High" for i in d["items"])
        assert sum(rc["count"] for rc in d["root_causes"]) == d["total"]

    def test_alarms_invalid_severity_422(self, admin_headers):
        r = requests.get(f"{API}/fleet/alarms", params={"severity": "INVALID"}, headers=admin_headers, timeout=30)
        assert r.status_code == 422

    def test_alarms_critical_severity_supported(self, admin_headers):
        """Dataset contains Critical alarms; API pattern must not reject them."""
        r = requests.get(f"{API}/fleet/alarms", params={"severity": "Critical"},
                         headers=admin_headers, timeout=30)
        assert r.status_code == 200, "severity=Critical rejected although dataset has Critical alarms"
        assert r.json()["total"] > 0

    def test_alarms_site_filter(self, admin_headers):
        r = requests.get(f"{API}/fleet/alarms", params={"site_id": "S00001"}, headers=admin_headers, timeout=60)
        assert r.status_code == 200
        assert all(i["site_id"] == "S00001" for i in r.json()["items"])


# ---------- work orders ----------
class TestWorkOrders:
    def test_work_orders(self, admin_headers):
        r = requests.get(f"{API}/fleet/work-orders", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["total"] == 141
        assert d["items"] and "_id" not in d["items"][0]
        statuses = {s["status"] for s in d["status_breakdown"]}
        assert {"Created", "Dispatched", "Resolved"}.issubset(statuses), statuses

    def test_work_orders_status_filter(self, admin_headers):
        r = requests.get(f"{API}/fleet/work-orders", params={"status": "Resolved"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert 0 < d["total"] < 141
        assert all(i["status"] == "Resolved" for i in d["items"])

    def test_work_orders_status_breakdown_ignores_filter(self, admin_headers):
        """status_breakdown is computed without $match — flag if it does not reflect the filter."""
        full = requests.get(f"{API}/fleet/work-orders", headers=admin_headers, timeout=60).json()
        filt = requests.get(f"{API}/fleet/work-orders", params={"status": "Resolved"},
                            headers=admin_headers, timeout=60).json()
        assert filt["status_breakdown"] != full["status_breakdown"], \
            "status_breakdown ignores the status/site filter (aggregation has no $match)"


# ---------- states / trend ----------
class TestStatesAndTrend:
    def test_states_sorted_desc(self, admin_headers):
        r = requests.get(f"{API}/fleet/states", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert len(d) > 1
        counts = [s["site_count"] for s in d]
        assert counts == sorted(counts, reverse=True)
        assert sum(counts) == 380
        assert all(s["state"] and s["capacity_kW"] >= 0 for s in d)

    def test_states_category_filter(self, admin_headers):
        r = requests.get(f"{API}/fleet/states", params={"category": "Wind Farm"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        assert sum(s["site_count"] for s in r.json()) == 30

    def test_performance_trend(self, admin_headers):
        r = requests.get(f"{API}/fleet/performance/trend", params={"site_id": "S00001", "days": 30},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["site_id"] == "S00001"
        assert isinstance(d["rows"], list) and len(d["rows"]) >= 1
        assert "performance_ratio_pct" in d["rows"][0]


# ---------- legacy regression ----------
class TestLegacyRegression:
    def test_portfolio_metrics(self, admin_headers):
        r = requests.get(f"{API}/portfolio/metrics", headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert len(d["findings"]) == 4
        assert "portfolio_health" in d

    def test_auth_me(self, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == "admin@greensolutions.ai"

    @pytest.mark.parametrize("path", ["/portfolios", "/alerts", "/snapshots", "/actions",
                                      "/team/users", "/reports/schedule", "/reports/branding"])
    def test_legacy_lists(self, admin_headers, path):
        r = requests.get(f"{API}{path}", headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
