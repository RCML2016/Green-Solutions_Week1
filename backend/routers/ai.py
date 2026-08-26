"""AI insight streaming + session history routes."""
import os
import json
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone

from deps import db, get_current_user
from models import InsightRequest

router = APIRouter(tags=["ai"])


@router.post("/ai/insight")
async def ai_insight(payload: InsightRequest, user: dict = Depends(get_current_user)):
    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")

    session_id = payload.session_id
    if not session_id:
        session_id = str(uuid.uuid4())
        default_title = payload.question[:60] + ("…" if len(payload.question) > 60 else "")
        await db.ai_sessions.insert_one({
            "id": session_id,
            "user_id": user["id"],
            "title": default_title,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    else:
        sess = await db.ai_sessions.find_one({"id": session_id, "user_id": user["id"]})
        if not sess:
            raise HTTPException(status_code=404, detail="Session not found")

    await db.ai_messages.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session_id,
        "role": "user",
        "text": payload.question,
        "finding_code": payload.finding_code,
        "auto": bool(payload.auto),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    context = ""
    if payload.finding_code:
        context = (
            f"\nThe operator is asking about finding {payload.finding_code}. "
            "Include severity, likely root cause, and one recommended action."
        )
    if payload.auto:
        context += "\nThis alert was auto-triggered because a new high-severity finding just appeared. Be brief and actionable."

    system = (
        "You are the Green Solutions AI Insight Assistant — an explainable AI for renewable "
        "energy operations. Answer concisely (max 5 short sentences). Ground answers in solar/wind "
        "operations: inverters, strings, soiling, thermal drift, communication dropouts, curtailment. "
        "When you make a recommendation, prefix it with 'Action:'. Never invent SLAs or financials."
    )
    chat = LlmChat(
        api_key=api_key,
        session_id=f"insight-{session_id}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-5")

    user_msg = UserMessage(text=payload.question + context)

    async def gen():
        full_text = ""
        try:
            yield f"data: {json.dumps({'session_id': session_id})}\n\n"
            async for ev in chat.stream_message(user_msg):
                if isinstance(ev, TextDelta):
                    full_text += ev.content
                    yield f"data: {json.dumps({'delta': ev.content})}\n\n"
                elif isinstance(ev, StreamDone):
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break
        except Exception as e:
            logging.exception("AI insight error")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if full_text:
                await db.ai_messages.insert_one({
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "role": "assistant",
                    "text": full_text,
                    "finding_code": payload.finding_code,
                    "auto": bool(payload.auto),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                await db.ai_sessions.update_one(
                    {"id": session_id},
                    {"$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
                )

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/ai/sessions")
async def list_ai_sessions(user: dict = Depends(get_current_user)):
    cursor = db.ai_sessions.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).sort("updated_at", -1).limit(50)
    return await cursor.to_list(50)


@router.get("/ai/sessions/{session_id}")
async def get_ai_session(session_id: str, user: dict = Depends(get_current_user)):
    sess = await db.ai_sessions.find_one({"id": session_id, "user_id": user["id"]}, {"_id": 0})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    msgs = await db.ai_messages.find({"session_id": session_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return {"session": sess, "messages": msgs}


@router.delete("/ai/sessions/{session_id}")
async def delete_ai_session(session_id: str, user: dict = Depends(get_current_user)):
    sess = await db.ai_sessions.find_one({"id": session_id, "user_id": user["id"]})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.ai_sessions.delete_one({"id": session_id})
    await db.ai_messages.delete_many({"session_id": session_id})
    return {"ok": True}
