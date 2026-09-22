from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from hashlib import sha256
from typing import Any
import json


class Quality(StrEnum):
    GOOD = "GOOD"
    UNCERTAIN = "UNCERTAIN"
    BAD = "BAD"
    STALE = "STALE"


@dataclass(frozen=True, slots=True)
class RawRecord:
    source_system: str
    payload: dict[str, Any]
    received_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    cursor: str | None = None


@dataclass(frozen=True, slots=True)
class CanonicalEvent:
    event_id: str
    event_type: str
    schema_version: str
    tenant_id: str
    source_system: str
    connector_id: str
    event_ts: datetime
    ingested_ts: datetime
    idempotency_key: str
    payload: dict[str, Any]
    site_id: str | None = None
    asset_id: str | None = None
    sequence_no: int | None = None
    correlation_id: str | None = None
    quality: Quality = Quality.GOOD

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["event_ts"] = self.event_ts.isoformat()
        data["ingested_ts"] = self.ingested_ts.isoformat()
        data["quality"] = self.quality.value
        return data

    def to_json(self) -> bytes:
        return json.dumps(self.to_dict(), separators=(",", ":"), sort_keys=True).encode()


def utc_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, (int, float)):
        dt = datetime.fromtimestamp(value, tz=timezone.utc)
    elif isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    else:
        raise ValueError("timestamp must be ISO-8601 text or epoch seconds")
    if dt.tzinfo is None:
        raise ValueError("timestamp must include a timezone")
    return dt.astimezone(timezone.utc)


def stable_key(*parts: Any) -> str:
    normalized = "|".join("" if p is None else str(p).strip() for p in parts)
    return sha256(normalized.encode()).hexdigest()

