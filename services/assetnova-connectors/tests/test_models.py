import unittest
from datetime import timezone
from assetnova_connectors.models import stable_key, utc_datetime
class ModelTests(unittest.TestCase):
    def test_stable_key_is_deterministic(self): self.assertEqual(stable_key("a",1),stable_key("a",1));self.assertNotEqual(stable_key("a",1),stable_key("a",2))
    def test_timestamp_converts_to_utc(self): self.assertEqual(utc_datetime("2026-09-01T07:00:00-05:00").tzinfo,timezone.utc)
    def test_naive_timestamp_rejected(self):
        with self.assertRaises(ValueError): utc_datetime("2026-09-01T07:00:00")
