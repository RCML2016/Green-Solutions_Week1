"""Pure Solar SCADA pilot parsing, mapping, validation and normalization."""
from __future__ import annotations

import csv
import hashlib
import io
import math
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List

REQUIRED_COLUMNS = {"site_id", "device_id", "tag", "timestamp", "value"}
ALLOWED_QUALITY = {"GOOD", "UNCERTAIN", "BAD", "STALE"}


class PilotValidationError(ValueError):
    """A customer row cannot be converted into a canonical telemetry event."""


def parse_csv(content: bytes, max_rows: int = 10_000) -> List[dict]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise PilotValidationError("CSV must be UTF-8 encoded") from exc
    reader = csv.DictReader(io.StringIO(text))
    columns = {str(c or "").strip() for c in (reader.fieldnames or [])}
    missing = sorted(REQUIRED_COLUMNS - columns)
    if missing:
        raise PilotValidationError(f"Missing required columns: {', '.join(missing)}")
    rows = []
    for row_number, row in enumerate(reader, start=2):
        if row_number > max_rows + 1:
            raise PilotValidationError(f"CSV exceeds {max_rows:,} data rows")
        clean = {str(k).strip(): (v.strip() if isinstance(v, str) else v) for k, v in row.items() if k}
        if any(v not in (None, "") for v in clean.values()):
            clean["_row_number"] = row_number
            rows.append(clean)
    if not rows:
        raise PilotValidationError("CSV contains no data rows")
    return rows


def _utc(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (AttributeError, ValueError) as exc:
        raise PilotValidationError("timestamp must be ISO-8601 text") from exc
    if parsed.tzinfo is None:
        raise PilotValidationError("timestamp must include a timezone")
    parsed = parsed.astimezone(timezone.utc)
    if parsed > datetime.now(timezone.utc).replace(microsecond=0):
        raise PilotValidationError("timestamp cannot be in the future")
    return parsed


def normalize_row(row: dict, mapping: dict, source_system: str) -> dict:
    assets = mapping.get("assets") or {}
    tags = mapping.get("tags") or {}
    device_id = row.get("device_id", "")
    source_tag = row.get("tag", "")
    asset = assets.get(device_id)
    tag = tags.get(source_tag)
    if not asset:
        raise PilotValidationError(f"No asset mapping for device_id '{device_id}'")
    if not tag:
        raise PilotValidationError(f"No tag mapping for tag '{source_tag}'")
    if row.get("site_id") != asset.get("site_id"):
        raise PilotValidationError(
            f"site_id '{row.get('site_id')}' does not match mapped site '{asset.get('site_id')}'"
        )
    quality = (row.get("quality") or "GOOD").upper()
    if quality not in ALLOWED_QUALITY:
        raise PilotValidationError(f"Unsupported quality '{quality}'")
    timestamp = _utc(row.get("timestamp", ""))
    try:
        value = float(row.get("value", "")) * float(tag.get("factor", 1))
    except (TypeError, ValueError) as exc:
        raise PilotValidationError("value must be numeric") from exc
    if not math.isfinite(value):
        raise PilotValidationError("value must be finite")
    minimum, maximum = tag.get("min"), tag.get("max")
    if minimum is not None and value < float(minimum):
        raise PilotValidationError(f"value {value} is below minimum {minimum}")
    if maximum is not None and value > float(maximum):
        raise PilotValidationError(f"value {value} exceeds maximum {maximum}")

    identity = "|".join([
        source_system, asset["asset_id"], tag["metric"], timestamp.isoformat(), str(row.get("sequence") or "")
    ])
    return {
        "idempotency_key": hashlib.sha256(identity.encode()).hexdigest(),
        "schema_version": "1.0",
        "event_type": "telemetry",
        "source_system": source_system,
        "site_id": asset["site_id"],
        "asset_id": asset["asset_id"],
        "event_ts": timestamp.isoformat(),
        "quality": quality,
        "sequence_no": int(row["sequence"]) if row.get("sequence") else None,
        "payload": {
            "metric": tag["metric"],
            "value": value,
            "unit": tag["unit"],
            "source_tag": source_tag,
            "source_device_id": device_id,
        },
    }


def fleet_telemetry_projection(event: dict) -> dict:
    metric_to_field = {
        "ac_power_kw": "power_kW",
        "expected_power_kw": "expected_power_kW",
        "inverter_temp_c": "temperature_C",
        "inverter_efficiency_pct": "efficiency_pct",
    }
    metric = event["payload"]["metric"]
    field = metric_to_field.get(metric)
    result = {
        "site_id": event["site_id"], "asset_id": event["asset_id"],
        "timestamp": event["event_ts"], "source": "solar_scada_pilot",
        "idempotency_key": event["idempotency_key"],
    }
    if field:
        result[field] = event["payload"]["value"]
    return result

