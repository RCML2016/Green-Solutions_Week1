"""Iteration 11 — verification of the 6 backend fixes reported in iteration_10.json.

FIX #1 telemetry aggregation, FIX #2 kpis empty-scope guard, FIX #3 Critical severity,
FIX #4 work-orders status_breakdown $match, FIX #5 alarms category, FIX #6 work-orders category.
"""
import time

import pytest
import requests

from conftest import API


# ---------- FIX #1: telemetry aggregated per timestamp ----------
class TestTelemetryAggregation:
    def test_telemetry_24h_returns_24_rows_with_real_curve(self, admin_headers):
        r = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 24},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        rows = d["rows"]
        assert len(rows) == 24, f"expected 24 aggregated hourly rows, got {len(rows)}"
        # timestamps must be unique & sorted ascending
        ts = [row["timestamp"] for row in rows]
        assert len(set(ts)) == 24, "duplicate timestamps -> not aggregated per timestamp"
        assert ts == sorted(ts), "rows not sorted by timestamp"
        peak = max(row["power_kW"] for row in rows)
        assert peak > 0, "all power_kW are zero — flat chart bug not fixed"
        # solar diurnal curve: some hours zero (night), peak substantially > 1 kW
        assert peak > 100, f"peak power suspiciously low ({peak} kW) for a utility-scale site"
        assert min(row["power_kW"] for row in rows) == 0, "expected night hours at 0 kW"
        assert max(row["expected_power_kW"] for row in rows) > 0

    def test_telemetry_partial_window_still_aggregated(self, admin_headers):
        r = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 6},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert len(d["rows"]) == 6
        assert len({row["timestamp"] for row in d["rows"]}) == 6

    def test_telemetry_window_slides(self, admin_headers):
        a = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 6},
                         headers=admin_headers, timeout=60).json()
        time.sleep(35)
        b = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00001", "hours": 6},
                         headers=admin_headers, timeout=60).json()
        assert a["offset"] != b["offset"], f"offset stuck at {a['offset']}"
        assert a["rows"] != b["rows"], "window did not move"

    def test_telemetry_other_site(self, admin_headers):
        r = requests.get(f"{API}/fleet/telemetry", params={"site_id": "S00002", "hours": 24},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        rows = r.json()["rows"]
        assert len(rows) >= 1
        assert max(row["power_kW"] for row in rows) > 0


# ---------- FIX #2: kpis empty scope ----------
class TestKpisEmptyScope:
    def test_unknown_category_all_zeros(self, admin_headers):
        r = requests.get(f"{API}/fleet/kpis", params={"category": "DoesNotExist"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["category"] == "DoesNotExist"
        for k in ["site_count", "asset_count", "active_assets", "total_capacity_kW",
                  "total_capacity_MW", "avg_performance_ratio_pct", "avg_availability_pct",
                  "total_lost_kWh", "total_revenue_loss_usd", "expected_kWh_day",
                  "actual_kWh_day", "alarms_total", "alarms_high", "alarms_open",
                  "work_orders_open"]:
            assert d[k] == 0, f"{k}={d[k]} leaked fleet-wide data for unknown category"

    def test_known_category_still_scoped(self, admin_headers):
        r = requests.get(f"{API}/fleet/kpis", params={"category": "Wind Farm"},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200
        d = r.json()
        assert d["site_count"] == 30
        assert d["asset_count"] > 0
        assert 0 < d["alarms_total"] < 800

    def test_no_category_full_fleet(self, admin_headers):
        d = requests.get(f"{API}/fleet/kpis", headers=admin_headers, timeout=60).json()
        assert d["site_count"] == 380 and d["asset_count"] == 5473 and d["alarms_total"] == 800


# ---------- FIX #3: alarms severity Critical ----------
class TestAlarmSeverities:
    @pytest.mark.parametrize("sev", ["Low", "Medium", "High", "Critical"])
    def test_valid_severities_accepted(self, sev, admin_headers):
        r = requests.get(f"{API}/fleet/alarms", params={"severity": sev, "limit": 500},
                         headers=admin_headers, timeout=60)
        assert r.status_code == 200, f"{sev} -> {r.status_code}"
        d = r.json()
        assert d["total"] > 0, f"no alarms for severity {sev}"
        assert all(i["severity"] == sev for i in d["items"])
        assert sum(rc["count"] for rc in d["root_causes"]) == d["total"]

    def test_critical_count_is_38(self, admin_headers):
        d = requests.get(f"{API}/fleet/alarms", params={"severity": "Critical", "limit": 500},
                         headers=admin_headers, timeout=60).json()
        assert d["total"] == 38, f"expected 38 Critical alarms, got {d['total']}"
        assert len(d["items"]) == 38

    @pytest.mark.parametrize("sev", ["INVALID", "critical", "Sev1", ""])
    def test_invalid_severity_422(self, sev, admin_headers):
        r = requests.get(f"{API}/fleet/alarms", params={"severity": sev},
                         headers=admin_headers, timeout=30)
        assert r.status_code == 422, f"{sev!r} -> {r.status_code}"

    def test_severity_totals_sum_to_800(self, admin_headers):
        total = 0
        for sev in ["Low", "Medium", "High", "Critical"]:
            total += requests.get(f"{API}/fleet/alarms", params={"severity": sev},
                                  headers=admin_headers, timeout=60).json()["total"]
        assert total == 800, f"severity buckets sum to {total}, expected 800"


# ---------- FIX #5: alarms category filter ----------
class TestAlarmsCategoryFilter:
    def test_wind_farm_alarms_scoped(self, admin_headers):
        wind_sites = requests.get(f"{API}/fleet/sites", params={"category": "Wind Farm", "limit": 500},
                                  headers=admin_headers, timeout=60).json()["items"]
        wind_ids = {s["site_id"] for s in wind_sites}
        d = requests.get(f"{API}/fleet/alarms", params={"category": "Wind Farm", "limit": 500},
                         headers=admin_headers, timeout=60).json()
        assert d["total"] == 232, f"expected 232 Wind Farm alarms, got {d['total']}"
        assert all(i["site_id"] in wind_ids for i in d["items"]), "non-Wind-Farm site leaked"
        assert sum(rc["count"] for rc in d["root_causes"]) == d["total"]

    def test_unknown_category_zero(self, admin_headers):
        d = requests.get(f"{API}/fleet/alarms", params={"category": "DoesNotExist"},
                         headers=admin_headers, timeout=60).json()
        assert d["total"] == 0 and d["items"] == [] and d["root_causes"] == []

    def test_category_and_severity_combined(self, admin_headers):
        d = requests.get(f"{API}/fleet/alarms",
                         params={"category": "Wind Farm", "severity": "Critical", "limit": 500},
                         headers=admin_headers, timeout=60).json()
        assert d["total"] <= 38
        assert all(i["severity"] == "Critical" for i in d["items"])


# ---------- FIX #4 + #6: work orders ----------
class TestWorkOrders:
    def test_status_breakdown_respects_filter(self, admin_headers):
        d = requests.get(f"{API}/fleet/work-orders", params={"status": "Resolved", "limit": 500},
                         headers=admin_headers, timeout=60).json()
        assert d["total"] > 0
        assert [b["status"] for b in d["status_breakdown"]] == ["Resolved"], d["status_breakdown"]
        assert d["status_breakdown"][0]["count"] == d["total"]
        assert all(i["status"] == "Resolved" for i in d["items"])

    def test_unfiltered_breakdown_sums_to_total(self, admin_headers):
        d = requests.get(f"{API}/fleet/work-orders", headers=admin_headers, timeout=60).json()
        assert sum(b["count"] for b in d["status_breakdown"]) == d["total"]

    def test_category_filter(self, admin_headers):
        wind_ids = {s["site_id"] for s in requests.get(
            f"{API}/fleet/sites", params={"category": "Wind Farm", "limit": 500},
            headers=admin_headers, timeout=60).json()["items"]}
        d = requests.get(f"{API}/fleet/work-orders", params={"category": "Wind Farm", "limit": 500},
                         headers=admin_headers, timeout=60).json()
        assert 0 < d["total"] < 141
        assert all(i["site_id"] in wind_ids for i in d["items"]), "non-Wind-Farm WO leaked"
        assert sum(b["count"] for b in d["status_breakdown"]) == d["total"]

    def test_unknown_category_zero(self, admin_headers):
        d = requests.get(f"{API}/fleet/work-orders", params={"category": "DoesNotExist"},
                         headers=admin_headers, timeout=60).json()
        assert d["total"] == 0 and d["items"] == [] and d["status_breakdown"] == []


# ---------- auth / security regression (playbook) ----------
class TestAuthRegression:
    def test_login_and_me(self, admin_creds, admin_headers):
        r = requests.get(f"{API}/auth/me", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.json()["email"] == admin_creds["email"]

    def test_bcrypt_hash_format(self):
        from dotenv import dotenv_values
        from pymongo import MongoClient
        be = dotenv_values("/app/backend/.env")
        cl = MongoClient(be["MONGO_URL"])
        u = cl[be["DB_NAME"]].users.find_one({"email": "admin@greensolutions.ai"})
        cl.close()
        assert u is not None, "seeded admin missing"
        h = u.get("password_hash") or u.get("hashed_password") or ""
        assert h.startswith("$2b$"), f"unexpected hash prefix: {h[:4]}"

    def test_fleet_endpoints_require_auth(self):
        for p in ["/fleet/alarms?category=Wind%20Farm", "/fleet/work-orders?category=Wind%20Farm",
                  "/fleet/kpis?category=Wind%20Farm"]:
            assert requests.get(f"{API}{p}", timeout=30).status_code == 401, p
