# AI Agricultural Subsidy Verification Platform - Documentation

This document provides a complete overview of how the platform works, its demo capabilities, and the file structure.

---

## 1. Problem Statement

Government agricultural subsidies face major issues:
- **Manual verification** is slow and unreliable
- **Self-declared data** (land size, crop, income) is unchecked
- **Decisions are opaque** — farmers don't know why they were approved or rejected
- **No tamper-evident record** of approvals and disbursements

This platform automates verification using satellite imagery, cadastral registries, and ML models — with full audit trail, live progress updates, and direct bank transfers.

---

## 2. How the System Works

### The Five Evidence Sources

When a farmer applies for a subsidy, the system fuses five independent checks:

1. **Farmer's Declaration** — land size, crop type, annual income, polygon on map
2. **Satellite NDVI** — Sentinel-2 imagery shows if land is actually cultivated
3. **Cadastral Registry** — verifies parcel ownership, crop history, disputes
4. **ML Model** — XGBoost predicts eligibility probability with SHAP explanations
5. **Fraud Rules** — deterministic checks for overclaim, duplicate parcels, anomalies

### Application Lifecycle

```
SUBMITTED → VERIFYING → APPROVED/REJECTED/FLAGGED → DISBURSED/DBT_FAILED
```

**Step 1: Submission**
- Farmer fills the wizard (land size, crop, income, scheme, parcel polygon)
- API validates the data, creates an application document in MongoDB
- Audit log entry + WebSocket event published
- Celery task dispatched for async verification

**Step 2: Verification (Worker)**
1. Fetches NDVI from satellite (real Sentinel-2 or mock)
2. Looks up cadastral registry for the polygon
3. Runs ML model to get eligibility probability
4. Checks fraud rules (overclaim, duplicate, anomaly, etc.)
5. Makes decision: APPROVED / REJECTED / FLAGGED

**Step 3: Decision**
- `FLAGGED` → queues for admin review, no bank transfer
- `APPROVED` (prob ≥ 0.6) → triggers Direct Benefit Transfer (DBT)
- `REJECTED` → no transfer

**Step 4: DBT (if approved)**
- HMAC-SHA256 signed request to bank mock
- Bank credits farmer's account
- Receipt with transaction ID, NPCI ref stored on application
- Final audit entry

**Step 5: Real-time Updates**
- WebSocket pushes every progress event to browser
- Farmer sees live: "Fetching satellite imagery..." → "Looking up registry..." → "Decision ready"

---

## 3. Demo Capabilities

### Pre-seeded Demo Data

The system includes a complete demo environment:

| Demo Component | What it contains |
|---|---|
| **30 Cadastral Parcels** | Across 6 Maharashtra districts (Pune, Nashik, Aurangabad, Solapur, Kolhapur, Nagpur) with owner names, crop history, soil types, irrigation |
| **10 Subsidy Schemes** | PM-KISAN, soil health card, seed subsidy, etc. |
| **20 Bank Accounts** | SBI, BoM, HDFC, ICICI, PNB with KYC status and balances |
| **1 Admin Account** | Phone: `9999999999`, Password: `admin123` |

### Demo Walkthrough

1. **Register** as a farmer (any 10-digit phone)
2. **Apply** for a subsidy via the wizard
3. **Pick a parcel** from the list OR draw your own polygon on the map
4. **Submit** and watch live verification
5. **See results** — NDVI preview, cadastral record, ML decision, DBT receipt

### Admin Demo Features

- **Queue** — review all applications, approve/reject with override
- **Analytics** — KPIs, approval rates, fraud statistics
- **Audit Trail** — immutable timeline with SHA-256 payload hashes
- **Demo Map** — Leaflet map showing all 30 parcels with details
- **Bank Ledger** — all transactions with NPCI references

### Mock vs Real Mode

The system runs in **mock mode** by default (no external accounts needed):
- NDVI is synthesized deterministically from polygon hash
- Cadastral uses seeded data with real geospatial queries
- Bank simulates 2% NPCI timeout, 1% KYC failure

To switch to **real mode**:
1. Register at https://dataspace.copernicus.eu
2. Create OAuth client at Copernicus dashboard
3. Set `MOCK_MODE=false` and add CDSE credentials in `.env`

---

## 4. Fraud Detection Rules

