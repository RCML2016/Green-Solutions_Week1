"""One-time backfill: reverse-geocode existing site lat/long -> address/city/zip_code.

Uses Nominatim (OpenStreetMap) — free, no API key, but rate-limited to ~1
request/second per their usage policy, so this takes a few minutes for the
full fleet. Run manually: `python backfill_locations.py`. Idempotent-ish —
skips sites that already have a zip_code set.
"""
import asyncio
import os
import sys

import httpx
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
HEADERS = {"User-Agent": "AssetNova-Demo/1.0 (internal location backfill)"}


async def main():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    sites = await db.fleet_sites.find(
        {"zip_code": {"$exists": False}, "latitude": {"$ne": None}, "longitude": {"$ne": None}},
        {"_id": 0, "site_id": 1, "latitude": 1, "longitude": 1},
    ).to_list(2000)
    print(f"[backfill] {len(sites)} sites need geocoding")

    ok = 0
    async with httpx.AsyncClient(timeout=10, headers=HEADERS) as http:
        for i, s in enumerate(sites):
            try:
                resp = await http.get(NOMINATIM_URL, params={
                    "lat": s["latitude"], "lon": s["longitude"], "format": "json", "addressdetails": 1, "zoom": 16,
                })
                data = resp.json()
                addr = data.get("address", {}) or {}
                city = addr.get("city") or addr.get("town") or addr.get("village") or addr.get("county")
                zip_code = addr.get("postcode")
                street = " ".join(filter(None, [addr.get("house_number"), addr.get("road")])) or None
                update = {}
                if city: update["city"] = city
                if zip_code: update["zip_code"] = zip_code
                if street: update["address"] = street
                if update:
                    await db.fleet_sites.update_one({"site_id": s["site_id"]}, {"$set": update})
                    ok += 1
                print(f"[{i+1}/{len(sites)}] {s['site_id']} -> {update or 'no match'}")
            except Exception as e:
                print(f"[{i+1}/{len(sites)}] {s['site_id']} FAILED: {e}")
            await asyncio.sleep(1.1)  # Nominatim usage policy: max 1 req/sec

    print(f"[backfill] done. {ok}/{len(sites)} sites updated.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
