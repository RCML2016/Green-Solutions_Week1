"""RBAC extras: workspace switcher, multi-role, client viewer scope, evidence upload.

Design notes:
- User document has both `role` (primary/active) and `roles` (list). `role` is what
  the frontend uses to pick the sidebar & landing. Switching workspaces = setting
  `role` to any value already in `roles`.
- Admin is a super-role: `admin` in `roles` implies access to everything.
- Client viewer scope is stored on the user document under `client_scope`:
    { allowed_site_ids: [...], allowed_categories: [...] }
"""
from __future__ import annotations

import os
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Response, Header, Query
from fastapi.concurrency import run_in_threadpool

from deps import db, get_current_user, require_admin, create_access_token
from models import (
    RolesUpdateRequest,
    WorkspaceSwitchRequest,
    ClientScopeRequest,
)
from rbac import MVP_ROLES
import storage

router = APIRouter(prefix="/rbac", tags=["rbac"])


def _effective_roles(user: dict) -> list[str]:
    """Union of primary role + secondary roles list."""
    roles = set(user.get("roles") or [])
    if user.get("role"):
        roles.add(user["role"])
    return sorted(roles)


@router.get("/my-roles")
async def my_roles(user: dict = Depends(get_current_user)):
    return {
        "active_role": user.get("role"),
        "roles": _effective_roles(user),
    }


@router.post("/switch")
async def switch_workspace(payload: WorkspaceSwitchRequest, user: dict = Depends(get_current_user)):
    """Switch active workspace. User must already have the target role assigned."""
    effective = set(_effective_roles(user))
    # Admin can switch to anything
    if payload.role not in effective and "admin" not in effective:
        raise HTTPException(status_code=403, detail=f"You do not have the '{payload.role}' role")

    # Preserve the current active role in `roles` so switching is always reversible
    # (prevents "admin self-lockout" when an admin previews another workspace).
    prior_role = user.get("role")
    prior_roles = user.get("roles") or []
    new_roles = list(dict.fromkeys([*prior_roles, prior_role, payload.role])) if prior_role else list(dict.fromkeys([*prior_roles, payload.role]))

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"role": payload.role, "roles": new_roles}},
    )
    # Issue a fresh token so the client picks the new role from /auth/me
    token = create_access_token(user["id"], user["email"])
    return {
        "ok": True,
        "active_role": payload.role,
        "roles": new_roles,
        "access_token": token,
        "token_type": "bearer",
    }


# --------- Admin: multi-role assignment ---------
team_router = APIRouter(prefix="/team", tags=["team"])


