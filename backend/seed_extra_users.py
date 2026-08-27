"""One-off seed: create 3 demo users per RBAC role and export a credentials
CSV to /app/downloads/. Idempotent — skips any email that already exists.

Run with:  cd backend && python seed_extra_users.py
"""
import asyncio
import csv
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from deps import db, hash_password

USERS = [
    # (name, email, password, role, extra_context)
    # ---- Admin ----
    ("Riya Sharma",       "riya.admin@assetnova.com",    "Riya@Admin2026",    "admin"),
    ("Marcus Chen",       "marcus.admin@assetnova.com",  "Marcus@Admin2026",  "admin"),
    ("Aisha Patel",       "aisha.admin@assetnova.com",   "Aisha@Admin2026",   "admin"),
    # ---- Executive ----
    ("Ellie Walsh",       "ellie.exec@assetnova.com",    "Ellie@Exec2026",    "executive"),
    ("David Kim",         "david.exec@assetnova.com",    "David@Exec2026",    "executive"),
    ("Sofia Rodriguez",   "sofia.exec@assetnova.com",    "Sofia@Exec2026",    "executive"),
    # ---- Asset Manager ----
    ("Alex Turner",       "alex.asset@assetnova.com",    "Alex@Asset2026",    "asset_manager"),
    ("Priya Singh",       "priya.asset@assetnova.com",   "Priya@Asset2026",   "asset_manager"),
    ("James Wilson",      "james.asset@assetnova.com",   "James@Asset2026",   "asset_manager"),
    # ---- O&M Manager ----
    ("Omar Ahmed",        "omar.ops@assetnova.com",      "Omar@Ops2026",      "om_manager"),
    ("Lisa Chen",         "lisa.ops@assetnova.com",      "Lisa@Ops2026",      "om_manager"),
    ("Raj Kumar",         "raj.ops@assetnova.com",       "Raj@Ops2026",       "om_manager"),
    # ---- Technician ----
    ("Tara Foster",       "tara.tech@assetnova.com",     "Tara@Tech2026",     "technician"),
    ("Diego Silva",       "diego.tech@assetnova.com",    "Diego@Tech2026",    "technician"),
    ("Nina Kowalski",     "nina.tech@assetnova.com",     "Nina@Tech2026",     "technician"),
    # ---- Performance Engineer ----
    ("Pat Miller",        "pat.perf@assetnova.com",      "Pat@Perf2026",      "performance_engineer"),
    ("Wei Zhang",         "wei.perf@assetnova.com",      "Wei@Perf2026",      "performance_engineer"),
    ("Ana Costa",         "ana.perf@assetnova.com",      "Ana@Perf2026",      "performance_engineer"),
    # ---- Client Viewer ----
    ("Chris Bennett",     "chris.client@assetnova.com",  "Chris@Client2026",  "client_viewer"),
    ("Maya Johnson",      "maya.client@assetnova.com",   "Maya@Client2026",   "client_viewer"),
    ("Robert Lee",        "robert.client@assetnova.com", "Robert@Client2026", "client_viewer"),
]

ROLE_LANDING = {
    "admin": "/admin",
    "executive": "/overview",
    "asset_manager": "/dashboard",
    "om_manager": "/operations",
    "technician": "/my-work",
    "performance_engineer": "/performance",
    "client_viewer": "/client-portal",
}


async def main():
    created, skipped = 0, 0

    # Seed client scope for client_viewer users (first 20 solar sites)
    solar = await db.fleet_sites.find({"site_type": "Utility-Scale Solar"}, {"_id": 0, "site_id": 1}).limit(20).to_list(20)
    client_site_ids = [s["site_id"] for s in solar]

    for name, email, password, role in USERS:
        email = email.lower()
        if await db.users.find_one({"email": email}):
            skipped += 1
            continue
        doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "role": role,
            "roles": [role],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if role == "client_viewer":
            doc["client_scope"] = {
                "allowed_site_ids": client_site_ids,
                "allowed_categories": [],
            }
        await db.users.insert_one(doc)
        created += 1

    # Export CSV
    downloads = Path(__file__).parent.parent / "downloads"
    downloads.mkdir(exist_ok=True)
    csv_path = downloads / "assetnova-team-credentials.csv"

    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Full Name", "Email", "Password", "Role", "Landing Route", "Notes"])
        role_label = {
            "admin": "Administrator (super-user)",
            "executive": "Executive (portfolio view)",
            "asset_manager": "Asset Manager",
            "om_manager": "O&M Manager",
            "technician": "Field Technician (mobile)",
            "performance_engineer": "Performance Engineer",
            "client_viewer": "Client Viewer (read-only, scoped)",
        }
        for name, email, password, role in USERS:
            writer.writerow([
                name, email, password, role_label[role], ROLE_LANDING[role],
                "Scoped to first 20 solar sites" if role == "client_viewer" else "",
            ])

    print(f"[SEED] Created {created} new users · Skipped {skipped} existing")
    print(f"[SEED] Credentials CSV → {csv_path}")


if __name__ == "__main__":
    asyncio.run(main())
