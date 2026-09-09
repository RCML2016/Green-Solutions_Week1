"""Production-safe site and asset lifecycle administration."""
from __future__ import annotations

import csv
import io
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Literal, Optional

import openpyxl
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pymongo import ReturnDocument

from deps import db, get_current_user
from rbac import role_required
import demo_scope

router = APIRouter(prefix="/fleet-admin", tags=["fleet-admin"])
manager_guard = role_required("asset_manager")
admin_guard = role_required()  # role_required always adds admin
ACTIVE = {"$ne": "retired"}


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def actor(user: dict) -> dict:
    return {"id": user.get("id"), "email": user.get("email"), "name": user.get("name")}


async def audit(user: dict, action: str, entity: str, entity_id: str,
                before: Optional[dict] = None, after: Optional[dict] = None,
                metadata: Optional[dict] = None) -> None:
    await db.fleet_audit_log.insert_one({
        "timestamp": now(), "actor": actor(user), "action": action,
        "entity_type": entity, "entity_id": entity_id,
        "before": before, "after": after, "metadata": metadata or {},
    })


class SiteWrite(BaseModel):
    site_id: str = Field(pattern=r"^[A-Za-z0-9_-]{2,30}$")
    site_name: str = Field(min_length=2, max_length=120)
    site_type: str = Field(min_length=2, max_length=80)
    site_capacity_kW: float = Field(gt=0, le=10_000_000)
    state: str = Field(min_length=2, max_length=60)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    address: Optional[str] = Field(default=None, max_length=200)
    city: Optional[str] = Field(default=None, max_length=100)
    zip_code: Optional[str] = Field(default=None, max_length=15)
    cod_date: Optional[str] = Field(default=None, max_length=30)
    owner_client: Optional[str] = Field(default=None, max_length=120)
    version: Optional[int] = Field(default=None, ge=1)


class SitePatch(BaseModel):
    site_name: Optional[str] = Field(default=None, min_length=2, max_length=120)
    site_type: Optional[str] = Field(default=None, min_length=2, max_length=80)
    site_capacity_kW: Optional[float] = Field(default=None, gt=0, le=10_000_000)
    state: Optional[str] = Field(default=None, min_length=2, max_length=60)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    address: Optional[str] = Field(default=None, max_length=200)
    city: Optional[str] = Field(default=None, max_length=100)
    zip_code: Optional[str] = Field(default=None, max_length=15)
    cod_date: Optional[str] = Field(default=None, max_length=30)
    owner_client: Optional[str] = Field(default=None, max_length=120)
    version: int = Field(ge=1)


class AssetWrite(BaseModel):
    asset_id: str = Field(pattern=r"^[A-Za-z0-9_-]{2,40}$")
    site_id: str = Field(pattern=r"^[A-Za-z0-9_-]{2,30}$")
    asset_type: str = Field(min_length=2, max_length=80)
    make: Optional[str] = Field(default=None, max_length=80)
    model: Optional[str] = Field(default=None, max_length=80)
    serial_number: Optional[str] = Field(default=None, max_length=100)
    nameplate_kW: Optional[float] = Field(default=None, gt=0, le=10_000_000)
    install_date: Optional[str] = Field(default=None, max_length=30)
    status: str = Field(default="Active", max_length=30)
    zip_code: Optional[str] = Field(default=None, max_length=15)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)


class AssetPatch(BaseModel):
    site_id: Optional[str] = Field(default=None, pattern=r"^[A-Za-z0-9_-]{2,30}$")
    asset_type: Optional[str] = Field(default=None, min_length=2, max_length=80)
    make: Optional[str] = Field(default=None, max_length=80)
    model: Optional[str] = Field(default=None, max_length=80)
    serial_number: Optional[str] = Field(default=None, max_length=100)
    nameplate_kW: Optional[float] = Field(default=None, gt=0, le=10_000_000)
    install_date: Optional[str] = Field(default=None, max_length=30)
    status: Optional[str] = Field(default=None, max_length=30)
    zip_code: Optional[str] = Field(default=None, max_length=15)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    version: int = Field(ge=1)


async def active_site(site_id: str) -> dict:
    site = await db.fleet_sites.find_one({"site_id": site_id, "lifecycle_status": ACTIVE}, {"_id": 0})
    if not site:
        raise HTTPException(400, "Site does not exist or is retired")
    return site


@router.post("/sites", status_code=201)
async def create_site(payload: SiteWrite, user: dict = Depends(manager_guard)):
    if await db.fleet_sites.find_one({"site_id": payload.site_id}):
        raise HTTPException(409, "Site ID already exists")
    doc = payload.model_dump(exclude={"version"}) | {
        "lifecycle_status": "active", "version": 1, "created_at": now(),
        "created_by": actor(user), "updated_at": now(), "updated_by": actor(user),
    }
    await db.fleet_sites.insert_one(doc.copy())
    await audit(user, "create", "site", payload.site_id, after=doc)
    demo_scope.bump_demo_cache()
    return doc


