"""QA Tracker — surface manual test cases from the generator + persist test-run
results to MongoDB so any admin can tick through them and see pass/fail counts."""
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from deps import db, require_admin
from generate_qa_artifacts import _build_test_cases

router = APIRouter(prefix="/qa", tags=["qa"])

ALLOWED_STATUSES = {"Not Run", "Passed", "Failed", "Blocked"}


class QaResultUpdate(BaseModel):
    test_id: str
    status: str
    notes: str = ""


@router.get("/test-cases")
async def list_test_cases(_admin: dict = Depends(require_admin)):
    """Return the canonical test-case list (source: generate_qa_artifacts.py)
    merged with the latest run status per test_id from `qa_results`."""
    cases = _build_test_cases()

    # Fetch latest result per test_id
    pipeline = [
        {"$sort": {"run_at": -1}},
        {"$group": {"_id": "$test_id", "doc": {"$first": "$$ROOT"}}},
    ]
    latest = await db.qa_results.aggregate(pipeline).to_list(500)
    latest_by_id = {row["_id"]: row["doc"] for row in latest}

    merged = []
    for c in cases:
        r = latest_by_id.get(c["id"], {})
        merged.append({
            **c,
            "status": r.get("status", "Not Run"),
            "notes": r.get("notes", ""),
            "last_run_at": r.get("run_at"),
            "last_run_by": r.get("tester_email"),
        })
    return {"count": len(merged), "test_cases": merged}


@router.post("/results")
async def upsert_result(payload: QaResultUpdate, admin: dict = Depends(require_admin)):
    """Append a run result for a test-case. Status must be one of the allowed
    values. Latest run wins in `/test-cases`."""
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail=f"status must be one of {sorted(ALLOWED_STATUSES)}")

    doc = {
        "id": str(uuid.uuid4()),
        "test_id": payload.test_id,
        "status": payload.status,
        "notes": payload.notes.strip(),
        "tester_email": admin["email"],
        "run_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.qa_results.insert_one(doc)
    return {"ok": True, "run": {k: v for k, v in doc.items() if k != "_id"}}


@router.get("/summary")
async def summary(_admin: dict = Depends(require_admin)):
    """Aggregate stats: total / passed / failed / blocked / not-run + by-role
    breakdown. Uses only the LATEST run per test_id."""
    cases = _build_test_cases()

    pipeline = [
        {"$sort": {"run_at": -1}},
        {"$group": {"_id": "$test_id", "status": {"$first": "$status"}}},
    ]
    latest = await db.qa_results.aggregate(pipeline).to_list(500)
    status_by_id = {row["_id"]: row["status"] for row in latest}

    total = len(cases)
    counts = {"Passed": 0, "Failed": 0, "Blocked": 0, "Not Run": 0}
    by_role = {}
    for c in cases:
        s = status_by_id.get(c["id"], "Not Run")
        counts[s] = counts.get(s, 0) + 1
        by_role.setdefault(c["role"], {"total": 0, "Passed": 0, "Failed": 0, "Blocked": 0, "Not Run": 0})
        by_role[c["role"]]["total"] += 1
        by_role[c["role"]][s] += 1

    return {
        "total": total,
        "counts": counts,
        "pass_rate_pct": round(100 * counts["Passed"] / total, 1) if total else 0,
        "by_role": by_role,
    }