| Flag | Trigger |
|------|---------|
| `HIGH_OVERCLAIM` | Verified land < 70% of declared |
| `NON_CROPPED_LAND` | NDVI < 0.15 but crop expects high vegetation |
| `CADASTRAL_MISMATCH` | Declared > 110% of cadastral area |
| `CADASTRAL_UNVERIFIED` | No parcel match in registry |
| `DUPLICATE_PARCEL` | Same polygon used in another application |
| `ANOMALY` | IsolationForest flags feature row as outlier |
| `CROP_HISTORY_MISMATCH` | Declared crop not in registry history |
| `CADASTRAL_DISPUTE_OPEN` | Parcel has unresolved dispute |
| `LAND_NOT_AGRICULTURAL` | Parcel classification not agricultural |

Any flag routes the application to admin review (FLAGGED status).

---

## 5. ML Model

### Features (7 total)
- `declared_land_ha` — farmer's declared land size
- `verified_land_ha` — satellite-measured area (NDVI > 0.3 mask)
- `cadastral_land_ha` — authoritative registry area
- `mean_ndvi` — average vegetation index
- `annual_income` — farmer's declared income
- `crop_is_high_vigor` — whether crop shows high NDVI (wheat, rice, sugarcane, maize, cotton = 1)
- `overclaim_ratio` — `declared / verified` (primary fraud signal)

### Output
- Eligibility probability (0-1)
- SHAP explanation: top 3 features with "for/against" direction
  - Example: `mean_ndvi 42% for | overclaim_ratio 31% against | cadastral_land_ha 27% for`

### Training
- `scripts/train_model.py` generates 6000 synthetic rows
- Trains XGBoost + IsolationForest
- Saves to `/opt/models/eligibility.pkl`

---

## 6. File Structure

### Backend

```
backend/
├── app/
│   ├── main.py                 # FastAPI entrypoint
│   ├── config.py              # pydantic-settings (env binding)
│   ├── db.py                  # MongoDB client + collection handles
│   ├── models.py              # Pydantic schemas (request/response)
│   ├── security.py            # JWT + bcrypt auth
│   │
│   ├── routers/               # HTTP endpoints
│   │   ├── auth.py             # /api/auth/register, /login, /me
│   │   ├── schemes.py          # /api/schemes/*
│   │   ├── applications.py     # /api/applications/* (submit, status)
│   │   ├── admin.py            # /api/admin/* (queue, override, audit)
│   │   ├── demo.py             # /api/demo/* (proxy to mocks)
│   │   ├── ws.py               # WebSocket /api/ws/applications/{id}
│   │   └── health.py          # /api/health
│   │
│   ├── services/              # Business logic
│   │   ├── audit.py            # Insert-only audit log + SHA-256 hashes
│   │   ├── satellite.py        # NDVI compute (mock or real)
│   │   ├── copernicus.py       # Real Sentinel Hub client (CDSE)
│   │   ├── gee_satellite.py    # Google Earth Engine alternative
│   │   ├── cadastral.py        # Land registry client (polygon matching)
│   │   ├── ml.py               # XGBoost + SHAP inference
│   │   ├── fraud.py            # Rule-based fraud flags + IsolationForest
│   │   ├── dbt.py              # HMAC-signed bank payout
│   │   ├── events.py           # Redis pub/sub for WebSocket
│   │   ├── storage.py          # MinIO/S3 for NDVI preview images
│   │   ├── recommender.py      # Scheme ranking by regional approval rate
│   │   ├── income.py           # Income verification
│   │   └── government_data.py  # Government database integration
│   │
│   ├── workers/               # Celery async tasks
│   │   ├── celery_app.py       # Celery configuration
│   │   └── tasks.py            # verify_application, execute_dbt_task
│   │
│   └── utils/
│       ├── ids.py             # Farmer/application ID generators
│       ├── hashing.py          # Canonical JSON + SHA-256
│       └── geo.py              # Polygon area/bbox helpers
│
├── mocks/                      # Mock external services
│   ├── land_records_server.py  # Cadastral registry (:9100)
│   ├── bank_server.py          # NPCI/UPI mock (:9000)
│   ├── db.py                   # Shared Mongo client
│   └── seed_demo.py            # 30 parcels + 20 bank accounts
│
├── scripts/
│   ├── seed.py                 # 10 schemes + admin account
│   └── train_model.py          # Synthetic data → XGBoost + IsoForest
│
├── tests/                      # pytest
│   ├── test_fraud.py           # Pure function tests
│   ├── test_ndvi.py            # NDVI computation tests
│   ├── test_shap.py            # ML explanation tests
│   └── test_api.py             # API endpoint tests
│
├── Dockerfile
├── requirements.txt
└── .env / .env.example
```

