# AI Agricultural Subsidy Verification Platform

An end-to-end platform that verifies farmer subsidy applications using satellite NDVI, a cadastral registry, and an explainable ML model — with an immutable audit log, WebSocket live updates, and automated Direct Benefit Transfer.

For a deep dive into **how** everything works, see [`explain.md`](./explain.md).

---

## 1 · Prerequisites

You need:

| Tool | Version | How to check |
|---|---|---|
| Docker Desktop | 24+ | `docker --version` |
| Docker Compose | v2 (bundled) | `docker compose version` |
| Git | any | `git --version` |
| ~6 GB free RAM | | |
| ~4 GB free disk | | |

No Python or Node installation is required on the host — everything runs inside containers. Install Python/Node locally only if you want to develop outside Docker.

---

## 2 · Quick start (mock mode — no external accounts)

```bash
# 1. Environment file
cp backend/.env.example backend/.env

# 2. Build and start every service
docker compose up -d --build

# 3. Wait ~20 seconds, then verify everything is healthy
docker compose ps
```

All 8 containers should be `Up`. Expected services:

| Service | Port | What it is |
|---|---|---|
| `mongo` | 27017 | MongoDB 7 — primary data store |
| `redis` | 6379 | Celery broker + WebSocket pub/sub |
| `minio` | 9010, 9011 | S3-compatible object store for NDVI previews |
| `bank-mock` | 9000 | Mock NPCI/UPI payout API |
| `land-mock` | 9100 | Mock state cadastral registry |
| `api` | 8000 | FastAPI backend |
| `worker` | — | Celery worker (orchestrator) |
| `frontend` | 5173 | Vite + React dev server |

**One-time bootstrap** (seeds schemes, admin account, trains the ML model):

```bash
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py
```

The cadastral registry and bank-account data **auto-seed** on first start of the `land-mock` service, so 30 parcels across 6 Maharashtra districts and ~20 bank accounts are already in place.

**Open the app:**

| URL | Purpose |
|---|---|
| http://localhost:5173 | Farmer + admin UI |
| http://localhost:8000/docs | Interactive API docs (Swagger) |
| http://localhost:8000/api/health | Liveness + model-loaded check |
| http://localhost:9011 | MinIO console (`minioadmin` / `minioadmin`) |
| http://localhost:9000/health | Bank mock health |
| http://localhost:9100/health | Cadastral mock health |

**Admin login** (pre-seeded):
```
phone:    9999999999
password: admin123
```

---

## 3 · Five-minute demo walkthrough

### Step 1 — Register a farmer

1. Open http://localhost:5173 → **Register**.
2. Fill in any phone (10 digits), password, state (e.g. *Maharashtra*), district, annual income.
3. Submit. You'll be redirected to the login page.
4. Log in with that phone + password.

### Step 2 — Apply for a subsidy

In the wizard:

1. **Declare** — enter land size (e.g. `2.0`), pick a crop (e.g. `wheat`), enter annual income.
2. **Scheme** — the recommender returns matching schemes ranked by regional approval rate. Pick one.
3. **Parcel** — the cleanest demo path: **click a pre-registered parcel** from the list (e.g. `MA-PUN-0001`, *Haveli, Pune*). The map flies to it, auto-draws the polygon, and auto-fills crop + size. Alternatively, draw your own polygon on the map using the polygon tool (top-left).
4. **Review** — confirm and submit.

### Step 3 — Watch verification live

You'll land on `/applications/{id}` with a `● live` badge in the corner (WebSocket connected). Over a few seconds you'll see:

```
🛰️ Fetching Sentinel-2 imagery…
🛰️ NDVI computed
🗺️ Looking up cadastral registry…
🗺️ Cadastral record matched
🧠 Running ML model…
🧠 ML decision ready
```

Then the page fills with:

- **NDVI preview PNG** — colorised from brown (bare soil) to dark green (healthy vegetation)
- **Land verification bars** — declared vs satellite-verified vs cadastral
- **Cadastral record** — owner name, since-date, ownership history table, crop history with yields, soil type, irrigation source
- **AI eligibility decision** — probability + SHAP explanation ("mean_ndvi 42% for | overclaim_ratio 31% against | …")
- **DBT receipt** (if approved) — bank name, IFSC, masked account, transaction ID, NPCI ref, balance after
- **Audit trail** — every state transition with SHA-256 payload hash

### Step 4 — Admin view

