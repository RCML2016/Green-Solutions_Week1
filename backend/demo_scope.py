"""Demo/Pilot asset display limit.

When the workspace is in DEMO or PILOT mode (and the requester is not an
admin), every read path is capped to a small, stable, representative slice
of the fleet: up to DEMO_ASSET_LIMIT_PER_CATEGORY sites per site category,
and — within each of those sites — up to DEMO_ASSET_LIMIT_PER_CATEGORY
assets per asset type.

Selection is deterministic (not random) so the same sites/assets keep
appearing across the whole session: featured_for_demo=true first, then the
"most complete" record, then a stable ID sort as the final tiebreaker.

Nothing here ever deletes/hides data in Mongo — it only narrows what read
endpoints return. Writes (create/update/retire) are never limited.
"""
from __future__ import annotations

import os
from typing import Dict, List, Optional, Set, Tuple

from deps import db
from workspace import get_workspace_config

DEMO_ASSET_LIMIT_PER_CATEGORY = int(os.environ.get("DEMO_ASSET_LIMIT_PER_CATEGORY", "5"))
DEMO_MODE_ENABLED = os.environ.get("DEMO_MODE", "true").strip().lower() != "false"

_cache: dict = {"site_ids": None, "asset_ids": None}


def bump_demo_cache() -> None:
    """Invalidate the cached selection — call after any write that could
    change which sites/assets are the "top" ones (create/retire/import/
    featured-toggle/demo-reset)."""
    _cache["site_ids"] = None
    _cache["asset_ids"] = None


async def is_demo_scope_active(user: Optional[dict]) -> bool:
    if not DEMO_MODE_ENABLED:
        return False
    if user and user.get("role") == "admin":
        return False
    config = await get_workspace_config()
    return config.get("mode") in ("demo", "pilot")


def _site_score(s: dict) -> Tuple[int, int, str]:
    featured = 0 if s.get("featured_for_demo") else 1
    completeness = sum(
        1 for k in ("latitude", "longitude", "cod_date", "owner_client", "site_capacity_kW")
        if s.get(k) not in (None, "")
    )
    return (featured, -completeness, s.get("site_id") or "")


def _asset_score(a: dict) -> Tuple[int, int, str]:
    featured = 0 if a.get("featured_for_demo") else 1
    completeness = sum(
        1 for k in ("make", "model", "serial_number", "nameplate_kW", "install_date")
        if a.get(k) not in (None, "")
    )
    return (featured, -completeness, a.get("asset_id") or "")


async def get_demo_site_ids_by_category() -> Dict[str, List[str]]:
    """site_type -> up to DEMO_ASSET_LIMIT_PER_CATEGORY representative active site_ids."""
    if _cache["site_ids"] is not None:
        return _cache["site_ids"]
    sites = await db.fleet_sites.find(
        {"lifecycle_status": {"$ne": "retired"}}, {"_id": 0}
    ).to_list(5000)
    by_cat: Dict[str, List[dict]] = {}
    for s in sites:
        by_cat.setdefault(s.get("site_type") or "Other", []).append(s)
    result: Dict[str, List[str]] = {}
    for cat, rows in by_cat.items():
        rows.sort(key=_site_score)
        result[cat] = [r["site_id"] for r in rows[:DEMO_ASSET_LIMIT_PER_CATEGORY]]
    _cache["site_ids"] = result
    return result


async def get_demo_site_id_set(category: Optional[str] = None) -> Set[str]:
    by_cat = await get_demo_site_ids_by_category()
    if category:
        return set(by_cat.get(category, []))
    out: Set[str] = set()
    for ids in by_cat.values():
        out.update(ids)
    return out


async def get_demo_asset_id_set(site_ids: Optional[List[str]] = None) -> Set[str]:
    """Asset ids capped to DEMO_ASSET_LIMIT_PER_CATEGORY per (site, asset_type)."""
    if site_ids is None:
        site_ids = sorted(await get_demo_site_id_set())
    cache_key = tuple(sorted(site_ids))
    cached = _cache["asset_ids"]
    if cached is not None and cached.get("key") == cache_key:
        return cached["value"]
    q = {"lifecycle_status": {"$ne": "retired"}}
    if site_ids:
        q["site_id"] = {"$in": site_ids}
    else:
        q["site_id"] = {"$in": []}
    assets = await db.fleet_assets.find(q, {"_id": 0}).to_list(20000)
    groups: Dict[Tuple[str, str], List[dict]] = {}
    for a in assets:
        key = (a.get("site_id"), a.get("asset_type") or "Other")
        groups.setdefault(key, []).append(a)
    out: Set[str] = set()
    for rows in groups.values():
        rows.sort(key=_asset_score)
        out.update(r["asset_id"] for r in rows[:DEMO_ASSET_LIMIT_PER_CATEGORY])
    _cache["asset_ids"] = {"key": cache_key, "value": out}
    return out
