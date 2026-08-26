"""Green Solutions API — thin entry point.

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
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware

from deps import db, close_db_client, hash_password, verify_password
from seed_dataset import seed_if_empty
from routers.auth import router as auth_router
from routers.ai import router as ai_router
from routers.core import router as core_router
from routers.fleet import router as fleet_router


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

app = FastAPI(title="Green Solutions API")

api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"message": "Green Solutions API"}


@api_router.get("/healthz")
async def healthz():
    fleet_sites = await db.fleet_sites.estimated_document_count()
    return {"ok": True, "fleet_sites": fleet_sites, "time": datetime.now(timezone.utc).isoformat()}


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

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@greensolutions.ai").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Admin",
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

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

    # Seed demo accounts, one per MVP role — idempotent
    demo_accounts = [
        {"email": "executive@greensolutions.ai",    "name": "Ellie Executive",   "role": "executive",     "password": "Executive@123"},
        {"email": "assetmgr@greensolutions.ai",     "name": "Alex Asset Mgr",    "role": "asset_manager", "password": "Asset@123"},
        {"email": "ops@greensolutions.ai",          "name": "Omar O&M Mgr",      "role": "om_manager",    "password": "Ops@123"},
        {"email": "tech@greensolutions.ai",         "name": "Tara Technician",   "role": "technician",    "password": "Tech@123"},
    ]
    for acc in demo_accounts:
        exists = await db.users.find_one({"email": acc["email"]})
        if not exists:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": acc["email"],
                "password_hash": hash_password(acc["password"]),
                "name": acc["name"],
                "role": acc["role"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logging.info("[STARTUP] Seeded demo account: %s (%s)", acc["email"], acc["role"])

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
