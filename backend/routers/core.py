"""Contact form, portfolios, team, alerts, actions, snapshots, reports routers combined
for brevity (they share the same simple CRUD style)."""
import os
import uuid
import logging
import secrets
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from deps import db, get_current_user, require_admin, hash_password
from models import (
    ContactRequest,
    InviteRequest,
    ScheduleRequest,
    PortfolioCreate,
    AlertCreate,
    BrandingRequest,
    SnapshotCreate,
    ActionCreate,
)

router = APIRouter(tags=["core"])


# ---------------- Contact ----------------
@router.post("/contact")
async def contact(payload: ContactRequest):
    doc = {
        "id": str(uuid.uuid4()),
        "name": payload.name,
        "email": payload.email.lower(),
        "message": payload.message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.contact_messages.insert_one(doc)
    return {"ok": True, "message": "Thanks — we'll be in touch soon."}


# ---------------- Legacy portfolio metrics (kept for backward compat) ----------------
@router.get("/portfolio/metrics")
async def portfolio_metrics(portfolio_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    baseline_shift = 0
    if portfolio_id:
        p = await db.portfolios.find_one({"id": portfolio_id, "user_id": user["id"]})
        if not p:
            raise HTTPException(status_code=404, detail="Portfolio not found")
        baseline_shift = (sum(ord(c) for c in portfolio_id) % 7) - 3

    def jitter(base, spread=1.5, lo=None, hi=None):
        v = base + baseline_shift + random.uniform(-spread, spread)
        if lo is not None: v = max(lo, v)
        if hi is not None: v = min(hi, v)
        return round(v, 1)

    base_findings = [
        {"code": "INV-04", "title": "Communication Dropout", "severity": "high", "base_conf": 91},
        {"code": "INV-01", "title": "String Underperformance", "severity": "high", "base_conf": 83},
        {"code": "INV-07", "title": "Thermal Drift", "severity": "medium", "base_conf": 72},
        {"code": "INV-12", "title": "Soiling Anomaly", "severity": "medium", "base_conf": 68},
    ]
    rotating_pool = [
        {"code": "INV-09", "title": "Grid Curtailment Event", "severity": "high", "base_conf": 88},
        {"code": "STR-22", "title": "String Ground Fault", "severity": "high", "base_conf": 94},
        {"code": "INV-15", "title": "IGBT Overtemperature", "severity": "high", "base_conf": 87},
        {"code": "INV-03", "title": "DC Arc Detected", "severity": "high", "base_conf": 96},
    ]
    if random.random() < 0.15:
        base_findings = base_findings[:3] + [random.choice(rotating_pool)]
    findings = [
        {"code": f["code"], "title": f["title"], "severity": f["severity"],
         "confidence": max(1, min(99, int(f["base_conf"] + random.uniform(-2, 2))))}
        for f in base_findings
    ]
    high_count = sum(1 for f in findings if f["severity"] == "high")
    return {
        "portfolio_health": jitter(80, 1.2, 60, 99),
        "portfolio_health_change": jitter(4.2, 0.6, -2, 8),
        "ai_findings": len(findings),
        "high_priority_findings": high_count,
        "ai_confidence": jitter(84, 1.5, 60, 99),
        "assets_online": 128 + random.randint(-1, 1),
        "assets_total": 132,
        "energy_last_24h_mwh": jitter(2148.6, 12, 1900, 2400),
        "findings": findings,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


# ---------------- Portfolios ----------------
@router.get("/portfolios")
async def list_portfolios(user: dict = Depends(get_current_user)):
    items = await db.portfolios.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(50)
    if not items:
        default = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "name": "Main Renewable Fleet",
            "region": "Global",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.portfolios.insert_one(default)
        items = [default]
        items[0].pop("_id", None)
    return items


@router.post("/portfolios")
async def create_portfolio(payload: PortfolioCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name,
        "region": payload.region or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.portfolios.insert_one(doc)
    return {k: v for k, v in doc.items() if k != "_id"}


@router.delete("/portfolios/{portfolio_id}")
async def delete_portfolio(portfolio_id: str, user: dict = Depends(get_current_user)):
    res = await db.portfolios.delete_one({"id": portfolio_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return {"ok": True}


# ---------------- Team ----------------
@router.get("/team/users")
async def list_team(admin: dict = Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return users


@router.post("/team/invite")
async def invite_teammate(payload: InviteRequest, admin: dict = Depends(require_admin)):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="A user with that email already exists")
    temp_password = secrets.token_urlsafe(9)
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "email": email,
        "password_hash": hash_password(temp_password),
        "name": payload.name,
        "role": payload.role,
        "invited_by": admin["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    logging.info(f"[TEAM INVITE] {email} · role={payload.role} · temp password={temp_password}")
    return {
        "ok": True,
        "user": {"id": user_id, "email": email, "name": payload.name, "role": payload.role},
        "temporary_password": temp_password,
        "message": "User created. Share the temporary password securely — they should change it on first login.",
    }


@router.delete("/team/users/{user_id}")
async def remove_teammate(user_id: str, admin: dict = Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")
    result = await db.users.delete_one({"id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


# ---------------- Report Scheduling & Branding ----------------
@router.get("/reports/schedule")
async def get_report_schedule(user: dict = Depends(get_current_user)):
    cfg = await db.report_schedules.find_one({"user_id": user["id"]}, {"_id": 0})
    return cfg or {"user_id": user["id"], "frequency": "weekly", "recipients": [], "enabled": False}


@router.post("/reports/schedule")
async def set_report_schedule(payload: ScheduleRequest, user: dict = Depends(get_current_user)):
    doc = {
        "user_id": user["id"],
        "frequency": payload.frequency,
        "recipients": [r.lower() for r in payload.recipients],
        "enabled": payload.enabled,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.report_schedules.update_one(
        {"user_id": user["id"]},
        {"$set": doc, "$setOnInsert": {"created_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    if payload.enabled:
        logging.info(
            f"[REPORT SCHEDULE] user={user['email']} · {payload.frequency} → {payload.recipients}"
        )
    return {"ok": True, "schedule": doc}


@router.post("/reports/preview")
async def preview_report(user: dict = Depends(get_current_user)):
    cfg = await db.report_schedules.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    recipients = cfg.get("recipients", [])
    frequency = cfg.get("frequency", "weekly")
    logging.info(f"[REPORT PREVIEW] Would send {frequency} report to {recipients} for {user['email']}")
    return {
        "ok": True,
        "message": f"Preview logged: would send {frequency} report to {len(recipients)} recipient(s).",
        "recipients": recipients,
        "frequency": frequency,
    }


@router.get("/reports/branding")
async def get_branding(user: dict = Depends(get_current_user)):
    cfg = await db.branding.find_one({"user_id": user["id"]}, {"_id": 0})
    return cfg or {"user_id": user["id"], "company_name": "", "cover_note": "", "logo_data_url": ""}


@router.post("/reports/branding")
async def set_branding(payload: BrandingRequest, user: dict = Depends(get_current_user)):
    doc = {
        "user_id": user["id"],
        "company_name": payload.company_name,
        "cover_note": payload.cover_note,
        "logo_data_url": payload.logo_data_url,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.branding.update_one({"user_id": user["id"]}, {"$set": doc}, upsert=True)
    return {"ok": True, "branding": doc}


# ---------------- Alerts ----------------
@router.get("/alerts")
async def list_alerts(
    severity: Optional[str] = None,
    code: Optional[str] = None,
    since_hours: int = 168,
    user: dict = Depends(get_current_user),
):
    q = {"user_id": user["id"]}
    if severity:
        q["severity"] = severity
    if code:
        q["code"] = code
    cutoff = datetime.now(timezone.utc) - timedelta(hours=max(1, min(720, since_hours)))
    q["created_at"] = {"$gte": cutoff.isoformat()}
    items = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    return items


@router.post("/alerts")
async def push_alert(payload: AlertCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "code": payload.code,
        "title": payload.title,
        "severity": payload.severity,
        "confidence": payload.confidence,
        "portfolio_id": payload.portfolio_id,
        "acknowledged": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.alerts.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.post("/alerts/{alert_id}/acknowledge")
async def ack_alert(alert_id: str, user: dict = Depends(get_current_user)):
    res = await db.alerts.update_one({"id": alert_id, "user_id": user["id"]}, {"$set": {"acknowledged": True}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"ok": True}


# ---------------- Snapshots ----------------
@router.post("/snapshots")
async def create_snapshot(payload: SnapshotCreate, user: dict = Depends(get_current_user)):
    metrics_resp = await portfolio_metrics(portfolio_id=payload.portfolio_id, user=user)
    token = secrets.token_urlsafe(16)
    doc = {
        "id": str(uuid.uuid4()),
        "token": token,
        "user_id": user["id"],
        "portfolio_id": payload.portfolio_id,
        "title": payload.title or metrics_resp.get("server_time", "Snapshot"),
        "metrics": metrics_resp,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=14),
    }
    await db.snapshots.insert_one(doc)
    frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
    return {
        "ok": True,
        "token": token,
        "url": f"{frontend_url}/s/{token}",
        "expires_at": doc["expires_at"].isoformat(),
    }


@router.get("/public/snapshots/{token}")
async def get_snapshot(token: str):
    snap = await db.snapshots.find_one({"token": token}, {"_id": 0, "user_id": 0})
    if not snap:
        raise HTTPException(status_code=404, detail="Snapshot not found or expired")
    for k in ("created_at", "expires_at"):
        if isinstance(snap.get(k), datetime):
            snap[k] = snap[k].isoformat()
    return snap


@router.get("/snapshots")
async def list_snapshots(user: dict = Depends(get_current_user)):
    items = await db.snapshots.find(
        {"user_id": user["id"]},
        {"_id": 0, "metrics": 0},
    ).sort("created_at", -1).limit(200).to_list(200)
    for it in items:
        for k in ("created_at", "expires_at"):
            if isinstance(it.get(k), datetime):
                it[k] = it[k].isoformat()
    return items


@router.delete("/snapshots/{token}")
async def revoke_snapshot(token: str, user: dict = Depends(get_current_user)):
    res = await db.snapshots.delete_one({"token": token, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return {"ok": True}


# ---------------- Actions ----------------
@router.get("/actions")
async def list_actions(user: dict = Depends(get_current_user)):
    items = await db.actions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100).to_list(100)
    return items


@router.post("/actions")
async def create_action(payload: ActionCreate, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "finding_code": payload.finding_code,
        "finding_title": payload.finding_title,
        "action_text": payload.action_text,
        "status": "accepted",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.actions.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---------------- Weekly Digest (AI) ----------------
@router.post("/reports/weekly-digest")
async def weekly_digest(user: dict = Depends(get_current_user)):
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=168)
    alerts = await db.alerts.find(
        {"user_id": user["id"], "created_at": {"$gte": cutoff.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)
    actions = await db.actions.find(
        {"user_id": user["id"], "created_at": {"$gte": cutoff.isoformat()}},
        {"_id": 0}
    ).sort("created_at", -1).limit(100).to_list(100)

    alerts_summary = "\n".join(
        f"- {a['code']} · {a['severity'].upper()} · {a['title']} (conf {a['confidence']}%)"
        for a in alerts[:20]
    ) or "No alerts this week."
    actions_summary = "\n".join(
        f"- {a['finding_code']}: {a['action_text']}" for a in actions[:20]
    ) or "No accepted actions this week."

    system = (
        "You are the Green Solutions AI Digest Writer. In 4-6 short sentences, "
        "summarise the past week for a portfolio owner. Highlight top themes, "
        "biggest risks, and what got resolved. End with one 'Next week focus:' line. "
        "Use plain English, no jargon."
    )
    user_prompt = (
        f"WEEKLY ALERTS ({len(alerts)}):\n{alerts_summary}\n\n"
        f"ACCEPTED ACTIONS ({len(actions)}):\n{actions_summary}"
    )
    chat = LlmChat(
        api_key=api_key,
        session_id=f"digest-{user['id']}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")

    text = ""
    try:
        async for ev in chat.stream_message(UserMessage(text=user_prompt)):
            if isinstance(ev, TextDelta):
                text += ev.content
            elif isinstance(ev, StreamDone):
                break
    except Exception as e:
        logging.exception("Weekly digest failed")
        raise HTTPException(status_code=502, detail=f"AI digest failed: {e}")

    logging.info(f"[WEEKLY DIGEST] Generated for {user['email']} · {len(text)} chars")
    return {
        "ok": True,
        "digest": text,
        "alerts_count": len(alerts),
        "actions_count": len(actions),
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
