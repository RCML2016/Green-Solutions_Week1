from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Protocol
from .models import CanonicalEvent, RawRecord


class Source(Protocol):
    async def records(self, checkpoint: str | None) -> AsyncIterator[RawRecord]: ...


class Publisher(Protocol):
    async def publish(self, topic: str, key: str, value: bytes) -> None: ...


class DedupeStore(Protocol):
    async def claim(self, key: str, ttl_seconds: int) -> bool: ...


class CheckpointStore(Protocol):
    async def get(self, connector_id: str) -> str | None: ...
    async def save(self, connector_id: str, cursor: str) -> None: ...


class DeadLetterSink(Protocol):
    async def write(self, record: RawRecord, connector_id: str, reason: str, detail: str) -> None: ...


class EventSink(Protocol):
    async def write(self, event: CanonicalEvent) -> None: ...

