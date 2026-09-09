"""Live weather (WeatherAPI.com) — current + 7-day forecast + alerts, cached.

Every call is cached in Mongo (`weather_cache`) keyed by the resolved location
query (ZIP or "lat,lon"), so sites sharing the same ZIP code — or repeated
requests within the TTL window — reuse a single upstream call. This is the
one deliberate place we call an external API on a schedule, so failures must
degrade gracefully: never raise, always return a shaped dict the frontend can
render (live / cached / stale / unavailable).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from deps import db

log = logging.getLogger("assetnova")

WEATHER_API_KEY = os.environ.get("WEATHER_API_KEY")
WEATHER_BASE_URL = os.environ.get("WEATHER_BASE_URL", "https://api.weatherapi.com/v1")
CACHE_TTL_MINUTES = 20  # within the requested 15-30 min refresh window

# "Severe weather" thresholds for the Weather Risk filter + high-priority alerts
STORM_WIND_KPH = 40
STORM_RAIN_CHANCE_PCT = 70
HEAT_MAX_TEMP_C = 38
RISK_INDEX_TTL_MINUTES = 20
_risk_index_cache: Dict[str, Dict[str, Any]] = {}


def resolve_location_query(site: Optional[dict], asset: Optional[dict] = None) -> Optional[str]:
    """Priority: asset's own override > site's ZIP > site's lat/lon."""
    if asset:
        if asset.get("zip_code"):
            return str(asset["zip_code"]).strip()
        if asset.get("latitude") is not None and asset.get("longitude") is not None:
            return f"{asset['latitude']},{asset['longitude']}"
    if not site:
        return None
    if site.get("zip_code"):
        return str(site["zip_code"]).strip()
    if site.get("latitude") is not None and site.get("longitude") is not None:
        return f"{site['latitude']},{site['longitude']}"
    return None


def location_label(site: Optional[dict], asset: Optional[dict] = None) -> str:
    """"[Site Name] — [City], [State] [ZIP]" — falls back gracefully when fields are missing."""
    if not site:
        return "—"
    name = site.get("site_name") or site.get("site_id") or "Site"
    city = (asset or {}).get("city") or site.get("city")
    state = (asset or {}).get("state") or site.get("state")
    zip_code = (asset or {}).get("zip_code") or site.get("zip_code")
    parts = [p for p in (city, state) if p]
    tail = ", ".join(parts)
    if zip_code:
        tail = f"{tail} {zip_code}".strip()
    return f"{name} — {tail}" if tail else name


def _impact_level(current: Dict[str, Any], today_day: Dict[str, Any], alerts: List[dict]) -> str:
    if alerts:
        return "Severe Weather Risk"
    wind = current.get("wind_kph") or 0
    cloud = current.get("cloud") or 0
    rain_chance = today_day.get("daily_chance_of_rain") or 0
    if wind >= 50 or rain_chance >= 70:
        return "High Impact"
    if wind >= 30 or cloud >= 70 or rain_chance >= 40:
        return "Moderate Impact"
    return "Normal"


def _shape_payload(data: dict) -> dict:
    loc = data.get("location", {}) or {}
    cur = data.get("current", {}) or {}
    cur_cond = cur.get("condition") or {}
    forecast_days = ((data.get("forecast") or {}).get("forecastday")) or []
    today = forecast_days[0] if forecast_days else {}
    today_day = today.get("day", {}) or {}
    today_astro = today.get("astro", {}) or {}
    today_cond = today_day.get("condition") or {}
    alerts_raw = ((data.get("alerts") or {}).get("alert")) or []

    alerts = [
        {"headline": a.get("headline"), "severity": a.get("severity"), "event": a.get("event"), "desc": a.get("desc")}
        for a in alerts_raw
    ]

    return {
        "available": True,
        "provider": "WeatherAPI.com",
        "location": {
            "name": loc.get("name"), "region": loc.get("region"), "country": loc.get("country"),
            "lat": loc.get("lat"), "lon": loc.get("lon"), "localtime": loc.get("localtime"),
        },
        "current": {
            "temp_c": cur.get("temp_c"), "feelslike_c": cur.get("feelslike_c"),
            "condition": cur_cond.get("text"), "icon": cur_cond.get("icon"),
            "humidity": cur.get("humidity"), "wind_kph": cur.get("wind_kph"), "wind_dir": cur.get("wind_dir"),
            "cloud": cur.get("cloud"), "precip_mm": cur.get("precip_mm"),
        },
        "today": {
            "maxtemp_c": today_day.get("maxtemp_c"), "mintemp_c": today_day.get("mintemp_c"),
            "daily_chance_of_rain": today_day.get("daily_chance_of_rain"),
            "condition": today_cond.get("text"), "icon": today_cond.get("icon"),
            "sunrise": today_astro.get("sunrise"), "sunset": today_astro.get("sunset"),
        },
        "forecast": [
            {
                "date": d.get("date"),
                "maxtemp_c": (d.get("day") or {}).get("maxtemp_c"),
                "mintemp_c": (d.get("day") or {}).get("mintemp_c"),
                "condition": ((d.get("day") or {}).get("condition") or {}).get("text"),
                "icon": ((d.get("day") or {}).get("condition") or {}).get("icon"),
                "daily_chance_of_rain": (d.get("day") or {}).get("daily_chance_of_rain"),
                "avghumidity": (d.get("day") or {}).get("avghumidity"),
                "maxwind_kph": (d.get("day") or {}).get("maxwind_kph"),
            }
            for d in forecast_days
        ],
        "alerts": alerts,
        "impact_level": _impact_level(cur, today_day, alerts),
    }


