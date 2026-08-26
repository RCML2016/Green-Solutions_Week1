# Green Solutions — AI Operating System for Renewable Energy

Recreation of the Green Solutions marketing site + a full live-intelligence dashboard.
React 19 + FastAPI + MongoDB, streamed by Claude Sonnet 5.

## Quick start

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # fill in JWT_SECRET + EMERGENT_LLM_KEY
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (new terminal)
cd frontend
yarn install
cp .env.example .env
yarn start
```

## What's inside

- **Marketing site** — Landing, Platform, Solutions, How It Works, About, Contact
- **Auth** — JWT + bcrypt, register/login/forgot/reset/change-password
- **Live Dashboard** — 5s polling, KPIs, findings, filter, PDF export (branded), share snapshot
- **AI Insight Assistant** — Claude Sonnet 5 SSE streaming with session history + anomaly auto-alerts
- **Alert Center** — Every anomaly filed with filters (severity/time/asset)
- **Team RBAC** — Admin invite (owner/technician/compliance/admin) with temp passwords
- **Report Scheduler** — Cadence + recipients + branding (logo, cover note)
- **Multi-Portfolio** — Switchable portfolios with distinct baselines
- **Public Snapshot Links** — `/s/:token` read-only 14-day dashboard share
- **Theme Toggle** — Bright shine + soft dark, persisted per user

## Documentation

- `memory/ARCHITECTURE.md` — Full architecture with 10+ Mermaid diagrams
- `memory/PRD.md` — Product spec + roadmap
- `memory/test_credentials.md` — Admin creds + endpoint index

## Tests

63/63 backend pytest + 100% frontend Playwright E2E across 8 iterations.

## License

Proprietary — build with permission.
