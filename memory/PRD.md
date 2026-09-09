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
- Deployment health check re-run (2026-09-09): removed a legacy one-time "rebrand migration" from `server.py` startup (flagged as automatic destructive-delete risk by deployment_agent), added top-level `/health` route. `.gitignore` confirmed correctly excludes `memory/test_credentials.md`. **Deployment: READY, no blockers.**
- Custom domain (assetnovaenergy.com via Cloudflare) troubleshooting guidance given to user (remove stale A records, re-link via Entri).
- Footer & legal pages implemented and tested (2026-09-09):
  - `Layout.jsx` footer replaced: dynamic copyright (`© {year} AssetNova Energy. All rights reserved.`), "AssetNova™ is a product of AssetNova Energy™" (TM only, no ®), links to Privacy Policy / Terms of Use / Trademark Notice / Contact. Appears on ALL routes (public + authenticated).
  - New pages: `pages/TrademarkNotice.jsx` (verbatim legal text + mailto:info@assetnovaenergy.com), `pages/PrivacyPolicy.jsx`, `pages/TermsOfUse.jsx` (generic placeholder boilerplate — user approved, real legal text not yet provided).
  - Routes added in `App.js`: `/privacy-policy`, `/terms-of-use`, `/trademark-notice`.
  - Tested via testing_agent: 100% pass, all data-testids verified, no ® symbol found, mobile responsive confirmed.
- Copy refresh (2026-09-09): Landing.jsx + HowItWorks.jsx "See/Understand/Act" framework renamed to "Visibility/Intelligence/Action" (eyebrow labels, card/step titles). Hero eyebrow changed from all-caps "AI-POWERED SUSTAINABILITY INTELLIGENCE" to title-case "AI Powered Sustainability Intelligence" (inline style override on `.eyebrow`'s forced uppercase).
- About/Contact/Footer copy update (2026-09-09): About.jsx triplet cards renamed DATA→"Asset Data", AI→"Artificial Intelligence", ACTION→"Next Best Recommended Action" (font size reduced to text-2xl to fit longer label). Contact.jsx email changed hello@assetnova.com → Info@assetnova.com. Layout.jsx footer version badge ("v1.0 · READY") moved from its own separate line into an inline pill next to the nav links (with pulse-dot), fixing the disjointed look reported by user; footer now stacks centered on mobile, row layout on desktop.
- Footer version pill live-reflects workspace mode color (2026-09-09): pill now uses same color convention as WorkspaceBanner.jsx (demo=amber, pilot=blue, production=emerald) instead of static gray, verified live via admin login screenshot showing "v1.0 · DEMO" in amber.
- Footer size/font pass (2026-09-09): copyright + nav links switched from font-mono to default sans (Manrope), sizes reduced (text-[11px], smaller padding/gaps) for a more subtle "fine print" look. Version pill kept in monospace as a small status badge, text changed from all-caps "READY"/"DEMO" to title case "Ready"/"Demo" etc.
- Demo/Pilot Asset Display Limit (2026-09-09, P0 feature): new `backend/demo_scope.py` caps non-admin users to 5 sites per site-category (8 categories) and 5 assets per asset-type within each shown site, when workspace.mode is demo/pilot. Deterministic selection (featured_for_demo=true → most-complete record → stable ID sort), same assets every session. Admin role always sees full portfolio. Applied across /fleet/categories, /fleet/kpis, /fleet/sites, /fleet/sites/{id}, /fleet/telemetry, /fleet/alarms, /fleet/work-orders, /fleet/states, /fleet-admin/assets, /client/portfolio. Config via backend/.env DEMO_MODE=true, DEMO_ASSET_LIMIT_PER_CATEGORY=5. Admin can manually curate via new star-toggle buttons (Fleet Admin Sites/Assets tabs) hitting POST /fleet-admin/{sites|assets}/{id}/toggle-featured. WorkspaceBanner shows "Showing 5 representative assets per category for this demo." note for non-admin users. Tested: 14/14 backend pytest (`/app/backend/tests/test_demo_scope.py`) + frontend UI, 100% pass.
- Contact info & footer update (2026-09-09): Contact.jsx now shows "AssetNova / Dallas, Texas, USA / info@assetnova.com" (clickable mailto, lowercase, fixed from prior "Info@" typo and leftover "Green Solutions" copy) plus the required intro message. Layout.jsx footer now includes the same contact block above the copyright line, on every page. PrivacyPolicy.jsx and TermsOfUse.jsx "Contact" sections updated with the same clickable info@assetnova.com + location (previously non-clickable and pointed at info@assetnovaenergy.com). TrademarkNotice.jsx intentionally left unchanged (still info@assetnovaenergy.com, per its own separate IP-inquiry purpose from a prior request). backend/.env NOTIFICATION_EMAIL changed to info@assetnova.com so contact/demo-request form submissions route there (note: FormSubmit.co requires a one-time verification click from that inbox on the first live-mode send; also this notification path only fires when workspace mode = production, by design — demo/pilot mode always stores to DB but suppresses outbound mail). No personal address exists anywhere on the site (verified via grep).
- Confirmation auto-reply email (2026-09-09): added Resend integration (`resend` pip package) to send a branded HTML confirmation email ("We've received your AssetNova demo request") to the contact-form submitter, alongside the existing internal lead notification. Same production-only safety gate as the lead notify (suppressed in demo/pilot). Verified end-to-end via curl by temporarily switching workspace to production mode and reverting to demo afterward. RESEND_API_KEY + SENDER_EMAIL added to backend/.env. Domain assetnovaenergy.com verified in Resend (2026-09-09) — SENDER_EMAIL updated to info@assetnovaenergy.com; confirmed delivery now works to arbitrary (non-owner) recipient addresses, not just the account owner's.

## Known Non-blocking Items
None currently outstanding.

## Backlog (P1/P2, not started)
- OnboardingTour backdrop z-index intercepting clicks (P1)
- Sidebar feature-flag toggle requires page reload instead of instant refresh (P1)
- Per-field data masking so technicians never see revenue figures (P1)
- Implement 4 remaining roles mentioned in backlog discussion (P1)
- Replace Privacy Policy / Terms of Use placeholder boilerplate with real legal text once user provides it (P1)

## Reference Docs
- `/app/docs/PRODUCT_KNOWLEDGE_BASE.md` — Product Knowledge Base draft (2026-09-09): Solar/Wind/BESS/Hybrid-Microgrid/Cross-cutting module catalog with proposed AN-[ASSET]-[FUNCTION]-[NUMBER] SKU naming convention and US regulatory/standards references per asset class. Marked as a starter draft — real SKUs/pricing and regulatory citations need confirmation before customer-facing use.

## Credentials
See `/app/memory/test_credentials.md`
