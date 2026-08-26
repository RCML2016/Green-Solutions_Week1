# Green Solutions — Product Requirements Document

## Original Problem Statement
> "Create a Website, which can be functional with Login and Live" — recreated from https://rcml2016.github.io/Green-Solutions-MVP-AUG212026/ with balanced Vertical/Horizontal Navigation.

## Personas
- Renewable asset owner / operator (marketing site + demo dashboard)
- Ops leader / analyst (Live Dashboard behind auth)

## Architecture
- Backend: FastAPI + Motor (MongoDB), JWT (HS256), bcrypt password hashing.
- Frontend: React 19 + react-router 7 + Tailwind + Shadcn primitives + lucide-react + sonner + framer-motion available.
- Auth: Bearer token in `localStorage["gs_token"]`, sent via axios interceptor.
- Layout: **Hybrid nav** — fixed left Sidebar (240px) + sticky top TopBar; both stay synchronized via NavLink active states.

## Core Requirements (static)
1. Recreate Green Solutions marketing site (Hero, From Data to Decision, See/Understand/Act, Solutions, Platform, About/Vision, CTA).
2. Balanced vertical + horizontal navigation.
3. Functional login: register, login, logout, protected dashboard.
4. Contact form → stores messages in Mongo.

## What's been implemented (2026-02)
- Backend: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/contact`, `/api/portfolio/metrics` (protected).
- Admin seeding on startup with unique email index.
- Frontend:
  - Layout with Sidebar (vertical) + TopBar (horizontal)
  - Pages: Landing, Platform, Solutions, HowItWorks, About, Contact, Login, Register, Dashboard (protected)
  - AuthContext with bootstrap on load, `useAuth()` hook
  - Sonner toaster for notifications
  - Dashboard shows live-ish KPIs (portfolio health, AI findings, confidence, energy) + priority findings + chart

## Added in iteration 2 (2026-02)
- **Password reset**: `/api/auth/forgot-password` + `/api/auth/reset-password`, MongoDB TTL index on tokens, console-logged reset links, `/forgot-password` and `/reset-password` UI pages.
- **Real-time refresh**: `/api/portfolio/metrics` returns jittered values on every call; Dashboard polls every 5s with pulse animation.
- **AI Insight Assistant**: `/api/ai/insight` — SSE streaming from Claude Sonnet 5 via `emergentintegrations` and EMERGENT_LLM_KEY. Right-panel chat on Dashboard with finding-context chips.
- **Report Export**: Client-side PDF via `jspdf` + `html2canvas` captures the whole dashboard, one-click download.

## Added in iteration 3 (2026-02)
- **AI Session History**: Chat sessions persisted in Mongo; `/api/ai/sessions` list/get/delete; Dashboard AI panel has Chat / History tabs; new-session, delete-session controls.
- **Anomaly Auto-Alerts**: Dashboard tracks seen high-severity findings; `/api/portfolio/metrics` occasionally rotates in a new high-sev code (INV-09, STR-22, INV-15, INV-03); on detection, the AI panel auto-injects a briefing question tagged AUTO-ALERT.
- **Team Access (RBAC)**: `/api/team/*` admin-only invite (owner/technician/compliance/admin) + list + remove; `Team.jsx` sidebar link is admin-gated; temporary password shown once in UI + backend log.
- **Report Scheduler**: `/api/reports/schedule` upsert + `/api/reports/preview`; `Reports.jsx` cadence + recipients + toggle + preview (simulated, logged to backend).

## Iteration 4 — Bright, shiny 2026+ theme (2026-02)
- Global palette pivoted to **cream + emerald + soft glass** (`--bg #f4f7f0`, `--brand #10b981` with gradient shine, warm amber for anomalies).
- New tokens (`gs-canvas`, `gs-card`, `gs-card-accent`, `gs-btn-primary` with gradient + shadow, `gs-glass`, `gs-input`) in `index.css`.
- Sidebar + TopBar: white surface with subtle green highlight for active links.
- Landing: gradient shine hero (mint + amber radial), light glass mock, white/cream section rhythm.
- Dashboard: light KPI cards, colored severity chips (red/amber/emerald), AI panel on white surface.
- All auth screens (Login, Register, Forgot, Reset) redesigned with bright-shine accent pane.

## Iteration 5 — Password change, onboarding tour, findings filter, theme toggle (2026-02)
- **Password change**: `POST /api/auth/change-password` (auth-guarded, verifies current, rejects same-as-old); topbar profile menu → modal (`data-testid=profile-change-password`, `password-modal`, `password-submit`).
- **Onboarding tour**: 4-step spotlight tour on first dashboard visit (KPIs → Findings → AI panel → Export). Skippable, stored in `localStorage["gs_tour_completed_v1"]`.
- **Findings filter**: severity chips (high/medium/low), min-confidence slider, code/title search, reset. Renders `findings-empty` when nothing matches.
- **Theme toggle**: `ThemeProvider` + `data-theme` attribute on `<html>`. Soft dark mode preserves the shine (deep forest bg, mint tints). Toggle in topbar; persists in `localStorage["gs_theme"]`.

## Iteration 6 — Multi-portfolio, Alert Center, Branded PDFs, Public snapshots (2026-02)
- **Multi-portfolio**: `/api/portfolios` GET/POST/DELETE; auto-seeds "Main Renewable Fleet" on first load; dashboard header selector with add-new inline; metrics endpoint accepts `?portfolio_id=` and shifts baseline deterministically per portfolio.
- **Alert Center**: `/api/alerts` GET (with severity/code/since_hours filters), POST (create), POST `/acknowledge`. Dashboard auto-posts on new high-severity detection. New `/alerts` page groups by day with filter chips + range picker + search + ack.
- **Custom PDF branding**: `/api/reports/branding` upsert; Reports page adds company name, cover note, logo upload (base64, ≤140KB) + live cover-page preview. Dashboard export automatically prepends a branded cover page if any field is set.
- **Public snapshot links**: `POST /api/snapshots` captures a metrics blob + returns a shareable `/s/:token` URL (14-day TTL via Mongo `expireAfterSeconds`). Public `GET /api/public/snapshots/{token}` (no auth). New `Snapshot.jsx` route renders a stripped read-only dashboard with a "Get live intelligence" CTA.

## Iteration 9 — Warmer theme + 4 features (2026-02)
- **Palette shifted warmer/deeper**: `--bg #dbe3d1` (sage), card `#f0f3e8`, stronger `--line`, deeper shadow — cards lift off the page.
- **Recommended Actions**: `POST /api/actions` + `GET /api/actions`. Dashboard row-level `AcceptActionButton` streams Claude for a one-line action, strips `Action:` prefix, POSTs to actions, swaps to `✓ LOGGED`.
- **Snapshot Manager**: `GET /api/snapshots` (no metrics blob) + `DELETE /api/snapshots/{token}`. Reports page lists all shares with OPEN + REVOKE.
- **Login rate-limit**: 5 wrong passwords → 15-min lock via `db.login_attempts`; 429 with human message. Success clears counter.
- **AI Weekly Digest**: `POST /api/reports/weekly-digest` — Claude Sonnet 5 summarises last 7 days of alerts + accepted actions. Reports page button + card + copy; client renders `**bold**` markdown correctly.
- **Verified**: Backend 82/82 pytest + Frontend 100% Playwright flows. Zero console errors.

## Prioritized Backlog
- P1: Real-time metrics WebSocket refresh
- P1: Password reset flow (forgot / reset)
- P2: Multi-tenant orgs, team invites
- P2: Role-based dashboard variants (owner / technician / compliance)
- P2: PDF report export

## Test Credentials
See `/app/memory/test_credentials.md`.
