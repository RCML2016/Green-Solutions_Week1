from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import logging
from .errors import MappingNotFound, TransientSourceError, ValidationError
from .models import CanonicalEvent, RawRecord
from .ports import CheckpointStore, DeadLetterSink, DedupeStore, EventSink, Publisher, Source

log = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class ConnectorConfig:
    connector_id: str
    tenant_id: str
    output_topic: str
    dedupe_ttl_seconds: int = 604800
    max_retries: int = 8
    retry_base_seconds: float = 0.25


@dataclass(slots=True)
class RunStats:
    read: int = 0
    published: int = 0
    duplicated: int = 0
    dead_lettered: int = 0
    retries: int = 0


class BaseConnector(ABC):
    def __init__(self, config: ConnectorConfig, source: Source, publisher: Publisher,
                 dedupe: DedupeStore, checkpoints: CheckpointStore, dlq: DeadLetterSink,
                 sink: EventSink | None = None) -> None:
        self.config, self.source, self.publisher = config, source, publisher
        self.dedupe, self.checkpoints, self.dlq, self.sink = dedupe, checkpoints, dlq, sink

    @abstractmethod
    def normalize(self, raw: RawRecord) -> CanonicalEvent: ...

    async def run_once(self) -> RunStats:
        stats = RunStats()
        checkpoint = await self.checkpoints.get(self.config.connector_id)
        try:
            async for raw in self.source.records(checkpoint):
                stats.read += 1
                await self._process(raw, stats)
                if raw.cursor is not None:
                    await self.checkpoints.save(self.config.connector_id, raw.cursor)
        except TransientSourceError as exc:
            await self._retry_source(exc, stats)
        return stats

    async def _process(self, raw: RawRecord, stats: RunStats) -> None:
        try:
            event = self.normalize(raw)
            self._validate(event)
        except MappingNotFound as exc:
            stats.dead_lettered += 1
            await self.dlq.write(raw, self.config.connector_id, "MAPPING_NOT_FOUND", str(exc))
            return
        except (ValidationError, ValueError, KeyError, TypeError) as exc:
            stats.dead_lettered += 1
            await self.dlq.write(raw, self.config.connector_id, "VALIDATION_FAILED", str(exc))
            return
        if not await self.dedupe.claim(event.idempotency_key, self.config.dedupe_ttl_seconds):
            stats.duplicated += 1
            return
        if self.sink is not None:
            await self.sink.write(event)
        await self.publisher.publish(self.config.output_topic, event.idempotency_key, event.to_json())
        stats.published += 1

    def _validate(self, event: CanonicalEvent) -> None:
        if not event.tenant_id or not event.source_system or not event.event_type:
            raise ValidationError("missing event identity")
        if event.event_ts.tzinfo is None:
            raise ValidationError("event timestamp must be timezone-aware")
        if event.event_ts > datetime.now(timezone.utc) + timedelta(minutes=5):
            raise ValidationError("event timestamp exceeds five-minute clock-skew allowance")
        if not event.idempotency_key:
            raise ValidationError("missing idempotency key")

    async def _retry_source(self, original: Exception, stats: RunStats) -> None:
        for attempt in range(1, self.config.max_retries + 1):
            stats.retries += 1
            await asyncio.sleep(min(self.config.retry_base_seconds * (2 ** (attempt - 1)), 30))
            try:
                async for raw in self.source.records(await self.checkpoints.get(self.config.connector_id)):
                    stats.read += 1
                    await self._process(raw, stats)
                    if raw.cursor is not None:
                        await self.checkpoints.save(self.config.connector_id, raw.cursor)
                return
            except TransientSourceError:
                continue
        raise original
