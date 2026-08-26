from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import secrets
import random
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone


# --- Config ---
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 24  # 24h for demo simplicity

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Green Solutions API")
api_router = APIRouter(prefix="/api")


# --- Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# --- Models ---
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    name: str = Field(min_length=1, max_length=80)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: EmailStr
    message: str = Field(min_length=1, max_length=2000)


class ForgotRequest(BaseModel):
    email: EmailStr


class ResetRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=6, max_length=128)


class InsightRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    finding_code: Optional[str] = None


# --- Startup ---
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await db.password_reset_tokens.create_index("token", unique=True)
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


# --- Routes ---
@api_router.get("/")
async def root():
    return {"message": "Green Solutions API"}


@api_router.post("/auth/register")
async def register(payload: RegisterRequest):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "name": payload.name,
        "role": "user",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    token = create_access_token(user_id, email)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user_id, "email": email, "name": payload.name, "role": "user"},
    }


@api_router.post("/auth/login")
async def login(payload: LoginRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
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


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.post("/contact")
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


@api_router.get("/portfolio/metrics")
async def portfolio_metrics(user: dict = Depends(get_current_user)):
    # Jittered live-feel metrics — refreshed on every poll
    def jitter(base, spread=1.5, lo=None, hi=None):
        v = base + random.uniform(-spread, spread)
        if lo is not None: v = max(lo, v)
        if hi is not None: v = min(hi, v)
        return round(v, 1)

    base_findings = [
        {"code": "INV-04", "title": "Communication Dropout", "severity": "high", "base_conf": 91},
        {"code": "INV-01", "title": "String Underperformance", "severity": "high", "base_conf": 83},
        {"code": "INV-07", "title": "Thermal Drift", "severity": "medium", "base_conf": 72},
        {"code": "INV-12", "title": "Soiling Anomaly", "severity": "medium", "base_conf": 68},
    ]
    findings = [
        {"code": f["code"], "title": f["title"], "severity": f["severity"],
         "confidence": max(1, min(99, int(f["base_conf"] + random.uniform(-2, 2))))}
        for f in base_findings
    ]
    return {
        "portfolio_health": jitter(80, 1.2, 60, 99),
        "portfolio_health_change": jitter(4.2, 0.6, -2, 8),
        "ai_findings": 4,
        "high_priority_findings": 2,
        "ai_confidence": jitter(84, 1.5, 60, 99),
        "assets_online": 128 + random.randint(-1, 1),
        "assets_total": 132,
        "energy_last_24h_mwh": jitter(2148.6, 12, 1900, 2400),
        "findings": findings,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotRequest):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    # Always return same response to avoid user enumeration
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


@api_router.post("/auth/reset-password")
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


@api_router.post("/ai/insight")
async def ai_insight(payload: InsightRequest, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    context = ""
    if payload.finding_code:
        context = f"\nThe operator is asking about finding {payload.finding_code}. Include severity, likely root cause, and one recommended action."

    system = (
        "You are the Green Solutions AI Insight Assistant — an explainable AI for renewable "
        "energy operations. Answer concisely (max 5 short sentences). Ground answers in solar/wind "
        "operations: inverters, strings, soiling, thermal drift, communication dropouts, curtailment. "
        "When you make a recommendation, prefix it with 'Action:'. Never invent SLAs or financials."
    )
    chat = LlmChat(
        api_key=api_key,
        session_id=f"insight-{user['id']}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")

    user_msg = UserMessage(text=payload.question + context)

    async def gen():
        try:
            async for ev in chat.stream_message(user_msg):
                if isinstance(ev, TextDelta):
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break
        except Exception as e:
            logging.exception("AI insight error")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
