from __future__ import annotations

from collections.abc import AsyncIterator, Iterable
from datetime import datetime, timezone
import asyncio, json
from pathlib import Path
from typing import Any
from .models import CanonicalEvent, RawRecord


class ListSource:
    def __init__(self, source_system: str, items: Iterable[dict[str, Any]]): self.source_system, self.items=source_system,list(items)
    async def records(self, checkpoint: str | None) -> AsyncIterator[RawRecord]:
        start=int(checkpoint or 0)
        for index,payload in enumerate(self.items[start:],start=start): yield RawRecord(self.source_system,payload,cursor=str(index+1))


class JsonLinesSource:
    def __init__(self, source_system: str, path: str): self.source_system,self.path=source_system,Path(path)
    async def records(self, checkpoint: str | None) -> AsyncIterator[RawRecord]:
        start=int(checkpoint or 0)
        lines=await asyncio.to_thread(self.path.read_text,encoding="utf-8")
        for index,line in enumerate(lines.splitlines()[start:],start=start):
            if line.strip(): yield RawRecord(self.source_system,json.loads(line),cursor=str(index+1))


class MemoryPublisher:
    def __init__(self): self.messages=[]
    async def publish(self,topic:str,key:str,value:bytes)->None: self.messages.append((topic,key,value))
class MemoryDedupe:
    def __init__(self): self.keys=set()
    async def claim(self,key:str,ttl_seconds:int)->bool:
        if key in self.keys:return False
        self.keys.add(key);return True
class MemoryCheckpoints:
    def __init__(self): self.values={}
    async def get(self,connector_id:str)->str|None:return self.values.get(connector_id)
    async def save(self,connector_id:str,cursor:str)->None:self.values[connector_id]=cursor
class MemoryDlq:
    def __init__(self): self.records=[]
    async def write(self,record:RawRecord,connector_id:str,reason:str,detail:str)->None:self.records.append((record,connector_id,reason,detail))
class MemoryEventSink:
    def __init__(self): self.events:list[CanonicalEvent]=[]
    async def write(self,event:CanonicalEvent)->None:self.events.append(event)


class KafkaPublisher:
    def __init__(self,bootstrap_servers:str): self.bootstrap_servers=bootstrap_servers;self._producer=None
    async def start(self):
        from aiokafka import AIOKafkaProducer
        self._producer=AIOKafkaProducer(bootstrap_servers=self.bootstrap_servers,acks="all",enable_idempotence=True);await self._producer.start()
    async def publish(self,topic:str,key:str,value:bytes)->None:
        if self._producer is None: await self.start()
        await self._producer.send_and_wait(topic,value,key=key.encode())
    async def stop(self):
        if self._producer is not None: await self._producer.stop()


class RedisDedupe:
    def __init__(self,url:str):
        from redis.asyncio import from_url
        self.client=from_url(url,decode_responses=True)
    async def claim(self,key:str,ttl_seconds:int)->bool:return bool(await self.client.set(f"dedupe:{key}","1",ex=ttl_seconds,nx=True))


class KafkaDlq:
    def __init__(self,publisher:KafkaPublisher,topic:str="assetnova.dlq"):self.publisher,self.topic=publisher,topic
    async def write(self,record:RawRecord,connector_id:str,reason:str,detail:str)->None:
        body={"connector_id":connector_id,"source_system":record.source_system,"failed_at":datetime.now(timezone.utc).isoformat(),"reason":reason,"detail":detail,"cursor":record.cursor,"payload":record.payload}
        await self.publisher.publish(self.topic,f"{connector_id}:{record.cursor or 'unknown'}",json.dumps(body,separators=(",",":"),default=str).encode())


class PostgresStore:
    """Durable checkpoint store and canonical-event sink for PostgreSQL/TimescaleDB."""
    def __init__(self, dsn: str): self.dsn, self.pool = dsn, None
    async def start(self) -> None:
        import asyncpg
        self.pool = await asyncpg.create_pool(self.dsn, min_size=1, max_size=10)
        async with self.pool.acquire() as connection:
            await connection.execute("""
              CREATE TABLE IF NOT EXISTS connector_checkpoints(
                connector_id text PRIMARY KEY, cursor text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
              CREATE TABLE IF NOT EXISTS canonical_events(
                idempotency_key text PRIMARY KEY, event_id text NOT NULL, tenant_id text NOT NULL,
                connector_id text NOT NULL, event_type text NOT NULL, site_id text, asset_id text,
                event_ts timestamptz NOT NULL, ingested_ts timestamptz NOT NULL, payload jsonb NOT NULL);
              CREATE INDEX IF NOT EXISTS canonical_events_asset_time_idx
                ON canonical_events(tenant_id, asset_id, event_ts DESC);
            """)
    async def _ready(self):
        if self.pool is None: await self.start()
    async def get(self, connector_id: str) -> str | None:
        await self._ready()
        async with self.pool.acquire() as c: return await c.fetchval("SELECT cursor FROM connector_checkpoints WHERE connector_id=$1",connector_id)
    async def save(self, connector_id: str, cursor: str) -> None:
        await self._ready()
        async with self.pool.acquire() as c: await c.execute("INSERT INTO connector_checkpoints(connector_id,cursor) VALUES($1,$2) ON CONFLICT(connector_id) DO UPDATE SET cursor=EXCLUDED.cursor,updated_at=now()",connector_id,cursor)
    async def write(self, event: CanonicalEvent) -> None:
        await self._ready()
        async with self.pool.acquire() as c: await c.execute("""INSERT INTO canonical_events(idempotency_key,event_id,tenant_id,connector_id,event_type,site_id,asset_id,event_ts,ingested_ts,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) ON CONFLICT(idempotency_key) DO NOTHING""",event.idempotency_key,event.event_id,event.tenant_id,event.connector_id,event.event_type,event.site_id,event.asset_id,event.event_ts,event.ingested_ts,json.dumps(event.payload,default=str))
    async def stop(self) -> None:
        if self.pool is not None: await self.pool.close()
