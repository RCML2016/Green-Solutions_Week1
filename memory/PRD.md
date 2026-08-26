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

## Prioritized Backlog
- P1: Real-time metrics WebSocket refresh
- P1: Password reset flow (forgot / reset)
- P2: Multi-tenant orgs, team invites
- P2: Role-based dashboard variants (owner / technician / compliance)
- P2: PDF report export

## Test Credentials
See `/app/memory/test_credentials.md`.
