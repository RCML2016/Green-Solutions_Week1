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

## What's been implemented (Feb 2026, iteration 16)

### Backend
- Refactored monolithic `server.py` into thin entry + 5 routers.
- Idempotent XLSX → Mongo seed on startup (7 collections, ~76k docs).
- 9 `/api/fleet/*` endpoints on real data.
- **RBAC** — 7 MVP roles: `admin` (super-role), `executive`, `asset_manager`,
  `om_manager`, `technician`, `performance_engineer`, `client_viewer`. Endpoint-
  level `role_required(...)` guards. Admin self-lockout protection.
- **Multi-role workspaces** — `roles[]` + `POST /api/rbac/switch` with fresh JWT.
- **Client viewer scope** — admin curates via `PATCH /team/users/{id}/client-scope`.
- **Evidence upload** — Emergent Object Storage, threadpool-wrapped.
- 7 demo accounts + client_viewer default scope seeded at startup.

### Frontend — Navigation reorganization (iteration 15-16)
- **Public visitors** see a horizontal top navbar only:
  `Home | Platform | Solutions | How It Works | About | Contact | Login | Book a Demo`.
  No sidebar. `Book a Demo` opens a modal that hits `/api/contact`.
- **Logged-in users** see an app-only sidebar with the 8 canonical items:
  `Overview | Portfolio | Assets | AI Intelligence | Operations | Work Orders |
   Reports | Administration` — role-filtered per user.
- **Solo-workspace roles** (technician / performance_engineer / client_viewer)
  see ONLY their landing page in the sidebar AND cannot access any other route
  via direct URL (walled garden enforced in `<Protected>`).
- 6 role-specific pages: `ExecutiveOverview`, `OperationsCenter`, `MyWork` (mobile-
  first + camera evidence), `PerformanceAnalytics`, `ClientPortal`, `Administration`.
- 3 new pages from iteration 15: `Assets` (fleet browser with type filter + search),
  `AiIntelligence` (weekly digest generator + full-page chat panel), `WorkOrders`
  (4-tile status board driven by backend breakdown).

### Testing
- **Backend: 245/245 pytest passing** (iteration 14 baseline; 253/254 with load-flake
  in iteration 15).
- **Frontend: 8/8 flows pass** in iteration 16 — nav split, 4 solo-role walls,
  BookDemoModal reset, WorkOrders 4-tile breakdown, mobile topbar overflow all fixed.

## Prioritized Backlog

### P1 — Remaining roles + finish scope
- Add remaining 4 roles from the user's original list: Sustainability Manager,
  Financial User, Compliance Manager, AI Analyst.
- Per-field data masking (Technician can't see revenue).
- Client scope hard-cap indicator (currently silently caps at 200 sites).

### P2 (nice-to-have)
- Magic-byte validation on evidence uploads (currently content-type/extension only).
- Reuse `get_current_user` on `/evidence/{id}/file` via optional-token dependency
  instead of hand-rolled `jwt.decode`.
- Trim marketing PLATFORM/COMPANY sections from Client Viewer sidebar for a
  cleaner "walled garden" view.
- Backdrop scrim behind mobile profile dropdown.
- Move alarm severity + asset-status badge colors to theme tokens.
- Scalability: replace `find().to_list(2000) → $in` patterns with `$lookup`/`$facet`.

### P3 (future)
- IP-Aware Lockout (extend auth brute-force lockout to key on IP + email).
- Slack Alerts Integration.
- Real-time WebSocket telemetry (replace 5s polling).

## Test Credentials
See `/app/memory/test_credentials.md`.
