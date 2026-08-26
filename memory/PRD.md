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

## What's been implemented (Feb 2026, iteration 14)

### Backend (routers + fleet APIs + RBAC + storage)
- Refactored monolithic `server.py` (890 lines) into thin entry + 5 routers.
- Idempotent XLSX → Mongo seed on startup (7 collections, ~76k documents).
- 9 `/api/fleet/*` endpoints (categories, kpis, sites, telemetry sliding window,
  alarms, work orders, states, performance trend, site detail).
- **RBAC (iterations 12-14)** — 7 MVP roles: `admin`, `executive`, `asset_manager`,
  `om_manager`, `technician`, `performance_engineer`, `client_viewer` (legacy `user`
  auto-migrated to `executive` at startup). `rbac.role_required(...)` guards on
  `/alerts`, `/actions`, `/team/*`. Admin is a super-role with self-lockout protection
  (roles=['admin'] backfill; switch preserves prior role in roles array).
- **Multi-role workspaces** — users can hold N roles; `POST /api/rbac/switch` sets
  active role and returns a fresh JWT. Reversible.
- **Client viewer scope** — admin scopes a client_viewer to a list of `site_ids` +
  `categories` via `PATCH /api/team/users/{id}/client-scope`. `GET /api/client/portfolio`
  returns a read-only KPI + tile view restricted to that scope.
- **Evidence upload** — `POST /api/evidence` multipart uploads photos to Emergent Object
  Storage, streamed back via `GET /api/evidence/{id}/file?auth=<token>`. Non-admins only
  see their own uploads. All storage I/O runs in threadpool so uploads don't block.
- 7 demo accounts seeded on startup (one per MVP role).

### Frontend
- Slim `Dashboard.jsx` orchestrator; extracted dashboard components.
- `SiteDetail.jsx` drill-down (assets, telemetry chart, alarms, WOs).
- Theme reverted to origin palette (bright white + emerald green).
- **Role-based navigation** — `/app/frontend/src/lib/roles.js` (`NAV`, `LANDING`).
  Sidebar & TopBar are role-scoped. Login redirects to the role's landing.
- 6 role-specific pages: `ExecutiveOverview`, `OperationsCenter`, `MyWork`,
  `Administration`, `PerformanceAnalytics`, `ClientPortal`.
- **WorkspaceSwitcher** — dropdown in Sidebar (desktop) + in Profile menu (mobile,
  accessible via TopBar). Only renders when user has >1 role.
- **Mobile-first `MyWork`** — 390px viewport optimised. Alarm cards → bottom-sheet
  `DiagnoseSheet` with a 4-step checklist + inline camera evidence upload + Mark Resolved.
  Photos are streamed back into thumbnails via blob URLs.
- Register form supports all 6 MVP roles (admin cannot self-register).
- Administration page — inline PRIMARY ROLE dropdown, EXTRA ROLES toggle chips (multi-
  role editing), and a **Client Scope modal** (categories + site checklist) for any user
  holding the `client_viewer` role.

### Testing
- **Backend: 245/245 pytest passing** (iteration 14; +90 tests over iteration 12).
- **Frontend: 100% of Playwright RBAC / navigation / mobile / evidence flows**.

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
