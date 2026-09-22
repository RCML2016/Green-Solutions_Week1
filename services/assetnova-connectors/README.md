# AssetNova Connectors

Deployable, vendor-neutral ingestion services for Solar SCADA, inverter/tracker APIs, BESS EMS/BMS, weather, CMMS/EAM, revenue meters, technician applications, and ERP/warranty/contract/financial systems.

## What is implemented

- One shared async pipeline with source checkpoints, deterministic idempotency, canonical events, validation, Kafka publishing and DLQ routing.
- Eight source-specific normalizers with domain checks.
- Redis-backed deduplication and idempotent Kafka producer.
- JSON Lines and in-memory source adapters. These make local tests runnable and provide the contract for OPC UA, MQTT, REST, webhook, SFTP and CDC adapters.
- FastAPI health endpoints, Docker image and local Redpanda/Redis/Timescale deployment.
- Tests for every connector, duplicate suppression, DLQ behavior, mapping failures, timestamp handling and technician PII removal.

## Important production boundary

The normalization and delivery pipeline is production-oriented. Vendor protocols require customer/vendor details before implementation: endpoint, authentication, tag/register catalog, pagination/webhook contract, rate limits, network route, certificates and sample payloads. Implement those protocol clients behind the `Source` interface; do not place vendor logic in connector normalization classes.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
python -m pip install -e ".[dev]"
pytest -q
docker compose up --build -d
curl http://localhost:8080/connectors
```

## Add a real source adapter

1. Implement `records(checkpoint)` from `ports.Source`.
2. Convert transport failures to `TransientSourceError`.
3. Emit `RawRecord` with a resumable cursor or source offset.
4. Keep the original payload unchanged; normalization belongs in its connector.
5. Add contract tests using captured, redacted vendor fixtures.
6. Add outage, pagination, restart, late-event and credential-rotation tests.

## Source protocols by connector

| Connector | Recommended first adapter | Secondary/backfill adapter |
|---|---|---|
| Solar SCADA | OPC UA subscription through edge gateway | Historian REST incremental pull |
| Inverter/tracker | Webhook or MQTT alarms | Quota-aware REST pagination |
| BESS EMS/BMS | MQTT or OPC UA read-only feed | Historian export |
| Weather | Station Modbus/REST | Forecast REST by coordinates |
| CMMS/EAM | Webhook | Modified-since REST plus nightly reconciliation |
| Meters | Meter API/DLMS gateway | Signed SFTP interval files |
| Technician apps | Mobile/web webhook | Offline batch sync |
| Enterprise | CDC/webhook | API or encrypted SFTP reconciliation |

## Production changes before a customer pilot

- Replace `MemoryCheckpoints` with a PostgreSQL checkpoint store.
- Add a TimescaleDB event sink and immutable raw-object writer.
- Store credentials in Key Vault/Secrets Manager and use private connectivity.
- Configure Kafka topics, ACLs, retention, schema compatibility and consumer lag alerts.
- Configure connector-specific range rules and an authoritative asset/tag mapping registry.
- Add OpenTelemetry traces and Prometheus counters for freshness, lag, invalid rate, duplicates and DLQ age.
- Pin container images to approved digests and run vulnerability/SBOM checks in CI.

## Package layout

```text
src/assetnova_connectors/
  core.py        shared orchestration, retries, validation, dedupe and DLQ
  connectors.py eight canonical connector implementations
  adapters.py    local and infrastructure adapters
  ports.py       dependency-injection interfaces
  models.py      canonical event model and stable keys
  factory.py     deployment factory
  api.py         health and discovery API
tests/           connector and failure-path tests
config/          example connector and mapping configuration
```