@router.patch("/sites/{site_id}")
async def update_site(site_id: str, payload: SitePatch, user: dict = Depends(manager_guard)):
    before = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    if not before: raise HTTPException(404, "Site not found")
    changes = payload.model_dump(exclude={"version"}, exclude_unset=True) | {"updated_at": now(), "updated_by": actor(user)}
    after = await db.fleet_sites.find_one_and_update(
        {"site_id": site_id, "$expr": {"$eq": [{"$ifNull": ["$version", 1]}, payload.version]}},
        [{"$set": {**changes, "version": {"$add": [{"$ifNull": ["$version", 1]}, 1]}}}],
        projection={"_id": 0},
        return_document=ReturnDocument.AFTER)
    if not after: raise HTTPException(409, "This record changed since you opened it; refresh and retry")
    await audit(user, "update", "site", site_id, before, after)
    return after


@router.delete("/sites/{site_id}")
async def retire_site(site_id: str, user: dict = Depends(admin_guard)):
    before = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    if not before: raise HTTPException(404, "Site not found")
    assets = await db.fleet_assets.count_documents({"site_id": site_id, "lifecycle_status": ACTIVE})
    work_orders = await db.fleet_work_orders.count_documents({"site_id": site_id, "status": {"$nin": ["Resolved", "Closed"]}})
    if assets or work_orders:
        raise HTTPException(409, {"message": "Site has active dependencies", "active_assets": assets, "open_work_orders": work_orders})
    stamp = now()
    await db.fleet_sites.update_one({"site_id": site_id}, {"$set": {"lifecycle_status": "retired", "retired_at": stamp, "retired_by": actor(user), "updated_at": stamp}, "$inc": {"version": 1}})
    after = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    await audit(user, "retire", "site", site_id, before, after)
    demo_scope.bump_demo_cache()
    return after


@router.post("/sites/{site_id}/restore")
async def restore_site(site_id: str, user: dict = Depends(admin_guard)):
    before = await db.fleet_sites.find_one({"site_id": site_id, "lifecycle_status": "retired"}, {"_id": 0})
    if not before: raise HTTPException(404, "Retired site not found")
    await db.fleet_sites.update_one({"site_id": site_id}, {"$set": {"lifecycle_status": "active", "updated_at": now(), "updated_by": actor(user)}, "$unset": {"retired_at": "", "retired_by": ""}, "$inc": {"version": 1}})
    after = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    await audit(user, "restore", "site", site_id, before, after)
    demo_scope.bump_demo_cache()
    return after


@router.post("/sites/{site_id}/toggle-featured")
async def toggle_site_featured(site_id: str, user: dict = Depends(admin_guard)):
    """Mark/unmark a site as a curated demo representative (featured_for_demo)."""
    before = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    if not before: raise HTTPException(404, "Site not found")
    new_val = not before.get("featured_for_demo", False)
    await db.fleet_sites.update_one({"site_id": site_id}, {"$set": {"featured_for_demo": new_val, "updated_at": now(), "updated_by": actor(user)}})
    after = await db.fleet_sites.find_one({"site_id": site_id}, {"_id": 0})
    await audit(user, "toggle_featured", "site", site_id, before, after)
    demo_scope.bump_demo_cache()
    return after


@router.get("/assets")
async def list_assets(site_id: Optional[str] = None, asset_type: Optional[str] = None,
                      search: Optional[str] = None, include_retired: bool = False,
                      limit: int = Query(50, ge=1, le=500), skip: int = Query(0, ge=0),
                      user: dict = Depends(get_current_user)):
    q: Dict[str, Any] = {}
    if not include_retired: q["lifecycle_status"] = ACTIVE
    if site_id: q["site_id"] = site_id
    if asset_type: q["asset_type"] = asset_type
    if search:
        safe = re.escape(search)
        q["$or"] = [{k: {"$regex": safe, "$options": "i"}} for k in ("asset_id", "make", "model", "serial_number")]

    if await demo_scope.is_demo_scope_active(user):
        demo_site_ids = await demo_scope.get_demo_site_id_set()
        if site_id:
            scoped_sites = [site_id] if site_id in demo_site_ids else []
        else:
            scoped_sites = sorted(demo_site_ids)
        demo_asset_ids = sorted(await demo_scope.get_demo_asset_id_set(scoped_sites))
        q["asset_id"] = {"$in": demo_asset_ids}

    total = await db.fleet_assets.count_documents(q)
    rows = await db.fleet_assets.find(q, {"_id": 0}).sort("asset_id", 1).skip(skip).limit(limit).to_list(limit)
    site_ids = list({r.get("site_id") for r in rows})
    site_lookup = {
        s["site_id"]: s async for s in db.fleet_sites.find(
            {"site_id": {"$in": site_ids}}, {"_id": 0, "site_id": 1, "site_name": 1, "state": 1, "city": 1, "zip_code": 1}
        )
    }
    items = []
    for r in rows:
        site = site_lookup.get(r.get("site_id"), {})
        items.append(r | {
            "site_name": site.get("site_name"),
            "state": r.get("state") or site.get("state"),
            "city": r.get("city") or site.get("city"),
            "zip_code": r.get("zip_code") or site.get("zip_code"),
            "location_inherited": not bool(r.get("zip_code") or r.get("latitude")),
        })
    return {"total": total, "items": items}


