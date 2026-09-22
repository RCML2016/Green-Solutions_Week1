"""Create optional demo users with runtime-generated credentials.

No password is stored in source control. Generated credentials are written once
to the local downloads directory for private distribution.
"""
import asyncio
import csv
import secrets
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from deps import db, hash_password

USERS = [
    ("Riya Sharma", "riya.admin@assetnova.com", "admin"),
    ("Ellie Walsh", "ellie.exec@assetnova.com", "executive"),
    ("Alex Turner", "alex.asset@assetnova.com", "asset_manager"),
    ("Omar Ahmed", "omar.ops@assetnova.com", "om_manager"),
    ("Tara Foster", "tara.tech@assetnova.com", "technician"),
    ("Pat Miller", "pat.perf@assetnova.com", "performance_engineer"),
    ("Chris Bennett", "chris.client@assetnova.com", "client_viewer"),
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


async def main() -> None:
    solar = await db.fleet_sites.find(
        {"site_type": "Utility-Scale Solar"}, {"_id": 0, "site_id": 1}
    ).limit(20).to_list(20)
    client_site_ids = [site["site_id"] for site in solar]
    generated = []

    for name, email, role in USERS:
        email = email.lower()
        if await db.users.find_one({"email": email}):
            continue
        password = secrets.token_urlsafe(24)
        document = {
            "id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": name,
            "role": role,
            "roles": [role],
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if role == "client_viewer":
            document["client_scope"] = {
                "allowed_site_ids": client_site_ids,
                "allowed_categories": [],
            }
        await db.users.insert_one(document)
        generated.append((name, email, password, role))

    downloads = Path(__file__).parent.parent / "downloads"
    downloads.mkdir(exist_ok=True)
    credentials_path = downloads / "assetnova-team-credentials.csv"
    with credentials_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["Full Name", "Email", "One-time Password", "Role", "Landing Route"])
        for name, email, password, role in generated:
            writer.writerow([name, email, password, role, ROLE_LANDING[role]])

    print(f"[SEED] Created {len(generated)} users")
    print(f"[SEED] Private credentials file: {credentials_path}")


if __name__ == "__main__":
    asyncio.run(main())
