from datetime import datetime, timedelta, timezone
import unittest
from assetnova_connectors.adapters import ListSource, MemoryCheckpoints, MemoryDedupe, MemoryDlq, MemoryEventSink, MemoryPublisher
from assetnova_connectors.connectors import (BessEmsBmsConnector,CmmsEamConnector,EnterpriseConnector,InverterTrackerConnector,MappingRegistry,MeterConnector,SolarScadaConnector,TechnicianAppConnector,WeatherConnector)
from assetnova_connectors.core import ConnectorConfig

NOW=(datetime.now(timezone.utc)-timedelta(minutes=1)).isoformat()
def deps(kind,items): return dict(config=ConnectorConfig(kind,"tenant-1",f"out.{kind}",retry_base_seconds=0),source=ListSource("test",items),publisher=MemoryPublisher(),dedupe=MemoryDedupe(),checkpoints=MemoryCheckpoints(),dlq=MemoryDlq(),sink=MemoryEventSink())
CASES=[
 ("solar_scada",SolarScadaConnector,{"device_id":"dev-1","tag":"PAC","site_id":"site-1","timestamp":NOW,"value":800,"quality":"GOOD"},MappingRegistry({"dev-1":"inv-1"},{"PAC":("ac_power_kw","kW",1)})),
 ("inverter_tracker",InverterTrackerConnector,{"equipment_id":"trk-1","metric":"angle","site_id":"site-1","observed_at":NOW,"value":20},MappingRegistry({"trk-1":"tracker-1"},{"angle":("tracker_angle_deg","deg",1)})),
 ("bess_ems_bms",BessEmsBmsConnector,{"system_id":"bess-1","rack_id":"rack-1","signal":"soc","site_id":"site-1","timestamp":NOW,"value":72},MappingRegistry({"bess-1":"bess-A"},{"soc":("soc_pct","pct",1)})),
 ("weather",WeatherConnector,{"site_id":"site-1","station_id":"wx-1","kind":"observation","provider":"station","metric":"ghi_w_m2","observed_at":NOW,"value":700,"unit":"W/m2"},None),
 ("cmms_eam",CmmsEamConnector,{"work_order_id":"wo-1","status":"IN_PROGRESS","modified_at":NOW,"site_id":"site-1","asset_id":"inv-1"},None),
 ("meters",MeterConnector,{"meter_id":"mtr-1","site_id":"site-1","interval_start":NOW,"register":"export_kwh","value":225,"unit":"kWh","revision":0},None),
 ("technician_apps",TechnicianAppConnector,{"client_event_id":"evt-1","modified_at":NOW,"occurred_at":NOW,"site_id":"site-1","asset_id":"inv-1","action":"INSPECTED","technician_email":"private@example.com"},None),
 ("enterprise",EnterpriseConnector,{"entity_type":"warranty_claim","entity_id":"claim-1","modified_at":NOW,"site_id":"site-1","asset_id":"inv-1","amount":1200,"currency":"USD"},None)]

class ConnectorTests(unittest.IsolatedAsyncioTestCase):
    async def test_each_connector_publishes(self):
        for kind,cls,item,registry in CASES:
            with self.subTest(kind=kind):
                kwargs=deps(kind,[item])
                if registry is not None: kwargs["registry"]=registry
                stats=await cls(**kwargs).run_once()
                self.assertEqual((stats.read,stats.published,stats.dead_lettered),(1,1,0));self.assertEqual(len(kwargs["publisher"].messages),1)
    async def test_duplicate_is_not_republished(self):
        item={"meter_id":"mtr-1","site_id":"site-1","interval_start":NOW,"register":"export_kwh","value":225,"unit":"kWh"};kwargs=deps("meters",[item,item]);stats=await MeterConnector(**kwargs).run_once();self.assertEqual((stats.published,stats.duplicated),(1,1))
    async def test_invalid_record_goes_to_dlq(self):
        kwargs=deps("enterprise",[{"entity_type":"invoice","entity_id":"inv-1","modified_at":NOW,"amount":1}]);stats=await EnterpriseConnector(**kwargs).run_once();self.assertEqual(stats.dead_lettered,1);self.assertEqual(kwargs["dlq"].records[0][2],"VALIDATION_FAILED")
    async def test_unknown_mapping_goes_to_dlq(self):
        item={"device_id":"unknown","tag":"PAC","site_id":"site-1","timestamp":NOW,"value":800};kwargs=deps("solar_scada",[item]);kwargs["registry"]=MappingRegistry({}, {"PAC":("ac_power_kw","kW",1)});stats=await SolarScadaConnector(**kwargs).run_once();self.assertEqual(stats.dead_lettered,1);self.assertEqual(kwargs["dlq"].records[0][2],"MAPPING_NOT_FOUND")
    async def test_technician_pii_is_removed(self):
        item={"client_event_id":"evt-1","modified_at":NOW,"occurred_at":NOW,"action":"CLOSED","technician_email":"private@example.com"};kwargs=deps("technician_apps",[item]);await TechnicianAppConnector(**kwargs).run_once();self.assertNotIn("technician_email",kwargs["sink"].events[0].payload)

