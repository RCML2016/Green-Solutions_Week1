import unittest
from scada_pilot import PilotValidationError, fleet_telemetry_projection, normalize_row, parse_csv

MAPPING = {
    "assets": {"DEV-1": {"asset_id": "INV-001", "site_id": "SITE-001"}},
    "tags": {"PAC": {"metric": "ac_power_kw", "unit": "kW", "factor": 0.001, "min": -10, "max": 5000}},
}


class ScadaPilotTests(unittest.TestCase):
    def test_csv_to_canonical_event_and_fleet_projection(self):
        content = ("site_id,device_id,tag,timestamp,value,quality,sequence\n"
                   "SITE-001,DEV-1,PAC,2025-10-05T15:00:00Z,842500,GOOD,1\n").encode()
        event = normalize_row(parse_csv(content)[0], MAPPING, "customer_scada")
        self.assertEqual(event["site_id"], "SITE-001")
        self.assertEqual(event["asset_id"], "INV-001")
        self.assertEqual(event["payload"]["value"], 842.5)
        self.assertEqual(len(event["idempotency_key"]), 64)
        self.assertEqual(fleet_telemetry_projection(event)["power_kW"], 842.5)

    def test_idempotency_is_deterministic(self):
        row = {"site_id": "SITE-001", "device_id": "DEV-1", "tag": "PAC",
               "timestamp": "2025-10-05T15:00:00Z", "value": "842500", "sequence": "1"}
        self.assertEqual(normalize_row(row, MAPPING, "customer_scada")["idempotency_key"],
                         normalize_row(row, MAPPING, "customer_scada")["idempotency_key"])

    def test_unknown_tag_is_rejected_for_dlq(self):
        row = {"site_id": "SITE-001", "device_id": "DEV-1", "tag": "UNKNOWN",
               "timestamp": "2025-10-05T15:00:00Z", "value": "10"}
        with self.assertRaisesRegex(PilotValidationError, "No tag mapping"):
            normalize_row(row, MAPPING, "customer_scada")

    def test_site_mismatch_is_rejected(self):
        row = {"site_id": "WRONG", "device_id": "DEV-1", "tag": "PAC",
               "timestamp": "2025-10-05T15:00:00Z", "value": "10"}
        with self.assertRaisesRegex(PilotValidationError, "does not match mapped site"):
            normalize_row(row, MAPPING, "customer_scada")

    def test_missing_required_columns_are_rejected(self):
        with self.assertRaisesRegex(PilotValidationError, "Missing required columns"):
            parse_csv(b"device_id,tag,value\nDEV-1,PAC,10\n")


if __name__ == "__main__":
    unittest.main()
