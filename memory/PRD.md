# AssetNova — PRD & Status

## Original Problem Statement
Full-stack fleet/renewable-asset management app (FastAPI + React + MongoDB) with role-based
dashboards, Fleet Admin CRUD, Workspace modes (Demo/Pilot/Production), feature flags, demo reset,
and audit logging.

## Architecture
- Backend: FastAPI (`/app/backend`), routers in `backend/routers/` (fleet.py, fleet_admin.py, qa.py, rbac_ext.py), workspace.py
- Frontend: React + TailwindCSS (`/app/frontend/src`), craco build
- DB: MongoDB, UUIDs over ObjectIDs
- Routing: backend prefixed `/api`, frontend on port 3000

## Status (as of 2026-09-09)
- `integration/fleet-admin-demo-hardening` branch: stable, passed backend/frontend/deployment checks. Awaiting manual "Save to GitHub" merge to `main` by user.
- Custom domain (assetnovaenergy.com via Cloudflare) troubleshooting guidance given to user (remove stale A records, re-link via Entri).
- Footer & legal pages implemented and tested (2026-09-09):
  - `Layout.jsx` footer replaced: dynamic copyright (`© {year} AssetNova Energy. All rights reserved.`), "AssetNova™ is a product of AssetNova Energy™" (TM only, no ®), links to Privacy Policy / Terms of Use / Trademark Notice / Contact. Appears on ALL routes (public + authenticated).
  - New pages: `pages/TrademarkNotice.jsx` (verbatim legal text + mailto:info@assetnovaenergy.com), `pages/PrivacyPolicy.jsx`, `pages/TermsOfUse.jsx` (generic placeholder boilerplate — user approved, real legal text not yet provided).
  - Routes added in `App.js`: `/privacy-policy`, `/terms-of-use`, `/trademark-notice`.
  - Tested via testing_agent: 100% pass, all data-testids verified, no ® symbol found, mobile responsive confirmed.

## Known Non-blocking Items
None currently outstanding.

## Backlog (P1/P2, not started)
- OnboardingTour backdrop z-index intercepting clicks (P1)
- Sidebar feature-flag toggle requires page reload instead of instant refresh (P1)
- Per-field data masking so technicians never see revenue figures (P1)
- Implement 4 remaining roles mentioned in backlog discussion (P1)
- Replace Privacy Policy / Terms of Use placeholder boilerplate with real legal text once user provides it (P1)

## Credentials
See `/app/memory/test_credentials.md`