1. Log out. Log in as `9999999999` / `admin123`.
2. **Queue** — every application in the system with risk score, flags, and approve/reject override buttons.
3. **Analytics** — aggregates (total, approval rate, flagged count, by-status breakdown).
4. **Demo data** — a Leaflet map showing all 30 pre-seeded parcels + the global bank ledger with NPCI refs.
5. Click any queue row → **Audit** to see the full immutable trail.

---

## 4 · Going fully real (Sentinel-2)

The only part of the stack where `MOCK_MODE=true` still applies is the Sentinel-2 pipeline (Copernicus credentials are per-user). To switch on real imagery:

1. Register (free) at https://dataspace.copernicus.eu.
2. Create an OAuth client at https://shapps.dataspace.copernicus.eu/dashboard → *OAuth clients* → *Create*.
3. Copy the `client_id` and `client_secret`.
4. Edit `backend/.env`:
   ```
   MOCK_MODE=false
   CDSE_CLIENT_ID=<your client id>
   CDSE_CLIENT_SECRET=<your client secret>
   ```
5. Restart the backend services:
   ```bash
   docker compose restart api worker
   ```

From then on, each application fires a real Sentinel Hub Process API call that returns a cloud-filtered NDVI GeoTIFF + PNG clipped to the farmer's polygon. The free tier gives you 30,000 processing units per month, which comfortably covers thousands of applications.

If Copernicus is unreachable or the request fails, the worker logs the error and falls back to the deterministic synthetic NDVI, so the pipeline never blocks.

---

## 5 · Ports and URLs reference

| URL | What it is |
|---|---|
| http://localhost:5173 | React UI |
| http://localhost:5173/admin | Admin queue |
| http://localhost:5173/admin/demo | Seeded cadastral + bank ledger |
| http://localhost:8000 | API root |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:8000/api/health | Health check |
| ws://localhost:8000/api/ws/applications/{id} | Live status WebSocket |
| http://localhost:9000/ledger | Bank ledger (debug) |
| http://localhost:9100/parcels | Cadastral registry (debug, requires Bearer token) |
| http://localhost:9011 | MinIO web console |
| http://localhost:27017 | MongoDB (use `mongosh`) |
| http://localhost:6379 | Redis (use `redis-cli`) |

---

## 6 · Common operations

### View logs

```bash
docker compose logs -f api            # backend API
docker compose logs -f worker         # Celery worker (verification + DBT)
docker compose logs -f frontend       # Vite dev server
docker compose logs -f land-mock      # cadastral mock
docker compose logs -f bank-mock      # bank mock
docker compose logs                   # everything together
```

### Run tests

```bash
docker compose exec api pytest -v
docker compose exec api pytest tests/test_fraud.py -v      # one file
docker compose exec api pytest -k "overclaim" -v           # one test by name
```

### Re-seed demo data (parcels + bank accounts)

```bash
docker compose exec land-mock python -m mocks.seed_demo
```

### Re-train the ML model

```bash
docker compose exec api python scripts/train_model.py
# Then restart the worker so it reloads the model
docker compose restart worker
```

### Inspect Mongo collections

```bash
docker compose exec mongo mongosh
> use subsidy
> db.applications.find().pretty()
> db.audit_log.find({application_id: "A-2026-0000001"}).sort({timestamp: 1})
> use mocks
> db.parcels.countDocuments()
> db.bank_txns.find().sort({created_at: -1}).limit(10).pretty()
```

### Reset everything (wipe data)

```bash
docker compose down -v
docker compose up -d --build
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py
```

### Rebuild one service after a code change

Docker is bind-mounting `backend/` and `frontend/`, so most code edits hot-reload. You only need to rebuild when you change `requirements.txt` or a `Dockerfile`:

```bash
docker compose up -d --build api worker
```

---

## 7 · Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker compose ps` shows a service `Exited` | Port already in use on host | `docker compose down`, free the port, re-up |
| Frontend shows *Network error* on login | API hasn't finished starting | Wait 10s; check `docker compose logs api` |
| Application stuck in `SUBMITTED` | Worker isn't picking up tasks | `docker compose logs worker`; ensure Redis is healthy |
| `Model file not found` error in worker logs | Model wasn't trained | `docker compose exec api python scripts/train_model.py` |
| `403 Admin only` when clicking admin links | You're logged in as a farmer | Log out, log in as `9999999999 / admin123` |
| WebSocket `● offline` badge stuck | Browser blocked `ws://` to a different origin | Usually fine on `localhost`; check the browser console |
| `NDVI preview missing` on status page | MinIO bucket not created | Check `docker compose logs api` for bucket errors; restart api |
| `CADASTRAL_UNVERIFIED` flag every time | Registry is empty | `docker compose exec land-mock python -m mocks.seed_demo` |
| Port 27017 already in use | You have a local Mongo running | Stop local Mongo, or change `mongo.ports` in `docker-compose.yml` |