async def get_weather(query: Optional[str]) -> dict:
    """Fetch (or reuse cached) weather for a ZIP or 'lat,lon' query string.
    Never raises — always returns a dict with `data_status` in
    {live, cached, stale, unavailable}."""
    if not query:
        return {"available": False, "data_status": "unavailable", "reason": "No ZIP code or coordinates on file for this location"}

    cache_key = f"wx:{query}"
    now = datetime.now(timezone.utc)
    cached = await db.weather_cache.find_one({"_id": cache_key})
    if cached:
        try:
            expires_at = datetime.fromisoformat(cached["expires_at"])
        except Exception:
            expires_at = now - timedelta(seconds=1)
        if expires_at > now:
            return {**cached["payload"], "data_status": "cached", "last_updated": cached["fetched_at"]}

    if not WEATHER_API_KEY:
        if cached:
            return {**cached["payload"], "data_status": "stale", "last_updated": cached["fetched_at"]}
        return {"available": False, "data_status": "unavailable", "reason": "Weather provider not configured"}

    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"{WEATHER_BASE_URL}/forecast.json",
                params={"key": WEATHER_API_KEY, "q": query, "days": 7, "alerts": "yes", "aqi": "no"},
            )
        data = resp.json()
    except Exception as e:  # noqa: BLE001 — network/timeout/parsing
        log.warning("Weather request failed for %s: %s", query, e)
        if cached:
            return {**cached["payload"], "data_status": "stale", "last_updated": cached["fetched_at"]}
        return {"available": False, "data_status": "unavailable", "reason": "Weather provider unreachable"}

    if resp.status_code >= 400 or "error" in data:
        err = data.get("error") or {}
        code = err.get("code")
        log.warning("Weather API error for %s: %s", query, err)
        if cached:
            return {**cached["payload"], "data_status": "stale", "last_updated": cached["fetched_at"]}
        if code == 1006:
            reason = "No matching location for this ZIP code"
        elif code in (2007, 2008, 2009):
            reason = "Weather provider rate limit reached — try again shortly"
        else:
            reason = "Weather provider temporarily unavailable"
        return {"available": False, "data_status": "unavailable", "reason": reason}

    payload = _shape_payload(data)
    fetched_at = now.isoformat()
    await db.weather_cache.replace_one(
        {"_id": cache_key},
        {"_id": cache_key, "payload": payload, "fetched_at": fetched_at,
         "expires_at": (now + timedelta(minutes=CACHE_TTL_MINUTES)).isoformat()},
        upsert=True,
    )
    return {**payload, "data_status": "live", "last_updated": fetched_at}


def _classify_forecast_risk(forecast: List[dict]) -> Dict[str, Any]:
    """Flags any day in the (up to 7-day) forecast that crosses the storm/heat
    severity thresholds. Used by the Weather Risk filter + high-priority alerts."""
    storm_days = [
        d["date"] for d in forecast
        if (d.get("maxwind_kph") or 0) > STORM_WIND_KPH or (d.get("daily_chance_of_rain") or 0) > STORM_RAIN_CHANCE_PCT
    ]
    heat_days = [d["date"] for d in forecast if (d.get("maxtemp_c") or 0) > HEAT_MAX_TEMP_C]
    return {"storm_risk": bool(storm_days), "heat_risk": bool(heat_days), "storm_days": storm_days, "heat_days": heat_days}


async def get_weather_risk_index(sites: List[dict]) -> Dict[str, Any]:
    """Storm/heat risk flags per site, across the full 7-day forecast — cached
    per distinct site-set (e.g. demo subset vs full portfolio) for 20min so
    repeated table renders / filter changes don't re-hit WeatherAPI."""
    site_ids = sorted(s["site_id"] for s in sites if s.get("site_id"))
    if not site_ids:
        return {"computed_at": datetime.now(timezone.utc).isoformat(), "sites": {}}

    cache_key = str(hash(tuple(site_ids)))
    now = datetime.now(timezone.utc)
    entry = _risk_index_cache.get(cache_key)
    if entry and (now - entry["computed_at"]) < timedelta(minutes=RISK_INDEX_TTL_MINUTES):
        return entry["data"]

    sem = asyncio.Semaphore(10)

    async def _one(site: dict):
        query = resolve_location_query(site)
        async with sem:
            payload = await get_weather(query)
        risk = _classify_forecast_risk(payload.get("forecast") or []) if payload.get("available") else {
            "storm_risk": False, "heat_risk": False, "storm_days": [], "heat_days": [],
        }
        return site["site_id"], risk

    results = await asyncio.gather(*[_one(s) for s in sites])
    data = {"computed_at": now.isoformat(), "sites": {sid: r for sid, r in results}}
    _risk_index_cache[cache_key] = {"computed_at": now, "data": data}
    return data
