"""Helper: clear or restore client@ scope via the admin API (used for the
client-portal empty-state UI check). Usage: python _i14_scope_toggle.py clear|restore
"""
import sys
import requests
from conftest import API

DEFAULT = ["S%05d" % i for i in range(1, 21)]

r = requests.post(f"{API}/auth/login", json={"email": "admin@greensolutions.ai", "password": "Admin@123"}, timeout=30)
r.raise_for_status()
h = {"Authorization": f"Bearer {r.json()['access_token']}"}

users = requests.get(f"{API}/team/users", headers=h, timeout=30).json()
rows = users if isinstance(users, list) else users.get("users") or users.get("items")
cid = [u for u in rows if u["email"] == "client@greensolutions.ai"][0]["id"]

mode = sys.argv[1]
body = {"allowed_site_ids": [] if mode == "clear" else DEFAULT, "allowed_categories": []}
res = requests.patch(f"{API}/team/users/{cid}/client-scope", json=body, headers=h, timeout=30)
print(mode, res.status_code, len(res.json()["client_scope"]["allowed_site_ids"]))