### Frontend

```
frontend/
├── src/
│   ├── main.tsx               # React entrypoint
│   ├── App.tsx                # Router table + protected routes
│   ├── index.css              # Dark theme CSS variables
│   │
│   ├── api/
│   │   └── client.ts          # axios + JWT interceptor
│   │
│   ├── context/
│   │   └── AuthContext.tsx    # Auth state management
│   │
│   ├── components/
│   │   ├── Navbar.tsx
│   │   └── ProtectedRoute.tsx
│   │
│   └── pages/
│       ├── Landing.tsx        # Public homepage
│       ├── Login.tsx          # Auth
│       ├── Register.tsx       # Farmer registration
│       ├── Dashboard.tsx      # Farmer home (my applications)
│       ├── ApplyWizard.tsx    # 4-step application wizard
│       ├── ApplicationStatus.tsx  # Live status with WebSocket
│       │
│       └── admin/
│           ├── Queue.tsx      # Admin application queue
│           ├── Analytics.tsx  # KPIs and charts
│           ├── AuditTimeline.tsx  # Immutable audit trail
│           └── DemoData.tsx   # Leaflet map + bank ledger
│
├── package.json
├── vite.config.ts
├── tsconfig.json
└── Dockerfile
```

---

## 7. Key Configuration

### Environment Variables (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://mongo:27017/subsidy` | MongoDB connection |
| `CELERY_BROKER` | `redis://redis:6379/0` | Redis for Celery |
| `CELERY_BACKEND` | `redis://redis:6379/1` | Redis for results |
| `MINIO_ENDPOINT` | `minio:9000` | S3 storage |
| `MOCK_MODE` | `true` | Use mock NDVI (set `false` for real Sentinel-2) |
| `INLINE_TASKS` | `false` | Run verification inline (bypass Celery) |
| `ADMIN_PHONE` | `9999999999` | Admin phone number |
| `ADMIN_PASSWORD` | `admin123` | Admin password |

### Ports

| Service | Port | URL |
|---|---|---|
| Frontend | 5173 | http://localhost:5173 |
| API | 8000 | http://localhost:8000/docs |
| Bank mock | 9000 | http://localhost:9000 |
| Land mock | 9100 | http://localhost:9100 |
| MinIO | 9011 | http://localhost:9011 |

---

## 8. Testing

```bash
# All tests
docker compose exec api pytest -v

# Single file
docker compose exec api pytest tests/test_fraud.py -v

# Single test by name
docker compose exec api pytest -k "overclaim" -v
```

### Key Test Files
- `test_fraud.py` — pure function tests for all fraud rules
- `test_ndvi.py` — NDVI computation (mock and real modes)
- `test_shap.py` — ML explanation generation
- `test_api.py` — endpoint integration tests

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Application stuck in `SUBMITTED` | `docker compose logs worker` — Celery not picking up tasks |
| Application stuck in `VERIFYING` | MongoDB timeout or exception; check `docker compose logs worker` |
| Wrong NDVI values | Rehash polygon to verify mock determinism; check `satellite.py` |
| False positive fraud flags | Run `pytest tests/test_fraud.py` — rules are pure functions |
| DBT 504 error | Bank mock simulates 2% NPCI timeout; Celery retry handles this |
| WebSocket offline | Browser may block `ws://` on non-localhost; check browser console |
| NDVI preview missing | MinIO bucket issue; restart api |
| `CADASTRAL_UNVERIFIED` every time | Registry empty; `docker compose exec land-mock python -m mocks.seed_demo` |

---

## 10. Quick Reference

```bash
# Start all services
docker compose up -d --build

# Bootstrap (one-time)
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py

# View logs
docker compose logs -f api
docker compose logs -f worker

# Re-seed demo data
docker compose exec land-mock python -m mocks.seed_demo

# Re-train ML model
docker compose exec api python scripts/train_model.py
docker compose restart worker

# Reset everything
docker compose down -v
docker compose up -d --build
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py
```