@team_router.patch("/users/{user_id}/roles")
async def set_multi_roles(user_id: str, payload: RolesUpdateRequest, admin: dict = Depends(require_admin)):
    """Admin sets the array of roles a user holds. Primary `role` = first entry."""
    for r in payload.roles:
        if r not in MVP_ROLES and r != "admin":
            raise HTTPException(status_code=422, detail=f"Unknown role: {r}")
    dedup = list(dict.fromkeys(payload.roles))  # preserve order, dedup
    update = {"roles": dedup, "role": dedup[0]}
    res = await db.users.update_one({"id": user_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    logging.info(f"[TEAM ROLES] {admin['email']} → user {user_id} = {dedup}")
    return {"ok": True, "roles": dedup, "active_role": dedup[0]}


@team_router.patch("/users/{user_id}/client-scope")
async def set_client_scope(user_id: str, payload: ClientScopeRequest, admin: dict = Depends(require_admin)):
    """Admin sets the sites/categories a client_viewer can see."""
    scope = {
        "allowed_site_ids": payload.allowed_site_ids,
        "allowed_categories": payload.allowed_categories,
    }
    res = await db.users.update_one({"id": user_id}, {"$set": {"client_scope": scope}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    logging.info(f"[CLIENT SCOPE] {admin['email']} → user {user_id} · {len(payload.allowed_site_ids)} sites · {len(payload.allowed_categories)} cats")
    return {"ok": True, "client_scope": scope}


@team_router.get("/users/{user_id}/client-scope")
async def get_client_scope(user_id: str, admin: dict = Depends(require_admin)):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "client_scope": 1})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u.get("client_scope") or {"allowed_site_ids": [], "allowed_categories": []}


# --------- Client viewer: their own scope + safe fleet slice ---------
client_router = APIRouter(prefix="/client", tags=["client"])


@client_router.get("/scope")
async def my_scope(user: dict = Depends(get_current_user)):
    """Return the current user's client_scope (empty = nothing approved yet)."""
    if user.get("role") != "client_viewer" and "client_viewer" not in (user.get("roles") or []):
        # Non-clients get a wide scope so the endpoint still works for admins previewing
        return {"allowed_site_ids": [], "allowed_categories": [], "unrestricted": True}
    scope = user.get("client_scope") or {"allowed_site_ids": [], "allowed_categories": []}
    return {**scope, "unrestricted": False}


@client_router.get("/portfolio")
async def client_portfolio(user: dict = Depends(get_current_user)):
    """Return read-only fleet KPIs + site tiles restricted to the client's scope."""
    scope = user.get("client_scope") or {}
    site_ids = scope.get("allowed_site_ids") or []
    categories = scope.get("allowed_categories") or []

    # If nothing approved yet, return empty (portal shows onboarding message)
    if not site_ids and not categories:
        return {
            "sites": [],
            "kpis": {"site_count": 0, "total_capacity_MW": 0, "avg_performance_ratio_pct": 0,
                     "avg_availability_pct": 0, "actual_kWh_day": 0},
            "scope_empty": True,
        }

    q: dict = {}
    if site_ids and categories:
        q = {"$or": [{"site_id": {"$in": site_ids}}, {"site_type": {"$in": categories}}]}
    elif site_ids:
        q = {"site_id": {"$in": site_ids}}
    elif categories:
        q = {"site_type": {"$in": categories}}

    sites = await db.fleet_sites.find(q, {"_id": 0}).sort("site_id", 1).limit(200).to_list(200)
    site_ids_scope = [s["site_id"] for s in sites]

    # Perf aggregates over scope
    perf_pipeline = [
        {"$match": {"site_id": {"$in": site_ids_scope}} if site_ids_scope else {"site_id": None}},
        {"$group": {
            "_id": None,
            "avg_pr": {"$avg": "$performance_ratio_pct"},
            "avg_availability": {"$avg": "$availability_pct"},
            "total_actual": {"$sum": "$actual_kWh"},
            "total_expected": {"$sum": "$expected_kWh"},
        }},
    ]
    perf = None
    async for d in db.fleet_performance.aggregate(perf_pipeline):
        perf = d

    # Merge latest perf into each site (single aggregation instead of full scan)
    perf_by_site = {}
    if site_ids_scope:
        latest_perf_pipeline = [
            {"$match": {"site_id": {"$in": site_ids_scope}}},
            {"$sort": {"date": -1}},
            {"$group": {
                "_id": "$site_id",
                "performance_ratio_pct": {"$first": "$performance_ratio_pct"},
                "availability_pct": {"$first": "$availability_pct"},
            }},
        ]
        async for p in db.fleet_performance.aggregate(latest_perf_pipeline):
            perf_by_site[p["_id"]] = p

    tiles = []
    for s in sites:
        p = perf_by_site.get(s["site_id"], {})
        tiles.append({
            "site_id": s["site_id"],
            "site_name": s["site_name"],
            "site_type": s["site_type"],
            "state": s["state"],
            "site_capacity_kW": s["site_capacity_kW"],
            "performance_ratio_pct": p.get("performance_ratio_pct"),
            "availability_pct": p.get("availability_pct"),
        })

    total_cap = sum((s.get("site_capacity_kW") or 0) for s in sites)
    return {
        "sites": tiles,
        "scope_empty": False,
        "kpis": {
            "site_count": len(sites),
            "total_capacity_MW": round(total_cap / 1000, 2),
            "avg_performance_ratio_pct": round((perf or {}).get("avg_pr") or 0, 2),
            "avg_availability_pct": round((perf or {}).get("avg_availability") or 0, 2),
            "actual_kWh_day": round((perf or {}).get("total_actual") or 0, 1),
            "expected_kWh_day": round((perf or {}).get("total_expected") or 0, 1),
        },
    }


# --------- Evidence upload (field technician) ---------
evidence_router = APIRouter(prefix="/evidence", tags=["evidence"])


@evidence_router.post("")
async def upload_evidence(
    file: UploadFile = File(...),
    site_id: str = Form(None),
    alarm_id: str = Form(None),
    work_order_id: str = Form(None),
    note: str = Form(""),
    user: dict = Depends(get_current_user),
):
    """Upload a photo attached to an alarm / work-order. Returns the DB record."""
    ext = (file.filename or "").rsplit(".", 1)[-1].lower() if "." in (file.filename or "") else "bin"
    if ext not in storage.MIME_MAP and (file.content_type or "").split("/")[0] != "image":
        raise HTTPException(status_code=415, detail="Only image uploads are allowed")

    data = await file.read()
    if len(data) > 8 * 1024 * 1024:  # 8 MB
        raise HTTPException(status_code=413, detail="File too large (max 8 MB)")

    evidence_id = str(uuid.uuid4())
    path = f"{storage.APP_NAME}/evidence/{user['id']}/{evidence_id}.{ext}"
    try:
        result = await run_in_threadpool(
            storage.put_object,
            path, data, file.content_type or storage.MIME_MAP.get(ext, "application/octet-stream"),
        )
    except Exception as e:  # noqa: BLE001
        logging.exception("Evidence upload failed")
        raise HTTPException(status_code=502, detail=f"Storage upload failed: {e}")

    doc = {
        "id": evidence_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "storage_path": result["path"],
        "content_type": file.content_type or storage.MIME_MAP.get(ext, "application/octet-stream"),
        "size": result.get("size", len(data)),
        "site_id": site_id,
        "alarm_id": alarm_id,
        "work_order_id": work_order_id,
        "note": note,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.evidence.insert_one(doc)
    doc.pop("_id", None)
    return doc


@evidence_router.get("")
async def list_evidence(
    site_id: str = Query(default=None),
    alarm_id: str = Query(default=None),
    user: dict = Depends(get_current_user),
):
    q: dict = {}
    if site_id: q["site_id"] = site_id
    if alarm_id: q["alarm_id"] = alarm_id
    # Non-admins only see their own uploads
    if user.get("role") != "admin":
        q["user_id"] = user["id"]
    items = await db.evidence.find(q, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    return items


@evidence_router.get("/{evidence_id}/file")
async def fetch_evidence(
    evidence_id: str,
    auth: str = Query(default=None),
    authorization: str = Header(default=None),
):
    """Serve the image bytes. Accepts `?auth=<token>` because <img> tags can't
    send Authorization headers."""
    # Manual auth check
    from deps import get_current_user  # local import to avoid circular
    import jwt as pyjwt
    token = auth or (authorization[7:] if authorization and authorization.startswith("Bearer ") else None)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
        user_id = payload["sub"]
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    rec = await db.evidence.find_one({"id": evidence_id})
    if not rec:
        raise HTTPException(status_code=404, detail="Evidence not found")

    # Non-admins only see their own uploads
    requester = await db.users.find_one({"id": user_id})
    if requester and requester.get("role") != "admin" and rec["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        content, ct = await run_in_threadpool(storage.get_object, rec["storage_path"])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Storage read failed: {e}")
    return Response(content=content, media_type=rec.get("content_type", ct))
