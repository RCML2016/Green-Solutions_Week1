from __future__ import annotations
from typing import Any
from .adapters import KafkaDlq, KafkaPublisher, MemoryCheckpoints, RedisDedupe
from .connectors import CONNECTOR_TYPES, MappingRegistry
from .core import ConnectorConfig


def build_connector(kind:str,*,tenant_id:str,source:Any,kafka_bootstrap:str,redis_url:str,
                    asset_map:dict[str,str]|None=None,metric_map:dict[str,tuple[str,str,float]]|None=None):
    cls=CONNECTOR_TYPES[kind];publisher=KafkaPublisher(kafka_bootstrap)
    kwargs={"config":ConnectorConfig(kind,tenant_id,f"assetnova.canonical.{kind}"),"source":source,
            "publisher":publisher,"dedupe":RedisDedupe(redis_url),"checkpoints":MemoryCheckpoints(),"dlq":KafkaDlq(publisher)}
    if kind in {"solar_scada","inverter_tracker","bess_ems_bms"}:kwargs["registry"]=MappingRegistry(asset_map,metric_map)
    return cls(**kwargs)

