# Green Solutions — Product Requirements Document

## Original Problem Statement
> "Create a Website, which can be functional with Login and Live" — recreated from https://rcml2016.github.io/Green-Solutions-MVP-AUG212026/ with balanced Vertical/Horizontal Navigation.
>
> **Iteration 12 (Feb 2026):** User uploaded a real renewable-energy dataset (Excel workbook)
> with 380 sites, 5,473 assets, 60,000 telemetry rows, 800 alarms, 141 work orders across 8
> asset categories. Requested: (a) inject dataset into MongoDB, query it in place of demo
> random data, (b) simulate live refresh via sliding window, (c) support all categories in
> the UI, (d) add Site Detail drill-down page, (e) refactor monolithic server.py into
> per-domain routers, (f) revert theme to the origin site's bright green + white palette.

## Personas
- Renewable asset owner / operator (marketing site + demo dashboard)
- Ops leader / analyst (Live Dashboard behind auth)
- O&M technician (Alerts, Work Orders, Site drill-down)

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT (HS256), bcrypt password hashing.
  - Domain routers under `/app/backend/routers/`: `auth.py`, `ai.py`, `core.py` (contact,
    portfolios, team, alerts, actions, snapshots, reports/branding, weekly-digest),
    `fleet.py` (9 endpoints powered by the real dataset).
  - Shared deps in `deps.py`, request models in `models.py`.
  - Idempotent dataset seed at startup (`seed_dataset.py` reads
    `data/green_solutions_sample_data.xlsx`).
- Frontend: React 19 + react-router 7 + Tailwind + Shadcn primitives + lucide-react +
  sonner + framer-motion.
- Auth: Bearer token in `localStorage["gs_token"]`, sent via axios interceptor.
- Layout: fixed left Sidebar (240px) + sticky top TopBar; both synchronized via NavLink
  active states.
- Theme: bright white/mint canvas with forest-green ink and emerald-green brand
  (`--bg #ffffff`, `--ink #071c14`, `--brand #18a866`, `--brand-3 #087346`) — matches the
  origin site palette.

## Seeded Data Model (MongoDB collections)
- `fleet_sites` — 380 sites across 8 categories (Utility-Scale Solar 80, Commercial
  Rooftop 60, Community Solar 40, Battery Energy Storage 35, Wind Farm 30,
  Residential/C&I 100, Small Hydro 20, Small Distributed Wind 15).
- `fleet_assets` — 5,473 assets (Inverter, Combiner, Tracker, Battery, etc.).
- `fleet_telemetry` — 60,000 hourly readings; per-request aggregated by timestamp.
- `fleet_weather` — 9,120 hourly weather rows.
- `fleet_performance` — 380 daily PR%, availability, revenue-loss records.
- `fleet_alarms` — 800 alarms with severity (Low/Medium/High/Critical) + root cause.
- `fleet_work_orders` — 141 work orders with status/trade/labor-hours/parts cost.

## Core Requirements (static)
1. Recreate Green Solutions marketing site (Hero, From Data to Decision, See/Understand/Act, Solutions, Platform, About/Vision, CTA).
2. Balanced vertical + horizontal navigation.
3. Functional login: register, login, logout, protected dashboard.
4. Contact form → stores messages in Mongo.
5. Dashboard powered by real seeded dataset (no random jitter).
6. Site Detail drill-down at `/site/:site_id`.

## What's been implemented (Feb 2026, iteration 11)

### Backend (routers + fleet APIs)
- Refactored monolithic `server.py` (890 lines) into thin entry + 4 routers.
- Idempotent XLSX → Mongo seed on startup (7 collections, ~76k documents).
- 9 new `/api/fleet/*` endpoints:
  - `GET /categories` — 8-category priority summary with counts & capacity.
  - `GET /kpis[?category=]` — fleet KPIs (empty-scope guard).
  - `GET /sites[?category=&state=&search=&limit=&skip=]` — paginated site list with
    latest PR%, availability, open alarms.
  - `GET /sites/{site_id}` — full detail (assets, breakdown, perf, weather, alarms, WOs).
  - `GET /telemetry?site_id=&hours=` — per-timestamp aggregated sliding window.
  - `GET /alarms[?severity=&status=&root_cause=&site_id=&category=]` — with root-cause
    breakdown; supports Low/Medium/High/Critical.
  - `GET /work-orders[?status=&site_id=&category=]` — with status breakdown.
  - `GET /states[?category=]` — state-level rollup.
  - `GET /performance/trend?site_id=&days=` — daily performance history.
- `GET /api/healthz` — reports `fleet_sites` count.
- All legacy endpoints preserved (`/portfolio/metrics`, `/portfolios`, `/alerts`,
  `/snapshots`, `/actions`, `/reports/*`, `/team/*`, `/ai/insight` SSE, `/auth/*`).

### Frontend
- `Dashboard.jsx` rewritten as a slim orchestrator (`~180 lines`).
- New dashboard components: `CategorySwitcher`, `FleetKpiCards` (6 real KPIs),
  `SitesTable` (with search + drill-down links), `AlarmsFeed` (severity + root-cause),
  `WorkOrdersCard` (status breakdown), `AiInsightPanel` (extracted).
- `SiteDetail.jsx` — new drill-down page with 4 KPI cards, telemetry chart (24h
  aggregated), asset breakdown, alarms, work orders.
- Theme reverted to origin palette (bright white + emerald green).
- Onboarding tour steps updated to new testids; login copy fixed to reflect real fleet
  size (380 sites · 5,473 assets).
- Category filter now scopes KPIs + Sites + Alarms + Work Orders consistently.
- Critical severity supported in AlarmsFeed + SiteDetail.

### Testing
- **Backend: 155/155 pytest passing** (iteration_11).
- **Frontend: 100% of Playwright flows** (login, category switching, drill-down,
  telemetry chart, AI streaming, dark-mode toggle) — zero JS/page errors.

## Prioritized Backlog

### P2 (nice-to-have)
- Make the telemetry sliding window visibly rotate at `hours=24` (aggregated series has
  exactly 24 rows so `%1==0`). Rotate the deque by wall-clock instead of slicing.
- Clamp/annotate PR% > 100% in SitesTable/SiteDetail (data artifact when actual > expected).
- Move alarm severity + asset-status badge colors to theme tokens so dark mode adopts
  darker pastels.
- Scalability: replace multiple `find().to_list(2000) → $in` patterns in `fleet.py`
  with `$lookup`/`$facet` for scenarios past 2000 sites.

### P3 (future)
- IP-Aware Lockout (extend auth brute-force lockout to key on IP + email).
- Slack Alerts Integration.
- Real-time WebSocket telemetry (replace 5s polling).

## Test Credentials
See `/app/memory/test_credentials.md`.
