"""Admin-only integration health and the first end-to-end Solar SCADA pilot."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError

from deps import db, require_admin
from scada_pilot import PilotValidationError, fleet_telemetry_projection, normalize_row, parse_csv

router = APIRouter(prefix="/integrations", tags=["integrations"])
CONNECTOR_ID = "solar_scada_pilot"
SAMPLE_FILE = Path(__file__).resolve().parents[1] / "data" / "pilot_scada_sample.csv"


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AssetMapping(BaseModel):
    asset_id: str = Field(min_length=2, max_length=80)
    site_id: str = Field(min_length=2, max_length=80)


class TagMapping(BaseModel):
    metric: str = Field(min_length=2, max_length=100)
    unit: str = Field(min_length=1, max_length=30)
    factor: float = 1
    min: float | None = None
    max: float | None = None


class MappingWrite(BaseModel):
    source_system: str = Field(default="customer_scada_csv", min_length=2, max_length=80)
    assets: Dict[str, AssetMapping]
    tags: Dict[str, TagMapping]


async def _mapping() -> dict:
    mapping = await db.integration_mappings.find_one({"connector_id": CONNECTOR_ID}, {"_id": 0})
    if not mapping:
        raise HTTPException(409, "Configure the Solar SCADA pilot mapping before uploading data")
    return mapping


async def _store_event(event: dict, run_id: str) -> bool:
    existing = await db.integration_canonical_events.find_one(
        {"idempotency_key": event["idempotency_key"]}, {"_id": 1}
    )
    if existing:
        return False
    document = event | {"run_id": run_id, "connector_id": CONNECTOR_ID, "ingested_at": now()}
    try:
        await db.integration_canonical_events.insert_one(document.copy())
    except DuplicateKeyError:
        return False
    projection = fleet_telemetry_projection(event)
    if len(projection) > 5:
        await db.fleet_telemetry.update_one(
            {"idempotency_key": event["idempotency_key"]}, {"$setOnInsert": projection}, upsert=True
        )
    return True


@router.post("/solar-scada-pilot/bootstrap-demo")
async def bootstrap_demo(_admin: dict = Depends(require_admin)):
    site = await db.fleet_sites.find_one(
        {"site_type": {"$regex": "Solar", "$options": "i"}, "lifecycle_status": {"$ne": "retired"}},
        {"_id": 0, "site_id": 1, "site_name": 1},
    )
    if not site:
        site = await db.fleet_sites.find_one({}, {"_id": 0, "site_id": 1, "site_name": 1})
    if not site:
        raise HTTPException(409, "No fleet site is available for the pilot mapping")
    asset = await db.fleet_assets.find_one(
        {"site_id": site["site_id"], "lifecycle_status": {"$ne": "retired"}},
        {"_id": 0, "asset_id": 1},
    )
    if not asset:
        raise HTTPException(409, "The selected pilot site has no active asset")
    mapping = {
        "connector_id": CONNECTOR_ID, "source_system": "customer_scada_csv",
        "assets": {"CUSTOMER_INV_001": {"asset_id": asset["asset_id"], "site_id": site["site_id"]}},
        "tags": {
            "PAC": {"metric": "ac_power_kw", "unit": "kW", "factor": 1, "min": -10, "max": 5000},
            "PAC_EXPECTED": {"metric": "expected_power_kw", "unit": "kW", "factor": 1, "min": 0, "max": 5000},
            "TEMP_INV": {"metric": "inverter_temp_c", "unit": "C", "factor": 1, "min": -40, "max": 120},
            "EFF": {"metric": "inverter_efficiency_pct", "unit": "%", "factor": 1, "min": 0, "max": 100},
        },
        "updated_at": now(), "mode": "demo",
    }
    await db.integration_mappings.update_one(
        {"connector_id": CONNECTOR_ID}, {"$set": mapping}, upsert=True
    )
    return {"configured": True, "site": site, "asset": asset, "mapping": mapping}


@router.put("/solar-scada-pilot/mapping")
async def save_mapping(payload: MappingWrite, admin: dict = Depends(require_admin)):
    assets = {key: value.model_dump() for key, value in payload.assets.items()}
    for source_id, item in assets.items():
        exists = await db.fleet_assets.find_one(
            {"asset_id": item["asset_id"], "site_id": item["site_id"]}, {"_id": 1}
        )
        if not exists:
            raise HTTPException(400, f"Mapped asset/site does not exist for source device '{source_id}'")
    document = {
        "connector_id": CONNECTOR_ID, "source_system": payload.source_system,
        "assets": assets, "tags": {k: v.model_dump() for k, v in payload.tags.items()},
        "updated_at": now(), "updated_by": admin.get("email"), "mode": "pilot",
    }
    await db.integration_mappings.update_one(
        {"connector_id": CONNECTOR_ID}, {"$set": document}, upsert=True
    )
    return {"configured": True, "mapping": document}


@router.get("/solar-scada-pilot/mapping")
async def get_mapping(_admin: dict = Depends(require_admin)):
    return await _mapping()


@router.get("/solar-scada-pilot/sample")
async def download_sample(_admin: dict = Depends(require_admin)):
    if not SAMPLE_FILE.exists():
        raise HTTPException(404, "Pilot sample file is unavailable")
    mapping = await _mapping()
    first_asset = next(iter(mapping["assets"].values()), None)
    if not first_asset:
        raise HTTPException(409, "Pilot mapping has no asset")
    content = SAMPLE_FILE.read_text(encoding="utf-8").replace(
        "REPLACE_WITH_BOOTSTRAP_SITE", first_asset["site_id"]
    )
    return Response(content, media_type="text/csv", headers={
        "Content-Disposition": f'attachment; filename="{SAMPLE_FILE.name}"'
    })


@router.post("/solar-scada-pilot/upload")
async def upload_scada(
    file: UploadFile = File(...), dry_run: bool = Query(False), admin: dict = Depends(require_admin)
):
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(415, "Upload a UTF-8 CSV file")
    content = await file.read()
    if len(content) > 10_000_000:
        raise HTTPException(413, "Pilot upload exceeds 10 MB")
    mapping = await _mapping()
    try:
        rows = parse_csv(content)
    except PilotValidationError as exc:
        raise HTTPException(400, str(exc)) from exc

    run_id, started_at = str(uuid.uuid4()), now()
    accepted = duplicates = rejected = 0
    errors = []
    for row in rows:
        raw = {"run_id": run_id, "connector_id": CONNECTOR_ID, "filename": file.filename,
               "row_number": row["_row_number"], "payload": row, "received_at": started_at}
        if not dry_run:
            await db.integration_raw_events.insert_one(raw.copy())
        try:
            event = normalize_row(row, mapping, mapping["source_system"])
            if dry_run:
                accepted += 1
            elif await _store_event(event, run_id):
                accepted += 1
            else:
                duplicates += 1
        except (PilotValidationError, ValueError, TypeError) as exc:
            rejected += 1
            error = {"row": row["_row_number"], "reason": str(exc)[:300]}
            errors.append(error)
            if not dry_run:
                await db.integration_dlq.insert_one({
                    "id": str(uuid.uuid4()), "run_id": run_id, "connector_id": CONNECTOR_ID,
                    "status": "pending", "reason": error["reason"], "raw_payload": row,
                    "failed_at": now(), "replay_count": 0,
                })

    total = len(rows)
    status = "healthy" if rejected == 0 else "degraded" if accepted else "failed"
    result = {"run_id": run_id, "filename": file.filename, "dry_run": dry_run, "status": status,
              "total": total, "accepted": accepted, "duplicates": duplicates, "rejected": rejected,
              "mapping_coverage_pct": round(((total - rejected) / total) * 100, 2), "errors": errors[:100],
              "started_at": started_at, "completed_at": now(), "uploaded_by": admin.get("email")}
    if not dry_run:
        await db.integration_runs.insert_one(result.copy())
        await db.integration_connectors.update_one({"connector_id": CONNECTOR_ID}, {"$set": {
            "connector_id": CONNECTOR_ID, "name": "Solar SCADA Pilot", "protocol": "CSV batch",
            "status": status, "last_sync_at": result["completed_at"], "last_run_id": run_id,
            "records_processed": accepted, "duplicates": duplicates, "validation_failures": rejected,
            "mapping_coverage_pct": result["mapping_coverage_pct"], "updated_at": now(),
        }}, upsert=True)
    return result


@router.get("/health")
async def integration_health(_admin: dict = Depends(require_admin)):
    connectors = await db.integration_connectors.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    pending = await db.integration_dlq.count_documents({"status": "pending"})
    runs = await db.integration_runs.find({}, {"_id": 0}).sort("completed_at", -1).limit(10).to_list(10)
    return {
        "summary": {"configured": len(connectors), "healthy": sum(c.get("status") == "healthy" for c in connectors),
                    "degraded": sum(c.get("status") == "degraded" for c in connectors),
                    "failed": sum(c.get("status") == "failed" for c in connectors), "dlq_pending": pending},
        "connectors": connectors, "recent_runs": runs, "server_time": now(),
    }


@router.get("/dlq")
async def list_dlq(status: str = "pending", limit: int = Query(100, ge=1, le=500),
                   _admin: dict = Depends(require_admin)):
    query = {} if status == "all" else {"status": status}
    items = await db.integration_dlq.find(query, {"_id": 0}).sort("failed_at", -1).limit(limit).to_list(limit)
    return {"total": await db.integration_dlq.count_documents(query), "items": items}


@router.post("/dlq/{item_id}/replay")
async def replay_dlq(item_id: str, admin: dict = Depends(require_admin)):
    item = await db.integration_dlq.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "DLQ item not found")
    if item.get("status") == "resolved":
        return {"replayed": False, "duplicate": True, "item": item}
    mapping = await _mapping()
    try:
        event = normalize_row(item["raw_payload"], mapping, mapping["source_system"])
        stored = await _store_event(event, item["run_id"])
    except (PilotValidationError, ValueError, TypeError) as exc:
        await db.integration_dlq.update_one({"id": item_id}, {"$set": {
            "reason": str(exc)[:300], "last_replay_at": now(), "last_replay_by": admin.get("email")
        }, "$inc": {"replay_count": 1}})
        raise HTTPException(409, f"Replay still fails validation: {exc}") from exc
    await db.integration_dlq.update_one({"id": item_id}, {"$set": {
        "status": "resolved", "resolved_at": now(), "last_replay_at": now(),
        "last_replay_by": admin.get("email"), "resolution": "stored" if stored else "duplicate"
    }, "$inc": {"replay_count": 1}})
    return {"replayed": True, "stored": stored, "idempotency_key": event["idempotency_key"]}
