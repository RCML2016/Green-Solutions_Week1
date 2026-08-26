"""Auth routes: register / login / me / forgot / reset / change-password."""
import os
import uuid
import logging
import secrets
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Depends, Request

from deps import (
    db,
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from models import (
    RegisterRequest,
    LoginRequest,
    ForgotRequest,
    ResetRequest,
    ChangePasswordRequest,
)

router = APIRouter(tags=["auth"])

LOGIN_MAX_ATTEMPTS = 5
LOGIN_LOCK_MINUTES = 15


@router.post("/auth/register")
async def register(payload: RegisterRequest):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    role = payload.role or "executive"
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": role,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": email, "name": payload.name, "role": role},
    }


@router.post("/auth/login")
async def login(payload: LoginRequest, request: Request):
    email = payload.email.lower()
    identifier = email
    now = datetime.now(timezone.utc)

    record = await db.login_attempts.find_one({"identifier": identifier})
    if record and record.get("locked_until"):
        locked_until = record["locked_until"]
        if isinstance(locked_until, str):
            locked_until = datetime.fromisoformat(locked_until)
        if locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        if now < locked_until:
            wait_min = int((locked_until - now).total_seconds() / 60) + 1
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Try again in ~{wait_min} min.",
            )

    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        attempts = (record.get("count", 0) if record else 0) + 1
        update = {"count": attempts, "last_failed": now.isoformat()}
        if attempts >= LOGIN_MAX_ATTEMPTS:
            update["locked_until"] = (now + timedelta(minutes=LOGIN_LOCK_MINUTES)).isoformat()
            update["count"] = 0
        await db.login_attempts.update_one(
            {"identifier": identifier},
            {"$set": update, "$setOnInsert": {"identifier": identifier}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Invalid email or password")

    await db.login_attempts.delete_one({"identifier": identifier})
    token = create_access_token(user["id"], email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "email": user["email"],
            "name": user["name"],
            "role": user.get("role", "user"),
        },
    }


@router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "used": False,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        })
        frontend_url = os.environ.get("FRONTEND_URL", "").rstrip("/")
        reset_link = f"{frontend_url}/reset-password?token={token}"
        logging.info(f"[PASSWORD RESET] Link for {email}: {reset_link}")
        return {"ok": True, "message": "If an account exists, a reset link has been generated.", "demo_reset_link": reset_link}
    return {"ok": True, "message": "If an account exists, a reset link has been generated.", "demo_reset_link": None}


@router.post("/auth/reset-password")
async def reset_password(payload: ResetRequest):
    record = await db.password_reset_tokens.find_one({"token": payload.token})
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if record.get("used"):
        raise HTTPException(status_code=400, detail="This reset link has already been used")
    expires = record["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="This reset link has expired")
    await db.users.update_one(
        {"id": record["user_id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    await db.password_reset_tokens.update_one(
        {"token": payload.token},
        {"$set": {"used": True}},
    )
    return {"ok": True, "message": "Password updated. You can sign in now."}


@router.post("/auth/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)):
    record = await db.users.find_one({"id": user["id"]})
    if not record:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(payload.current_password, record["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    return {"ok": True, "message": "Password updated."}