---

## 8 · Project layout

```
.
├── README.md                  ← this file
├── explain.md                 ← how it all works
├── docker-compose.yml
├── .gitignore
│
├── backend/
│   ├── app/                   ← FastAPI backend
│   │   ├── main.py            ← app entrypoint + router wiring
│   │   ├── config.py          ← pydantic-settings env binding
│   │   ├── db.py              ← Mongo client + index definitions
│   │   ├── models.py          ← Pydantic request/response schemas
│   │   ├── security.py        ← bcrypt + JWT + role guards
│   │   │
│   │   ├── routers/           ← HTTP endpoints
│   │   │   ├── auth.py        ← /api/auth/register + /login + /me
│   │   │   ├── schemes.py     ← /api/schemes/* recommender
│   │   │   ├── applications.py← /api/applications/*
│   │   │   ├── admin.py       ← /api/admin/queue + audit + override
│   │   │   ├── demo.py        ← /api/demo/* (proxies to mocks)
│   │   │   ├── ws.py          ← WebSocket live status
│   │   │   └── health.py      ← /api/health
│   │   │
│   │   ├── services/          ← business logic
│   │   │   ├── audit.py       ← insert-only audit log + event emit
│   │   │   ├── cadastral.py   ← cadastral registry client
│   │   │   ├── copernicus.py  ← real CDSE Sentinel Hub client
│   │   │   ├── satellite.py   ← NDVI compute (real or mock)
│   │   │   ├── storage.py     ← MinIO/S3 wrapper
│   │   │   ├── events.py      ← Redis pub/sub
│   │   │   ├── recommender.py ← scheme ranking
│   │   │   ├── ml.py          ← XGBoost + SHAP
│   │   │   ├── fraud.py       ← rules + IsolationForest
│   │   │   └── dbt.py         ← HMAC-signed bank payout
│   │   │
│   │   ├── workers/           ← Celery
│   │   │   ├── celery_app.py
│   │   │   └── tasks.py       ← verify_application + execute_dbt_task
│   │   │
│   │   └── utils/
│   │       ├── ids.py         ← farmer / application ID generators
│   │       ├── hashing.py     ← canonical-JSON + SHA-256
│   │       └── geo.py         ← polygon area / bbox helpers
│   │
│   ├── mocks/                 ← mock external services
│   │   ├── db.py              ← shared Mongo client (mocks db)
│   │   ├── land_records_server.py
│   │   ├── bank_server.py
│   │   └── seed_demo.py       ← 30 parcels + 20 bank accounts
│   │
│   ├── scripts/
│   │   ├── seed.py            ← 10 schemes + admin
│   │   └── train_model.py     ← synthetic dataset + XGBoost + IsoForest
│   │
│   ├── tests/                 ← pytest (fraud, NDVI, SHAP, API smoke)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env / .env.example
│
└── frontend/
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx            ← router table
    │   ├── index.css          ← dark theme design tokens
    │   ├── api/client.ts      ← axios + JWT interceptor
    │   ├── context/AuthContext.tsx
    │   ├── components/        ← Navbar, ProtectedRoute
    │   └── pages/
    │       ├── Landing.tsx
    │       ├── Login.tsx
    │       ├── Register.tsx
    │       ├── Dashboard.tsx
    │       ├── ApplyWizard.tsx
    │       ├── ApplicationStatus.tsx
    │       └── admin/
    │           ├── Queue.tsx
    │           ├── Analytics.tsx
    │           ├── AuditTimeline.tsx
    │           └── DemoData.tsx
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html
    └── Dockerfile
```

---

## 9 · Developing outside Docker

Sometimes you want faster iteration on the backend with a local venv:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Mongo + Redis + MinIO + mocks still run in Docker
docker compose up -d mongo redis minio bank-mock land-mock

# In one terminal
export MONGO_URI=mongodb://localhost:27017/subsidy
export CELERY_BROKER=redis://localhost:6379/0
export CELERY_BACKEND=redis://localhost:6379/1
uvicorn app.main:app --reload

# In another terminal (same env)
celery -A app.workers.celery_app.celery worker --loglevel=info

# Frontend
cd ../frontend
npm install
npm run dev
```

---

## 10 · License

MIT
#   A g r i c u l t u r e s u b s i d y m a n a g m e n t  
 