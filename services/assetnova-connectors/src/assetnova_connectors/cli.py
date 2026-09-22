import argparse, asyncio, json
from .adapters import JsonLinesSource
from .factory import build_connector

def main():
    p=argparse.ArgumentParser();p.add_argument("kind");p.add_argument("jsonl");p.add_argument("--tenant",required=True);p.add_argument("--source-system",default="demo");p.add_argument("--kafka",default="localhost:19092");p.add_argument("--redis",default="redis://localhost:6379/0")
    a=p.parse_args();source=JsonLinesSource(a.source_system,a.jsonl);connector=build_connector(a.kind,tenant_id=a.tenant,source=source,kafka_bootstrap=a.kafka,redis_url=a.redis)
    stats=asyncio.run(connector.run_once());print(json.dumps(vars(stats)))

if __name__=="__main__":main()

