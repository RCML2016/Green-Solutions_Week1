"""AssetNova API — thin entry point.

All domain logic lives under /app/backend/routers/. This file wires the app,
runs the on-startup seed of the shipped renewable-energy dataset, and mounts
every APIRouter under the `/api` prefix.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
import secrets
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware

from deps import db, close_db_client, hash_password, require_admin
from seed_dataset import seed_if_empty
import storage
from routers.auth import router as auth_router
from routers.ai import router as ai_router
from routers.core import router as core_router
from routers.fleet import router as fleet_router
from routers.rbac_ext import router as rbac_router, team_router, client_router, evidence_router
from routers.qa import router as qa_router
from routers.fleet_admin import router as fleet_admin_router
from workspace import router as workspace_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(title="AssetNova API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "AssetNova API"}


@api_router.get("/healthz")
async def healthz():
    fleet_sites = await db.fleet_sites.estimated_document_count()
    return {"ok": True, "fleet_sites": fleet_sites, "time": datetime.now(timezone.utc).isoformat()}


@api_router.get("/download/source")
async def download_source(_admin: dict = Depends(require_admin)):
    """Return the latest packaged source zip. Admin-only."""
    downloads_dir = ROOT_DIR.parent / "downloads"
    if not downloads_dir.exists():
        raise HTTPException(status_code=404, detail="No packaged build found")
    zips = sorted(downloads_dir.glob("assetnova-*.zip"), key=lambda p: p.stat().st_mtime, reverse=True)
    if not zips:
        raise HTTPException(status_code=404, detail="No packaged build found")
    latest = zips[0]
    return FileResponse(latest, media_type="application/zip", filename=latest.name)


@api_router.get("/download/team-credentials")
async def download_team_credentials(_admin: dict = Depends(require_admin)):
    """Return the demo-user credentials CSV. Admin-only."""
    csv_path = ROOT_DIR.parent / "downloads" / "assetnova-team-credentials.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="Credentials CSV not generated yet")
    return FileResponse(csv_path, media_type="text/csv", filename="assetnova-team-credentials.csv")


@api_router.get("/download/workflows-pdf")
async def download_workflows_pdf(_admin: dict = Depends(require_admin)):
    """Return the user-workflow PDF. Admin-only."""
    pdf_path = ROOT_DIR.parent / "downloads" / "assetnova-user-workflows.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Workflows PDF not generated yet")
    return FileResponse(pdf_path, media_type="application/pdf", filename="assetnova-user-workflows.pdf")


@api_router.get("/download/test-cases-xlsx")
async def download_test_cases_xlsx(_admin: dict = Depends(require_admin)):
    """Return the manual QA test-cases workbook. Admin-only."""
    xlsx_path = ROOT_DIR.parent / "downloads" / "assetnova-manual-test-cases.xlsx"
    if not xlsx_path.exists():
        raise HTTPException(status_code=404, detail="Test cases XLSX not generated yet")
    return FileResponse(
        xlsx_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="assetnova-manual-test-cases.xlsx",
    )


@api_router.get("/rbac/landing")
async def rbac_landing():
    """Public map of role -> default landing route (frontend uses this after login)."""
    from rbac import ROLE_LANDING, MVP_ROLES
    return {"landing": ROLE_LANDING, "mvp_roles": list(MVP_ROLES)}


# Mount domain routers
api_router.include_router(auth_router)
api_router.include_router(ai_router)
api_router.include_router(core_router)
api_router.include_router(fleet_router)
api_router.include_router(rbac_router)
api_router.include_router(team_router)
api_router.include_router(client_router)
api_router.include_router(evidence_router)
api_router.include_router(qa_router)
api_router.include_router(fleet_admin_router)
api_router.include_router(workspace_router)

app.include_router(api_router)

cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip() and origin.strip() != "*"
]
if not cors_origins:
    raise RuntimeError("CORS_ORIGINS must contain at least one explicit origin; wildcard CORS is disabled")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.ai_sessions.create_index("user_id")
    await db.ai_messages.create_index("session_id")
    await db.report_schedules.create_index("user_id", unique=True)
    await db.portfolios.create_index([("user_id", 1), ("id", 1)])
    await db.alerts.create_index([("user_id", 1), ("created_at", -1)])
    await db.snapshots.create_index("token", unique=True)
    await db.snapshots.create_index("expires_at", expireAfterSeconds=0)
    await db.branding.create_index("user_id", unique=True)
    await db.actions.create_index([("user_id", 1), ("created_at", -1)])
    await db.login_attempts.create_index("identifier")
    await db.fleet_sites.create_index("site_id", unique=True)
    await db.fleet_assets.create_index("asset_id", unique=True)
    await db.fleet_audit_log.create_index("timestamp")
    await db.workspace_config.create_index("id", unique=True)
    await db.workspace_audit.create_index("at")

    # Seed admin only when a deployment secret is explicitly configured.
    # Existing accounts are never reset to a known password during startup.
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@assetnova.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "").strip()
    existing = await db.users.find_one({"email": admin_email})
    if not existing and admin_password:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "roles": ["admin"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not existing:
        logging.warning("[SECURITY] ADMIN_PASSWORD is not set; no administrator account was seeded")
    else:
        updates = {}
        # Ensure admin is always in the roles array so they can never be self-locked
        # out of the super-role by /rbac/switch
        current_roles = existing.get("roles") or []
        if "admin" not in current_roles:
            updates["roles"] = list(dict.fromkeys(["admin"] + current_roles))
            updates["role"] = "admin"  # restore super-role
        if updates:
            await db.users.update_one({"email": admin_email}, {"$set": updates})

    # Seed dataset (idempotent — only runs if fleet_sites is empty)
    try:
        result = await seed_if_empty(db)
        logging.info("[STARTUP] Dataset seed status: %s", result)
    except Exception as e:  # noqa: BLE001
        logging.exception("[STARTUP] Dataset seed failed: %s", e)

    # Migrate legacy `user` role → `executive` (safest read-only viewer)
    migrated = await db.users.update_many({"role": "user"}, {"$set": {"role": "executive"}})
    if migrated.modified_count:
        logging.info("[STARTUP] Migrated %d legacy 'user' role -> 'executive'", migrated.modified_count)

    # Rebrand migration: rename any @greensolutions.ai accounts to @assetnova.com
    # (idempotent — only touches rows that still have the old domain)
    legacy_users = await db.users.find({"email": {"$regex": "@greensolutions\\.ai$", "$options": "i"}}).to_list(50)
    for u in legacy_users:
        new_email = u["email"].lower().replace("@greensolutions.ai", "@assetnova.com")
        # If the target email doesn't already exist, rename. Otherwise drop the stale row.
        clash = await db.users.find_one({"email": new_email})
        if clash and clash["id"] != u["id"]:
            await db.users.delete_one({"id": u["id"]})
        else:
            await db.users.update_one({"id": u["id"]}, {"$set": {"email": new_email}})
    if legacy_users:
        logging.info("[STARTUP] Rebranded %d legacy @greensolutions.ai accounts -> @assetnova.com", len(legacy_users))

    # Demo accounts are opt-in and passwords must be supplied as secrets.
    # Published legacy passwords are invalidated on startup.
    demo_accounts = [
        {"email": "executive@assetnova.com", "name": "Ellie Executive", "role": "executive", "env": "DEMO_EXECUTIVE_PASSWORD"},
        {"email": "assetmgr@assetnova.com", "name": "Alex Asset Mgr", "role": "asset_manager", "env": "DEMO_ASSET_MANAGER_PASSWORD"},
        {"email": "ops@assetnova.com", "name": "Omar O&M Mgr", "role": "om_manager", "env": "DEMO_OM_MANAGER_PASSWORD"},
        {"email": "tech@assetnova.com", "name": "Tara Technician", "role": "technician", "env": "DEMO_TECHNICIAN_PASSWORD"},
        {"email": "perf@assetnova.com", "name": "Pat Performance Eng", "role": "performance_engineer", "env": "DEMO_PERFORMANCE_PASSWORD"},
        {"email": "client@assetnova.com", "name": "Chris Client Viewer", "role": "client_viewer", "env": "DEMO_CLIENT_VIEWER_PASSWORD"},
    ]
    for acc in demo_accounts:
        configured_password = os.environ.get(acc["env"], "").strip()
        exists = await db.users.find_one({"email": acc["email"]})
        if not exists and configured_password:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": acc["email"],
                "password_hash": hash_password(configured_password),
                "name": acc["name"],
                "role": acc["role"],
                "roles": [acc["role"]],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logging.info("[STARTUP] Seeded demo account: %s (%s)", acc["email"], acc["role"])
        elif exists:
            updates = {}
            # ensure `roles` array exists on legacy demo docs
            if "roles" not in exists:
                updates["roles"] = [exists.get("role", "executive")]
            if updates:
                await db.users.update_one({"id": exists["id"]}, {"$set": updates})

    # One-time rotation invalidates every credential that was historically
    # distributed with the source repository. Configured secrets remain usable;
    # accounts without a configured replacement receive an unknown random value.
    migration_id = "2026-09-remove-published-passwords"
    migrated_security = await db.security_migrations.find_one({"id": migration_id})
    if not migrated_security:
        rotations = [(admin_email, admin_password)] + [
            (acc["email"], os.environ.get(acc["env"], "").strip())
            for acc in demo_accounts
        ]
        for email, configured_password in rotations:
            account = await db.users.find_one({"email": email})
            if account:
                replacement = configured_password or secrets.token_urlsafe(48)
                await db.users.update_one(
                    {"id": account["id"]},
                    {"$set": {"password_hash": hash_password(replacement)}},
                )
        await db.security_migrations.insert_one({
            "id": migration_id,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        logging.warning("[SECURITY] Rotated all historically published account credentials")

    # Give the client_viewer demo a default scope of 20 solar sites
    client_user = await db.users.find_one({"email": "client@assetnova.com"})
    if client_user and not client_user.get("client_scope"):
        sample_sites = await db.fleet_sites.find(
            {"site_type": "Utility-Scale Solar"}, {"_id": 0, "site_id": 1}
        ).limit(20).to_list(20)
        await db.users.update_one(
            {"id": client_user["id"]},
            {"$set": {"client_scope": {
                "allowed_site_ids": [s["site_id"] for s in sample_sites],
                "allowed_categories": [],
            }}},
        )
        logging.info("[STARTUP] Seeded default client_scope for client_viewer demo (%d sites)", len(sample_sites))

    # Initialise Emergent Object Storage (for evidence uploads)
    try:
        storage.init_storage()
    except Exception as e:  # noqa: BLE001
        logging.warning("[STARTUP] Storage init deferred: %s", e)

    # Regenerate QA artefacts (PDF workflows + XLSX test cases) so downloads
    # stay in sync with feature changes on every boot. Non-blocking on failure.
    try:
        from generate_qa_artifacts import build_pdf, build_xlsx
        build_pdf()
        build_xlsx()
        logging.info("[STARTUP] Regenerated QA artefacts (PDF + XLSX)")
    except Exception as e:  # noqa: BLE001
        logging.warning("[STARTUP] QA artefact regeneration skipped: %s", e)

    # Purge earlier test junk accounts so the Administration table stays clean.
    # Keep: the 5 demo accounts + the seeded admin + anything with a real domain.
    junk_domains = ["@test.com", "@example.com", "@t.com"]
    junk_query = {"$or": [{"email": {"$regex": f".*{d}$", "$options": "i"}} for d in junk_domains]}
    purged = await db.users.delete_many(junk_query)
    if purged.deleted_count:
        logging.info("[STARTUP] Purged %d legacy test accounts", purged.deleted_count)


@app.on_event("shutdown")
async def shutdown_db_client():
    close_db_client()
