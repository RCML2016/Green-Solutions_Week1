# Green Solutions — Full-Stack Renewable Energy Intelligence Platform

**Stack:** React 19 · FastAPI · MongoDB · Claude Sonnet 5 · Emergent Object Storage
**Dataset:** 380 sites · 5,473 assets · 60k telemetry rows · 800 alarms · 141 work orders

---

## Deployment
See **[`DEPLOY.md`](./DEPLOY.md)** for Docker Compose, cloud hosting (Render / Railway / Fly / Vercel), and GitHub push instructions.

## Quick Start (Local)

### Prerequisites
- Node 18+ and Yarn
- Python 3.11+
- MongoDB (local or Atlas)

### Backend
```bash
cd backend
pip install -r requirements.txt
# create .env — see "Env vars" section below
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

The seed script runs automatically on first boot — it ingests
`backend/data/green_solutions_sample_data.xlsx` into 7 Mongo collections
(fleet_sites, fleet_assets, fleet_telemetry, fleet_weather, fleet_performance,
fleet_alarms, fleet_work_orders). Subsequent boots skip the seed.

### Frontend
```bash
cd frontend
yarn install
yarn start
```

Open http://localhost:3000

---

## Environment Variables

### `backend/.env`
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=green_solutions
JWT_SECRET=change-me-to-a-long-random-string
EMERGENT_LLM_KEY=sk-emergent-xxxxxxxx        # Powers Claude + Object Storage
INTEGRATION_PROXY_URL=https://integrations.emergentagent.com   # optional
FRONTEND_URL=http://localhost:3000
ADMIN_EMAIL=admin@greensolutions.ai          # optional, default value
ADMIN_PASSWORD=Admin@123                     # optional, default value
```

> **Where do I get an `EMERGENT_LLM_KEY`?** Sign in to the Emergent platform and
> visit **Profile → Manage plan → Universal Key**. Without it, the AI Insight
> panel and evidence photo upload won't work — everything else runs fine.

### `frontend/.env`
```
REACT_APP_BACKEND_URL=http://localhost:8001
```

If deploying, set this to the public URL of your backend (no trailing slash).

---

## Demo Accounts (Auto-Seeded)

| Email                              | Password         | Role                    | Landing              |
|-----------------------------------|------------------|-------------------------|----------------------|
| admin@greensolutions.ai            | Admin@123        | admin                   | /admin               |
| executive@greensolutions.ai        | Executive@123    | executive               | /overview            |
| assetmgr@greensolutions.ai         | Asset@123        | asset_manager           | /dashboard           |
| ops@greensolutions.ai              | Ops@123          | om_manager              | /operations          |
| tech@greensolutions.ai             | Tech@123         | technician              | /my-work             |
| perf@greensolutions.ai             | Perf@123         | performance_engineer    | /performance         |
| client@greensolutions.ai           | Client@123       | client_viewer           | /client-portal       |

The `client_viewer` demo has a scoped default of 20 Utility-Scale Solar sites
so the Client Portal renders straight away.

---

## Feature Map (What's In Here)

- **Marketing site** — Landing, Platform, Solutions, How It Works, About, Contact
- **Auth** — register (role picker), login, JWT, forgot/reset password, brute-force lockout
- **RBAC** — 7 roles, endpoint-level guards, workspace switcher for multi-role users
- **Live Dashboard** — 8 category filters, 6 real-time KPIs, fleet sites table,
  alarm feed with root-cause pareto, work-order board, AI Insight panel (Claude
  Sonnet 5 SSE streaming)
- **Site Detail (`/site/:site_id`)** — 4 KPIs, live-window telemetry chart, asset
  breakdown, alarms + work orders per site
- **Executive Overview** — Portfolio KPIs, mix by category, CO₂ avoided, top risks
- **Operations Center** — Alarms + WOs + Resolution Rate
- **My Work (mobile-first)** — Alarm cards → bottom-sheet Diagnose with 4-step
  checklist + inline camera evidence upload (Emergent Object Storage)
- **Performance Analytics** — Yield, Degradation, Loss, Data-Quality tiles;
  worst-PR% benchmarking table; root-cause Pareto
- **Client Portal** — Read-only tiles of admin-approved sites only
- **Administration** — User management, primary role dropdown, extra-role
  toggles, Client Scope modal (categories + site checklist)
- **Alert Center · Team · Reports · Snapshots · Weekly AI Digest** all preserved
  from earlier iterations

---

## Documentation

- `memory/PRD.md` — Product Requirements
- `memory/ARCHITECTURE.md` — Full architecture with 12 Mermaid diagrams:
  system overview, auth+workspace switch flow, role→landing map, dataset
  ingestion, telemetry sliding window, AI SSE streaming, client-scope
  enforcement, evidence upload path, data model, repo layout, env vars, tests.
- `memory/test_credentials.md` — Demo accounts + endpoint permission map

---

## Testing

```bash
cd backend
pytest tests/ -q
```

245 backend tests pass across auth, RBAC, fleet endpoints, storage, evidence,
client scope, and workspace switching.

---

## Notes

- **Node modules not included** — run `yarn install` after unzip.
- **Python packages** — reproducible via `backend/requirements.txt` (`pip install -r`).
- **Dataset shipped** — 4.3 MB Excel workbook in `backend/data/`; seeded once
  on first backend startup; idempotent thereafter.

Enjoy 🌱