@router.post("/assets", status_code=201)
async def create_asset(payload: AssetWrite, user: dict = Depends(manager_guard)):
    if await db.fleet_assets.find_one({"asset_id": payload.asset_id}): raise HTTPException(409, "Asset ID already exists")
    await active_site(payload.site_id)
    doc = payload.model_dump() | {"lifecycle_status": "active", "version": 1, "created_at": now(), "created_by": actor(user), "updated_at": now(), "updated_by": actor(user)}
    await db.fleet_assets.insert_one(doc.copy()); await audit(user, "create", "asset", payload.asset_id, after=doc)
    demo_scope.bump_demo_cache()
    return doc


@router.patch("/assets/{asset_id}")
async def update_asset(asset_id: str, payload: AssetPatch, user: dict = Depends(manager_guard)):
    before = await db.fleet_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not before: raise HTTPException(404, "Asset not found")
    changes = payload.model_dump(exclude={"version"}, exclude_unset=True)
    if changes.get("site_id"): await active_site(changes["site_id"])
    changes |= {"updated_at": now(), "updated_by": actor(user)}
    after = await db.fleet_assets.find_one_and_update({"asset_id": asset_id, "$expr": {"$eq": [{"$ifNull": ["$version", 1]}, payload.version]}}, [{"$set": {**changes, "version": {"$add": [{"$ifNull": ["$version", 1]}, 1]}}}], projection={"_id": 0}, return_document=ReturnDocument.AFTER)
    if not after: raise HTTPException(409, "This record changed since you opened it; refresh and retry")
    await audit(user, "update", "asset", asset_id, before, after); return after


@router.delete("/assets/{asset_id}")
async def retire_asset(asset_id: str, user: dict = Depends(admin_guard)):
    before = await db.fleet_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not before: raise HTTPException(404, "Asset not found")
    open_wos = await db.fleet_work_orders.count_documents({"asset_id": asset_id, "status": {"$nin": ["Resolved", "Closed"]}})
    open_alarms = await db.fleet_alarms.count_documents({"asset_id": asset_id, "status": {"$ne": "Resolved"}})
    if open_wos or open_alarms: raise HTTPException(409, {"message": "Asset has active dependencies", "open_work_orders": open_wos, "open_alarms": open_alarms})
    stamp = now(); await db.fleet_assets.update_one({"asset_id": asset_id}, {"$set": {"lifecycle_status": "retired", "status": "Retired", "retired_at": stamp, "retired_by": actor(user)}, "$inc": {"version": 1}})
    after = await db.fleet_assets.find_one({"asset_id": asset_id}, {"_id": 0}); await audit(user, "retire", "asset", asset_id, before, after)
    demo_scope.bump_demo_cache()
    return after


@router.post("/assets/{asset_id}/restore")
async def restore_asset(asset_id: str, user: dict = Depends(admin_guard)):
    before = await db.fleet_assets.find_one({"asset_id": asset_id, "lifecycle_status": "retired"}, {"_id": 0})
    if not before: raise HTTPException(404, "Retired asset not found")
    await active_site(before["site_id"])
    await db.fleet_assets.update_one({"asset_id": asset_id}, {"$set": {"lifecycle_status": "active", "status": "Active", "updated_at": now(), "updated_by": actor(user)}, "$unset": {"retired_at": "", "retired_by": ""}, "$inc": {"version": 1}})
    after = await db.fleet_assets.find_one({"asset_id": asset_id}, {"_id": 0}); await audit(user, "restore", "asset", asset_id, before, after)
    demo_scope.bump_demo_cache()
    return after


