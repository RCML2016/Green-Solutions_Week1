"""Fleet routes — powered by the seeded renewable-energy dataset.

Data model (Mongo collections seeded by seed_dataset.py):
  - fleet_sites          (380 sites across 5 categories)
  - fleet_assets         (5473 assets: inverters, combiners, trackers, ...)
  - fleet_telemetry      (60k hourly readings)
  - fleet_weather        (9k hourly readings per site)
  - fleet_performance    (daily PR% + availability + revenue loss)
  - fleet_alarms         (800 alarms w/ severity + root-cause)
  - fleet_work_orders    (142 WOs)

Live-refresh simulation: telemetry is a static snapshot spanning 24h from an
arbitrary anchor. We compute a "virtual now" that slides through the window
using wall-clock modulo, so every poll returns a fresh slice — a demo-friendly
substitute for real streaming.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, Query

from deps import db, get_current_user

router = APIRouter(prefix="/fleet", tags=["fleet"])


# --------- Category / priority summary ---------
PRIORITY_SUMMARY = [
    {"priority": 1, "category": "Utility-Scale Solar",                 "focus": "Primary MVP",             "tier": "core"},
    {"priority": 2, "category": "Commercial Rooftop Solar",            "focus": "High-volume distributed", "tier": "core"},
    {"priority": 3, "category": "Community Solar",                     "focus": "Portfolio model",         "tier": "core"},
    {"priority": 4, "category": "Battery Energy Storage",              "focus": "Storage vertical",        "tier": "summary"},
    {"priority": 5, "category": "Wind Farm",                           "focus": "Wind vertical",           "tier": "summary"},
    {"priority": 6, "category": "Residential / C&I Distributed Solar", "focus": "Distributed rooftop",     "tier": "summary"},
    {"priority": 7, "category": "Small Hydro",                         "focus": "Hydro vertical",          "tier": "summary"},
    {"priority": 8, "category": "Small Distributed Wind",              "focus": "Micro-wind",              "tier": "summary"},
]

CATEGORY_ORDER = [c["category"] for c in PRIORITY_SUMMARY]


@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    """Return per-category headline stats — site count, total capacity, priority tier."""
    pipeline = [
        {"$group": {
            "_id": "$site_type",
            "site_count": {"$sum": 1},
            "total_capacity_kW": {"$sum": "$site_capacity_kW"},
        }},
    ]
    stats = {doc["_id"]: doc async for doc in db.fleet_sites.aggregate(pipeline)}

    # asset counts per category
    asset_pipeline = [
        {"$lookup": {
            "from": "fleet_sites", "localField": "site_id",
            "foreignField": "site_id", "as": "site"
        }},
        {"$unwind": "$site"},
        {"$group": {"_id": "$site.site_type", "assets": {"$sum": 1}}},
    ]
    asset_counts = {doc["_id"]: doc["assets"] async for doc in db.fleet_assets.aggregate(asset_pipeline)}

    out: List[Dict[str, Any]] = []
    for entry in PRIORITY_SUMMARY:
        cat = entry["category"]
        s = stats.get(cat, {})
        out.append({
            **entry,
            "site_count": s.get("site_count", 0),
            "total_capacity_kW": round(s.get("total_capacity_kW", 0) or 0, 1),
            "asset_count": asset_counts.get(cat, 0),
        })
    return out


# --------- KPIs ---------
@router.get("/kpis")
async def fleet_kpis(
    category: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Fleet-level KPIs computed from performance + alarms + sites."""
    site_match: Dict[str, Any] = {}
    if category:
        site_match["site_type"] = category

    # Sites in scope
    sites_cursor = db.fleet_sites.find(site_match, {"_id": 0, "site_id": 1, "site_capacity_kW": 1})
    sites = await sites_cursor.to_list(2000)
    site_ids = [s["site_id"] for s in sites]
    total_capacity = sum((s.get("site_capacity_kW") or 0) for s in sites)

    # Short-circuit: category was requested but matched zero sites — return empty aggregates.
    if category and not site_ids:
        return {
            "category": category,
            "site_count": 0, "asset_count": 0, "active_assets": 0,
            "total_capacity_kW": 0, "total_capacity_MW": 0,
            "avg_performance_ratio_pct": 0, "avg_availability_pct": 0, "avg_degradation_pct": 0,
            "total_lost_kWh": 0, "total_revenue_loss_usd": 0,
            "expected_kWh_day": 0, "actual_kWh_day": 0,
            "alarms_total": 0, "alarms_high": 0, "alarms_open": 0,
            "work_orders_open": 0,
            "server_time": datetime.now(timezone.utc).isoformat(),
        }

    id_filter = {"$in": site_ids} if site_ids else None

    # Performance aggregates
    perf_match: Dict[str, Any] = {"site_id": id_filter} if id_filter else {}
    perf_pipeline = [
        {"$match": perf_match},
        {"$group": {
            "_id": None,
            "avg_pr": {"$avg": "$performance_ratio_pct"},
            "avg_availability": {"$avg": "$availability_pct"},
            "avg_degradation": {"$avg": "$degradation_pct"},
            "total_lost_kWh": {"$sum": "$lost_kWh"},
            "total_revenue_loss": {"$sum": "$estimated_revenue_loss_usd"},
            "total_expected_kWh": {"$sum": "$expected_kWh"},
            "total_actual_kWh": {"$sum": "$actual_kWh"},
        }},
    ]
    perf_doc = None
    async for d in db.fleet_performance.aggregate(perf_pipeline):
        perf_doc = d
    perf = perf_doc or {}

    # Alarms count
    alarm_match: Dict[str, Any] = {"site_id": id_filter} if id_filter else {}
    total_alarms = await db.fleet_alarms.count_documents(alarm_match)
    high_sev = await db.fleet_alarms.count_documents({**alarm_match, "severity": {"$in": ["High", "Critical"]}})
    open_alarms = await db.fleet_alarms.count_documents({**alarm_match, "status": {"$ne": "Resolved"}})

    # Work orders
    wo_match: Dict[str, Any] = {"site_id": id_filter} if id_filter else {}
    open_wos = await db.fleet_work_orders.count_documents({**wo_match, "status": {"$ne": "Resolved"}})

    # Assets count
    asset_match: Dict[str, Any] = {"site_id": id_filter} if id_filter else {}
    total_assets = await db.fleet_assets.count_documents(asset_match)
    active_assets = await db.fleet_assets.count_documents({**asset_match, "status": "Active"})

    return {
        "category": category or "All Categories",
        "site_count": len(site_ids),
        "asset_count": total_assets,
        "active_assets": active_assets,
        "total_capacity_kW": round(total_capacity, 1),
        "total_capacity_MW": round(total_capacity / 1000, 2),
        "avg_performance_ratio_pct": round(perf.get("avg_pr") or 0, 2),
        "avg_availability_pct": round(perf.get("avg_availability") or 0, 2),
        "avg_degradation_pct": round(perf.get("avg_degradation") or 0, 2),
        "total_lost_kWh": round(perf.get("total_lost_kWh") or 0, 1),
        "total_revenue_loss_usd": round(perf.get("total_revenue_loss") or 0, 2),
        "expected_kWh_day": round(perf.get("total_expected_kWh") or 0, 1),
        "actual_kWh_day": round(perf.get("total_actual_kWh") or 0, 1),
        "alarms_total": total_alarms,
        "alarms_high": high_sev,
        "alarms_open": open_alarms,
        "work_orders_open": open_wos,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


# --------- Sites ---------
@router.get("/sites")
async def list_sites(
    category: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=500),
    skip: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if category:
        q["site_type"] = category
    if state:
        q["state"] = state
    if search:
        q["$or"] = [
            {"site_id": {"$regex": search, "$options": "i"}},
            {"site_name": {"$regex": search, "$options": "i"}},
        ]

    total = await db.fleet_sites.count_documents(q)
    cursor = db.fleet_sites.find(q, {"_id": 0}).sort("site_id", 1).skip(skip).limit(limit)
    sites = await cursor.to_list(limit)

    # Attach latest performance snapshot for each site (single aggregation)
    ids = [s["site_id"] for s in sites]
    perf_by_site: Dict[str, dict] = {}
    if ids:
        async for p in db.fleet_performance.find(
            {"site_id": {"$in": ids}},
            {"_id": 0},
        ).sort("date", -1):
            if p["site_id"] not in perf_by_site:
                perf_by_site[p["site_id"]] = p

    # Attach open alarm counts
    alarm_pipeline = [
        {"$match": {"site_id": {"$in": ids}, "status": {"$ne": "Resolved"}}},
        {"$group": {"_id": "$site_id", "open_alarms": {"$sum": 1},
                    "high_sev": {"$sum": {"$cond": [{"$eq": ["$severity", "High"]}, 1, 0]}}}},
    ]
    alarms_by_site = {}
    async for a in db.fleet_alarms.aggregate(alarm_pipeline):
        alarms_by_site[a["_id"]] = a

    enriched = []
    for s in sites:
        p = perf_by_site.get(s["site_id"], {})
        a = alarms_by_site.get(s["site_id"], {})
        enriched.append({
            **s,
            "latest_performance_ratio_pct": p.get("performance_ratio_pct"),
            "latest_availability_pct": p.get("availability_pct"),
            "latest_revenue_loss_usd": p.get("estimated_revenue_loss_usd"),
            "open_alarms": a.get("open_alarms", 0),
            "high_sev_alarms": a.get("high_sev", 0),
        })
    return {"total": total, "items": enriched}


@router.get("/sites/{site_id}")
async def site_detail(site_id: str, user: dict = Depends(get_current_user)):
    site = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    # Assets
    assets = await db.fleet_assets.find(
        {"site_id": site_id}, {"_id": 0}
    ).sort("asset_id", 1).limit(500).to_list(500)

    # Latest performance
    latest_perf = await db.fleet_performance.find_one(
        {"site_id": site_id}, {"_id": 0}, sort=[("date", -1)]
    )

    # Recent alarms (top 25)
    alarms = await db.fleet_alarms.find(
        {"site_id": site_id}, {"_id": 0}
    ).sort("timestamp", -1).limit(25).to_list(25)

    # Related work orders (top 25)
    wos = await db.fleet_work_orders.find(
        {"site_id": site_id}, {"_id": 0}
    ).sort("work_order_id", -1).limit(25).to_list(25)

    # Latest weather
    latest_weather = await db.fleet_weather.find_one(
        {"site_id": site_id}, {"_id": 0}, sort=[("timestamp", -1)]
    )

    # Asset breakdown by type
    breakdown: Dict[str, int] = {}
    for a in assets:
        t = a.get("asset_type", "Other")
        breakdown[t] = breakdown.get(t, 0) + 1

    return {
        "site": site,
        "assets": assets,
        "asset_breakdown": [{"type": k, "count": v} for k, v in breakdown.items()],
        "latest_performance": latest_perf,
        "latest_weather": latest_weather,
        "recent_alarms": alarms,
        "work_orders": wos,
    }


# --------- Telemetry: simulated live window ---------
@router.get("/telemetry")
async def site_telemetry(
    site_id: str,
    hours: int = Query(default=24, ge=1, le=168),
    user: dict = Depends(get_current_user),
):
    """Return the last `hours` of telemetry for a site — sliding-window simulation
    of "live" streaming. The dataset spans a fixed range; we shift the window
    across it based on wall-clock so repeated polls return fresh rows.

    Per-asset rows are aggregated to a single timeseries by summing power_kW /
    expected_power_kW across all assets at each timestamp."""
    pipeline = [
        {"$match": {"site_id": site_id}},
        {"$group": {
            "_id": "$timestamp",
            "power_kW": {"$sum": "$power_kW"},
            "expected_power_kW": {"$sum": "$expected_power_kW"},
            "avg_temperature_C": {"$avg": "$temperature_C"},
            "avg_efficiency_pct": {"$avg": "$efficiency_pct"},
        }},
        {"$sort": {"_id": 1}},
    ]
    all_rows = [
        {
            "timestamp": d["_id"],
            "power_kW": round(d["power_kW"] or 0, 2),
            "expected_power_kW": round(d["expected_power_kW"] or 0, 2),
            "temperature_C": round(d["avg_temperature_C"] or 0, 2),
            "efficiency_pct": round(d["avg_efficiency_pct"] or 0, 2),
        }
        async for d in db.fleet_telemetry.aggregate(pipeline)
    ]

    if not all_rows:
        return {"site_id": site_id, "rows": [], "window_hours": hours, "live": False,
                "server_time": datetime.now(timezone.utc).isoformat()}

    total = len(all_rows)
    window = min(hours, total)
    # Slide by 1 hour of data every 30s of wall-clock
    offset = int(time.time() // 30) % max(1, total - window + 1)
    slice_rows = all_rows[offset:offset + window]
    return {
        "site_id": site_id,
        "rows": slice_rows,
        "window_hours": window,
        "offset": offset,
        "live": True,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


# --------- Alarms ---------
@router.get("/alarms")
async def list_alarms(
    severity: Optional[str] = Query(default=None, pattern="^(Low|Medium|High|Critical)$"),
    status: Optional[str] = None,
    root_cause: Optional[str] = None,
    site_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if severity: q["severity"] = severity
    if status: q["status"] = status
    if root_cause: q["root_cause_category"] = root_cause
    if site_id: q["site_id"] = site_id
    if category:
        cat_sites = await db.fleet_sites.find(
            {"site_type": category}, {"_id": 0, "site_id": 1}
        ).to_list(2000)
        site_ids = [s["site_id"] for s in cat_sites]
        if not site_ids:
            return {"total": 0, "items": [], "root_causes": []}
        q["site_id"] = {"$in": site_ids}
    total = await db.fleet_alarms.count_documents(q)
    items = await db.fleet_alarms.find(q, {"_id": 0}).sort("timestamp", -1).limit(limit).to_list(limit)

    # Root-cause breakdown (respects same filter)
    rc_pipeline = [
        {"$match": q},
        {"$group": {"_id": "$root_cause_category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    root_causes = [{"root_cause": d["_id"], "count": d["count"]} async for d in db.fleet_alarms.aggregate(rc_pipeline)]

    return {"total": total, "items": items, "root_causes": root_causes}


# --------- Work Orders ---------
@router.get("/work-orders")
async def list_work_orders(
    status: Optional[str] = None,
    site_id: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=500),
    user: dict = Depends(get_current_user),
):
    q: Dict[str, Any] = {}
    if status: q["status"] = status
    if site_id: q["site_id"] = site_id
    if category:
        cat_sites = await db.fleet_sites.find(
            {"site_type": category}, {"_id": 0, "site_id": 1}
        ).to_list(2000)
        site_ids = [s["site_id"] for s in cat_sites]
        if not site_ids:
            return {"total": 0, "items": [], "status_breakdown": []}
        q["site_id"] = {"$in": site_ids}
    total = await db.fleet_work_orders.count_documents(q)
    items = await db.fleet_work_orders.find(q, {"_id": 0}).sort("work_order_id", -1).limit(limit).to_list(limit)

    # Status breakdown (respects filter)
    status_pipeline = [
        {"$match": q},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    status_breakdown = [{"status": d["_id"], "count": d["count"]} async for d in db.fleet_work_orders.aggregate(status_pipeline)]

    return {"total": total, "items": items, "status_breakdown": status_breakdown}


# --------- Performance trend for a site ---------
@router.get("/performance/trend")
async def performance_trend(
    site_id: str,
    days: int = Query(default=30, ge=1, le=180),
    user: dict = Depends(get_current_user),
):
    """Return performance rows for a site (dataset has one row per site;
    we duplicate to give a demo trend if truly single-day)."""
    rows = await db.fleet_performance.find(
        {"site_id": site_id}, {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    return {"site_id": site_id, "rows": list(reversed(rows))}


# --------- State breakdown (for map/charts) ---------
@router.get("/states")
async def states_breakdown(
    category: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    match: Dict[str, Any] = {}
    if category:
        match["site_type"] = category
    pipeline = [
        {"$match": match},
        {"$group": {
            "_id": "$state",
            "site_count": {"$sum": 1},
            "capacity_kW": {"$sum": "$site_capacity_kW"},
        }},
        {"$sort": {"site_count": -1}},
    ]
    return [
        {"state": d["_id"], "site_count": d["site_count"], "capacity_kW": round(d["capacity_kW"] or 0, 1)}
        async for d in db.fleet_sites.aggregate(pipeline)
    ]
