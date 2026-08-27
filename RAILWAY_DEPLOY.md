# Deploy AssetNova to Railway (with built-in MongoDB)

Railway = simplest cloud host for a Docker-based full-stack app with a database.
No credit card required for the free trial, MongoDB add-on is native.
Total time: **~15 minutes** from zero to live URL.

---

## Prerequisites

1. GitHub account (free)
2. Railway account (free trial — sign up at https://railway.app)
3. Your `EMERGENT_LLM_KEY` (from Emergent → Profile → Manage plan → Universal Key)

That's it. No Atlas, no separate DNS provider until you add a custom domain.

---

## Step 1 — Push the code to GitHub

```bash
# Unzip the packaged download first
unzip assetnova-*.zip -d assetnova
cd assetnova

git init
git add .
git commit -m "Initial commit — AssetNova"
git branch -M main
git remote add origin git@github.com:<your-user>/assetnova.git
git push -u origin main
```

**Alternative:** Use Emergent's built-in **Save to GitHub** button in the chat
input — it handles auth and pushes `/app` directly.

---

## Step 2 — Create the Railway project

1. Go to https://railway.app/new
2. Click **Deploy from GitHub repo**
3. Authorize Railway to access your GitHub org
4. Pick the **`assetnova`** repository
5. Railway auto-detects `backend/Dockerfile` and starts building. Cancel this
   auto-build for now — we'll wire everything up first.

---

## Step 3 — Add MongoDB

Inside the Railway project canvas:

1. Click **+ New** → **Database** → **Add MongoDB**
2. Railway spins up a Mongo 7 instance and adds a `MONGO_URL` service variable
   automatically. You don't have to copy it — the backend will inherit it.

---

## Step 4 — Configure the backend service

1. Click the **backend** service on the canvas
2. Under **Settings → Source**, set **Root Directory** to `backend`
3. Under **Variables**, add:

   | Key                | Value                                                    |
   |--------------------|----------------------------------------------------------|
   | `MONGO_URL`        | `${{MongoDB.MONGO_URL}}` *(Railway auto-populates)*      |
   | `DB_NAME`          | `assetnova`                                              |
   | `JWT_SECRET`       | *(generate: `openssl rand -hex 32`)*                     |
   | `ADMIN_EMAIL`      | `admin@assetnova.com`                                    |
   | `ADMIN_PASSWORD`   | *(any strong password — used for the seeded admin)*      |
   | `EMERGENT_LLM_KEY` | `sk-emergent-xxxxxxxx`                                   |
   | `CORS_ORIGINS`     | `*`  *(tighten to your frontend URL after step 5)*       |
   | `FRONTEND_URL`     | *(fill in after step 5)*                                 |

4. Under **Settings → Networking**, click **Generate Domain** — you'll get
   something like `assetnova-backend.up.railway.app`.
5. Click **Deploy**. First boot takes ~90 seconds while it ingests the shipped
   Excel dataset (60k rows) into Mongo.

Verify:
```bash
curl https://assetnova-backend.up.railway.app/api/healthz
# → {"ok":true,"fleet_sites":380,"time":"..."}
```

---

## Step 5 — Configure the frontend service

1. Back on the project canvas, click **+ New** → **GitHub Repo** → same repo again
2. Under **Settings → Source**, set **Root Directory** to `frontend`
3. Under **Variables**, add:

   | Key                     | Value                                             |
   |-------------------------|---------------------------------------------------|
   | `REACT_APP_BACKEND_URL` | `https://assetnova-backend.up.railway.app`        |

4. Under **Settings → Networking**, click **Generate Domain** — you'll get
   something like `assetnova.up.railway.app`.
5. Click **Deploy**. Takes ~3 min to build the React bundle and start nginx.

6. Once live, copy the frontend URL back into the **backend service's**
   `FRONTEND_URL` variable — click backend → Variables → paste the URL →
   Redeploy the backend once so CORS is scoped.

---

## Step 6 — Verify the deployment

Open your frontend URL. You should see:
- The AssetNova landing page
- **"Explore Platform"** and **"Sign In"** working
- Log in with `admin@assetnova.com` + the password you set → land on `/admin`
- All 380 sites visible on the Dashboard

---

## Step 7 — Point your custom domain (optional, ~10 min)

Once you own `assetnova.com`:

1. Railway → frontend service → **Settings → Networking → Add Custom Domain**
2. Enter `www.assetnova.com`
3. Railway shows you a CNAME target (`abc123.railway.app`)
4. In your DNS provider (Cloudflare, Namecheap, GoDaddy):
   - Add a **CNAME** record: `www` → `abc123.railway.app`
   - Add a **redirect** or **CNAME flattening** for the apex: `assetnova.com` → `www.assetnova.com`
5. Wait 1–15 min for DNS + auto-SSL. Done — `https://www.assetnova.com` is live.

---

## Costs

Railway free trial gives you $5/month usage credit. AssetNova (backend + frontend + MongoDB) idles at ~$0.03/hour under low traffic ≈ **$20/month if left on 24/7**. Shut off services when not in use to stay within the free credit.

Cheaper alternatives after the trial:
- **Hobby plan**: $5/month base + usage
- **Sleep on inactivity**: turn on **"Serverless"** mode in service settings — sleeps after 10 min idle, wakes on first request (adds ~5s cold start)

---

## Troubleshooting

**Backend won't start** → Check backend logs for `MONGO_URL` — it must be
prefixed `mongodb://` or `mongodb+srv://`. Railway auto-injects it correctly if
you referenced it via `${{MongoDB.MONGO_URL}}`.

**Frontend shows "Network Error"** → `REACT_APP_BACKEND_URL` is baked in at
**build time**, not runtime. If you change the backend URL, redeploy the
frontend to rebuild.

**Dataset didn't seed** → Check backend logs for `[STARTUP] Dataset seed status`.
The 4.3 MB Excel file must ship inside `backend/data/`. If missing, the seed
skips gracefully and Mongo stays empty. Fix: re-push code with the data file.

**Login says "Invalid credentials"** → The seeded admin uses `ADMIN_EMAIL` +
`ADMIN_PASSWORD` from the backend env. Not the demo `Admin@123` unless you
explicitly set `ADMIN_PASSWORD=Admin@123`.
