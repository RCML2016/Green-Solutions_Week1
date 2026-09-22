from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4
from .core import BaseConnector
from .errors import MappingNotFound, ValidationError
from .models import CanonicalEvent, Quality, RawRecord, stable_key, utc_datetime


class MappingRegistry:
    def __init__(self, asset_map: dict[str, str] | None = None,
                 metric_map: dict[str, tuple[str, str, float]] | None = None) -> None:
        self.asset_map = asset_map or {}
        self.metric_map = metric_map or {}

    def asset(self, source_id: str) -> str:
        try: return self.asset_map[source_id]
        except KeyError as exc: raise MappingNotFound(f"unknown asset: {source_id}") from exc

    def metric(self, source_tag: str) -> tuple[str, str, float]:
        try: return self.metric_map[source_tag]
        except KeyError as exc: raise MappingNotFound(f"unknown metric/tag: {source_tag}") from exc


class CanonicalConnector(BaseConnector):
    event_type = "telemetry"

    def _event(self, raw: RawRecord, *, event_ts: Any, site_id: str | None,
               asset_id: str | None, payload: dict[str, Any], identity: tuple[Any, ...],
               quality: str = "GOOD", sequence_no: int | None = None) -> CanonicalEvent:
        ts = utc_datetime(event_ts)
        key = stable_key(raw.source_system, *identity)
        return CanonicalEvent(str(uuid4()), self.event_type, "1.0", self.config.tenant_id,
            raw.source_system, self.config.connector_id, ts, datetime.now(timezone.utc), key,
            payload, site_id, asset_id, sequence_no, quality=Quality(quality))


class SolarScadaConnector(CanonicalConnector):
    def __init__(self, *args: Any, registry: MappingRegistry, **kwargs: Any):
        super().__init__(*args, **kwargs); self.registry = registry
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload; asset=self.registry.asset(p["device_id"]); metric, unit, factor=self.registry.metric(p["tag"])
        value=float(p["value"])*factor
        return self._event(raw,event_ts=p["timestamp"],site_id=p["site_id"],asset_id=asset,
            payload={"metric":metric,"value":value,"unit":unit,"source_tag":p["tag"]},
            identity=(asset,metric,p["timestamp"]),quality=p.get("quality","GOOD"),sequence_no=p.get("sequence"))


class InverterTrackerConnector(CanonicalConnector):
    def __init__(self,*args:Any,registry:MappingRegistry,**kwargs:Any): super().__init__(*args,**kwargs); self.registry=registry
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload; asset=self.registry.asset(p["equipment_id"]); metric,unit,factor=self.registry.metric(p["metric"])
        return self._event(raw,event_ts=p["observed_at"],site_id=p["site_id"],asset_id=asset,
            payload={"metric":metric,"value":float(p["value"])*factor,"unit":unit,"vendor_alarm":p.get("alarm_code")},
            identity=(asset,metric,p["observed_at"]))


class BessEmsBmsConnector(CanonicalConnector):
    def __init__(self,*args:Any,registry:MappingRegistry,**kwargs:Any): super().__init__(*args,**kwargs); self.registry=registry
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload; asset=self.registry.asset(p["system_id"]); metric,unit,factor=self.registry.metric(p["signal"])
        hierarchy=p.get("rack_id") or p.get("container_id")
        if not hierarchy: raise ValidationError("BESS hierarchy requires rack_id or container_id")
        return self._event(raw,event_ts=p["timestamp"],site_id=p["site_id"],asset_id=asset,
            payload={"metric":metric,"value":float(p["value"])*factor,"unit":unit,"hierarchy_id":hierarchy,"alarm":p.get("alarm")},
            identity=(asset,hierarchy,metric,p["timestamp"]),quality=p.get("quality","GOOD"),sequence_no=p.get("sequence"))


class WeatherConnector(CanonicalConnector):
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload; kind=p.get("kind","observation")
        if kind not in {"observation","forecast"}: raise ValidationError("weather kind must be observation or forecast")
        valid_ts=p["valid_at"] if kind=="forecast" else p["observed_at"]
        payload={"metric":p["metric"],"value":float(p["value"]),"unit":p["unit"],"kind":kind,"provider":p["provider"]}
        if kind=="forecast": payload["issued_at"]=utc_datetime(p["issued_at"]).isoformat()
        return self._event(raw,event_ts=valid_ts,site_id=p["site_id"],asset_id=p.get("station_id"),payload=payload,
            identity=(p["site_id"],kind,p["provider"],p["metric"],valid_ts),quality=p.get("quality","GOOD"))


class CmmsEamConnector(CanonicalConnector):
    event_type="work_order"
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload
        if p["status"] not in {"NEW","APPROVED","IN_PROGRESS","WAITING_PARTS","COMPLETED","CANCELLED"}: raise ValidationError("invalid work-order status")
        return self._event(raw,event_ts=p["modified_at"],site_id=p.get("site_id"),asset_id=p.get("asset_id"),payload=p,
            identity=(p["work_order_id"],p["modified_at"]))


class MeterConnector(CanonicalConnector):
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload
        if p["register"] not in {"import_kwh","export_kwh","interval_kw","cumulative_export_kwh"}: raise ValidationError("unknown meter register")
        return self._event(raw,event_ts=p["interval_start"],site_id=p["site_id"],asset_id=p["meter_id"],
            payload={"metric":p["register"],"value":float(p["value"]),"unit":p["unit"],"revision":int(p.get("revision",0)),"flags":p.get("flags",[])},
            identity=(p["meter_id"],p["interval_start"],p["register"],p.get("revision",0)))


class TechnicianAppConnector(CanonicalConnector):
    event_type="technician_event"
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload
        if not p.get("client_event_id"): raise ValidationError("offline-safe client_event_id is required")
        payload={k:v for k,v in p.items() if k not in {"technician_email","technician_phone"}}
        return self._event(raw,event_ts=p["occurred_at"],site_id=p.get("site_id"),asset_id=p.get("asset_id"),payload=payload,
            identity=(p["client_event_id"],p["modified_at"]),sequence_no=p.get("entity_version"))


class EnterpriseConnector(CanonicalConnector):
    event_type="enterprise_event"
    def normalize(self, raw: RawRecord) -> CanonicalEvent:
        p=raw.payload
        if p["entity_type"] not in {"purchase_order","invoice","warranty_claim","contract_sla"}: raise ValidationError("unsupported enterprise entity")
        if p.get("amount") is not None and not p.get("currency"): raise ValidationError("currency required when amount is present")
        return self._event(raw,event_ts=p["modified_at"],site_id=p.get("site_id"),asset_id=p.get("asset_id"),payload=p,
            identity=(p["entity_type"],p["entity_id"],p["modified_at"]))


CONNECTOR_TYPES={"solar_scada":SolarScadaConnector,"inverter_tracker":InverterTrackerConnector,
 "bess_ems_bms":BessEmsBmsConnector,"weather":WeatherConnector,"cmms_eam":CmmsEamConnector,
 "meters":MeterConnector,"technician_apps":TechnicianAppConnector,"enterprise":EnterpriseConnector}

