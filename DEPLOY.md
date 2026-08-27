# Deployment Guide

Green Solutions is a standard 3-tier app: **MongoDB + FastAPI + React**.
Pick whichever path fits your setup.

---

## Option 1 — Docker Compose (fastest, one command)

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# fill in EMERGENT_LLM_KEY and JWT_SECRET in backend/.env

docker compose up --build
```

App: http://localhost:3000  ·  API: http://localhost:8001/api/health

The first backend boot ingests `backend/data/green_solutions_sample_data.xlsx`
(≈ 60k telemetry rows) into MongoDB automatically. Subsequent boots skip.

---

## Option 2 — Manual (local dev)

### Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env       # then edit values
uvicorn server:app --reload --host 0.0.0.0 --port 8001
```

### Frontend
```bash
cd frontend
yarn install
cp .env.example .env       # then edit REACT_APP_BACKEND_URL
yarn start
```

---

## Option 3 — Cloud Hosting

| Service           | Deploys        | Notes                                   |
|-------------------|----------------|-----------------------------------------|
| **Render**        | backend + web  | Auto-detect Dockerfiles                 |
| **Railway**       | backend + web  | Add MongoDB add-on, then two services   |
| **Fly.io**        | backend + web  | `fly launch` in each folder             |
| **Vercel/Netlify**| frontend only  | Build cmd: `yarn build`, out: `build/`  |
| **MongoDB Atlas** | database       | Copy the connection string into env     |

Required env vars in production:
- `backend`: `MONGO_URL`, `DB_NAME`, `JWT_SECRET`, `EMERGENT_LLM_KEY`, `FRONTEND_URL`, `CORS_ORIGINS`
- `frontend`: `REACT_APP_BACKEND_URL` (set to backend's public URL, no trailing slash)

---

## Pushing to GitHub

```bash
git init
git add .
git commit -m "Initial commit — Green Solutions MVP"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

**Never commit `.env` files** — the included `.gitignore` already blocks them.
Use `.env.example` templates instead. Contributors can copy them:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

---

## Getting an EMERGENT_LLM_KEY

1. Sign in to https://emergent.sh
2. Go to **Profile → Manage plan → Universal Key**
3. Copy the key into `backend/.env`

Without this key: AI Insights + Object Storage uploads won't work. Everything
else (dashboards, telemetry, RBAC, alarms, work orders) runs normally.

---

## Health Checks

- `GET /api/health` → `{ "status": "ok" }`
- `GET /api/fleet/categories` → 8 category buckets from the seeded dataset
- `POST /api/auth/login` with any demo credential from `memory/test_credentials.md`
