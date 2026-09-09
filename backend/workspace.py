"""Workspace mode, feature flags, deterministic demo scenarios and reset controls."""
from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from deps import db, get_current_user, require_admin
from models import WorkspaceConfigUpdate
from seed_dataset import SHEET_COLLECTION_MAP, seed_if_empty

router = APIRouter(prefix="/workspace", tags=["workspace"])
CONFIG_ID = "default"
VALID_FEATURES = {
    "overview", "portfolio", "assets", "ai", "operations", "work_orders",
    "reports", "administration", "evidence_upload", "notifications",
    "external_integrations", "my_work", "performance", "client_portal",
}
DEFAULT_FEATURES = {name: True for name in VALID_FEATURES}
DEFAULT_FEATURES.update({"notifications": False, "external_integrations": False})
SCENARIOS = [
    {"id": "portfolio_overview", "label": "Portfolio Overview", "description": "Balanced fleet health, risks and work orders.", "steps": [{"label": "Executive KPIs", "path": "/overview"}, {"label": "Portfolio", "path": "/dashboard"}, {"label": "AI Findings", "path": "/ai"}]},
    {"id": "inverter_fault", "label": "Inverter Fault", "description": "High-severity inverter fault investigation.", "steps": [{"label": "Alarm Risk", "path": "/operations"}, {"label": "AI Diagnosis", "path": "/ai"}, {"label": "Draft Work Order", "path": "/work-orders"}]},
    {"id": "soiling_loss", "label": "Soiling Loss", "description": "Underperformance and recoverable-energy analysis.", "steps": [{"label": "Performance", "path": "/performance"}, {"label": "Site Evidence", "path": "/dashboard"}, {"label": "Recommended Action", "path": "/ai"}]},
    {"id": "bess_risk", "label": "BESS Risk", "description": "Battery availability and thermal-risk review.", "steps": [{"label": "BESS Assets", "path": "/assets"}, {"label": "Risk Review", "path": "/operations"}, {"label": "Action Plan", "path": "/work-orders"}]},
]
_reset_lock = asyncio.Lock()


def _defaults() -> dict:
    mode = os.environ.get("WORKSPACE_MODE", "demo").lower()
    if mode not in {"demo", "pilot", "production"}:
        mode = "demo"
    return {
        "id": CONFIG_ID,
        "mode": mode,
        "scenario": "portfolio_overview",
        "features": DEFAULT_FEATURES.copy(),
        "external_side_effects_enabled": mode == "production",
        "data_label": "Demo Data" if mode == "demo" else "Pilot Data" if mode == "pilot" else "Live Data",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def get_workspace_config() -> dict:
    config = await db.workspace_config.find_one({"id": CONFIG_ID}, {"_id": 0})
    if not config:
        config = _defaults()
        await db.workspace_config.update_one({"id": CONFIG_ID}, {"$setOnInsert": config}, upsert=True)
    merged = _defaults()
    merged.update(config)
    merged["features"] = {**DEFAULT_FEATURES, **config.get("features", {})}
    return merged


async def require_external_side_effects(_user: dict = Depends(get_current_user)) -> dict:
    """Fail closed when a request could affect systems outside AssetNova."""
    config = await get_workspace_config()
    if not config["external_side_effects_enabled"]:
        raise HTTPException(
            status_code=409,
            detail=f"External side effects are disabled in {config['mode'].upper()} mode.",
        )
    return config


@router.get("")
async def read_workspace(_user: dict = Depends(get_current_user)):
    import demo_scope
    config = await get_workspace_config()
    return {
        **config,
        "scenarios": SCENARIOS,
        "demo_mode_enabled": demo_scope.DEMO_MODE_ENABLED,
        "demo_asset_limit_per_category": demo_scope.DEMO_ASSET_LIMIT_PER_CATEGORY,
    }


@router.patch("")
async def update_workspace(payload: WorkspaceConfigUpdate, admin: dict = Depends(require_admin)):
    import demo_scope
    unknown = sorted(set(payload.features) - VALID_FEATURES)
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown feature flags: {', '.join(unknown)}")
    current = await get_workspace_config()
    features = {**current["features"], **payload.features}
    external_enabled = payload.mode == "production" and features["external_integrations"]
    doc = {
        "mode": payload.mode,
        "scenario": payload.scenario,
        "features": features,
        "external_side_effects_enabled": external_enabled,
        "data_label": "Demo Data" if payload.mode == "demo" else "Pilot Data" if payload.mode == "pilot" else "Live Data",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": admin["id"],
    }
    await db.workspace_config.update_one({"id": CONFIG_ID}, {"$set": doc}, upsert=True)
    await db.workspace_audit.insert_one({"action": "config_updated", **doc})
    demo_scope.bump_demo_cache()
    return {"id": CONFIG_ID, **doc, "scenarios": SCENARIOS}


@router.post("/reset-demo")
async def reset_demo(admin: dict = Depends(require_admin)):
    """Restore the shipped workbook and clear transient demo activity."""
    import demo_scope
    config = await get_workspace_config()
    if config["mode"] != "demo":
        raise HTTPException(status_code=409, detail="Demo reset is available only in DEMO mode.")
    if _reset_lock.locked():
        raise HTTPException(status_code=409, detail="A demo reset is already running.")

    async with _reset_lock:
        for collection in set(SHEET_COLLECTION_MAP.values()):
            await db[collection].delete_many({})
        for collection in ("actions", "alerts", "ai_sessions", "ai_messages", "snapshots", "evidence"):
            await db[collection].delete_many({})
        counts = await seed_if_empty(db)
        now = datetime.now(timezone.utc).isoformat()
        await db.workspace_config.update_one(
            {"id": CONFIG_ID},
            {"$set": {"scenario": "portfolio_overview", "last_reset_at": now, "last_reset_by": admin["id"]}},
        )
        await db.workspace_audit.insert_one({"action": "demo_reset", "at": now, "by": admin["id"], "counts": counts})
        demo_scope.bump_demo_cache()
        return {"ok": True, "reset_at": now, "counts": counts}