@router.post("/assets/{asset_id}/toggle-featured")
async def toggle_asset_featured(asset_id: str, user: dict = Depends(admin_guard)):
    """Mark/unmark an asset as a curated demo representative (featured_for_demo)."""
    before = await db.fleet_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    if not before: raise HTTPException(404, "Asset not found")
    new_val = not before.get("featured_for_demo", False)
    await db.fleet_assets.update_one({"asset_id": asset_id}, {"$set": {"featured_for_demo": new_val, "updated_at": now(), "updated_by": actor(user)}})
    after = await db.fleet_assets.find_one({"asset_id": asset_id}, {"_id": 0})
    await audit(user, "toggle_featured", "asset", asset_id, before, after)
    demo_scope.bump_demo_cache()
    return after


def uploaded_rows(content: bytes, filename: str) -> List[dict]:
    if filename.lower().endswith(".csv"):
        return list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    if filename.lower().endswith(".xlsx"):
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        ws = wb.active; values = ws.iter_rows(values_only=True); headers = [str(x or "").strip() for x in next(values)]
        rows = [dict(zip(headers, row)) for row in values if any(v is not None for v in row)]; wb.close(); return rows
    raise HTTPException(415, "Upload a CSV or XLSX file")


@router.post("/import/{entity_type}")
async def import_rows(entity_type: Literal["sites", "assets"], file: UploadFile = File(...),
                      commit: bool = False, user: dict = Depends(manager_guard)):
    content = await file.read()
    if len(content) > 5_000_000: raise HTTPException(413, "File exceeds 5 MB")
    rows = uploaded_rows(content, file.filename or "")
    if len(rows) > 5000: raise HTTPException(413, "Import is limited to 5,000 rows")
    model = SiteWrite if entity_type == "sites" else AssetWrite; id_key = "site_id" if entity_type == "sites" else "asset_id"
    valid, errors, seen = [], [], set()
    for index, row in enumerate(rows, start=2):
        clean = {str(k).strip(): v for k, v in row.items() if k and v not in (None, "")}
        try:
            doc = model.model_validate(clean).model_dump(exclude={"version"})
            if doc[id_key] in seen: raise ValueError("duplicate ID in file")
            seen.add(doc[id_key]); valid.append(doc)
        except Exception as exc: errors.append({"row": index, "message": str(exc)[:300]})
    existing = set()
    if valid:
        coll = db.fleet_sites if entity_type == "sites" else db.fleet_assets
        existing = {d[id_key] async for d in coll.find({id_key: {"$in": [v[id_key] for v in valid]}}, {"_id": 0, id_key: 1})}
        for v in valid:
            if v[id_key] in existing: errors.append({"row": None, "id": v[id_key], "message": "ID already exists"})
        if entity_type == "assets":
            site_ids = {v["site_id"] for v in valid}; found = {d["site_id"] async for d in db.fleet_sites.find({"site_id": {"$in": list(site_ids)}, "lifecycle_status": ACTIVE}, {"_id": 0, "site_id": 1})}
            for sid in sorted(site_ids - found): errors.append({"row": None, "id": sid, "message": "Site is missing or retired"})
    result = {"filename": file.filename, "entity_type": entity_type, "rows": len(rows), "valid": len(valid), "errors": errors, "committed": 0}
    if commit and not errors and valid:
        stamp = now(); docs = [v | {"lifecycle_status": "active", "version": 1, "created_at": stamp, "created_by": actor(user), "updated_at": stamp, "updated_by": actor(user)} for v in valid]
        coll = db.fleet_sites if entity_type == "sites" else db.fleet_assets; await coll.insert_many(docs, ordered=True)
        result["committed"] = len(docs); await audit(user, "bulk_import", entity_type[:-1], "bulk", metadata={"filename": file.filename, "count": len(docs)})
        demo_scope.bump_demo_cache()
    return result


@router.get("/audit")
async def audit_log(entity_type: Optional[str] = None, action: Optional[str] = None,
                    limit: int = Query(100, ge=1, le=500), skip: int = Query(0, ge=0),
                    user: dict = Depends(admin_guard)):
    q = {}
    if entity_type: q["entity_type"] = entity_type
    if action: q["action"] = action
    total = await db.fleet_audit_log.count_documents(q)
    items = await db.fleet_audit_log.find(q, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return {"total": total, "items": items}


@router.get("/audit-export")
async def audit_export(user: dict = Depends(admin_guard)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "actor_email", "action", "entity_type", "entity_id"])
    async for item in db.fleet_audit_log.find({}, {"_id": 0}).sort("timestamp", -1).limit(10_000):
        writer.writerow([item.get("timestamp"), (item.get("actor") or {}).get("email"), item.get("action"), item.get("entity_type"), item.get("entity_id")])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=fleet-audit-log.csv"})
