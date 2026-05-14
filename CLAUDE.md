# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

```bash
# Copy env file and start all services
cp backend/.env.example backend/.env
docker compose up -d --build

# Bootstrap (one-time): train ML model and seed data
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py
```

Access the app at http://localhost:5173 (frontend) and http://localhost:8000/docs (API).

**Admin login**: phone `9999999999`, password `admin123`

## Common Commands

```bash
# View logs
docker compose logs -f api           # backend API
docker compose logs -f worker        # Celery worker (verification + DBT)
docker compose logs -f frontend      # React dev server
docker compose logs -f land-mock     # cadastral mock
docker compose logs -f bank-mock     # bank mock

# Run tests
docker compose exec api pytest -v
docker compose exec api pytest tests/test_fraud.py -v      # single file
docker compose exec api pytest -k "overclaim" -v           # single test by name

# Re-seed demo data
docker compose exec land-mock python -m mocks.seed_demo

# Re-train ML model
docker compose exec api python scripts/train_model.py
docker compose restart worker  # reload model

# Reset everything
docker compose down -v
docker compose up -d --build
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py
```

## Architecture

This platform has three independent processes:
1. **API** - FastAPI at port 8000 (HTTP + WebSocket)
2. **Worker** - Celery at port 6379 (Redis broker) for async verification + DBT
3. **Frontend** - Vite + React at port 5173

### Backend Services (`backend/app/services/`)
- `audit.py` - Insert-only audit log with SHA-256 payload hashes (tamper-evident)
- `cadastral.py` - Client for land-records service (polygon matching via $geoIntersects)
- `copernicus.py` - Real Copernicus Sentinel Hub client (optional, requires credentials)
- `satellite.py` - NDVI computation (real or deterministic mock mode)
- `storage.py` - MinIO/S3 wrapper for NDVI preview images
- `events.py` + `routers/ws.py` - Redis pub/sub for WebSocket live updates
- `recommender.py` - Scheme ranking by regional approval rate
- `ml.py` - XGBoost + SHAP for eligibility prediction with explanations
- `fraud.py` - Deterministic rules (overclaim, duplicate, non-cropped, etc.) + IsolationForest
- `dbt.py` - HMAC-SHA256 signed bank payouts

### Data Flow
When a farmer submits an application:
1. API validates, creates document with `status=SUBMITTED`
2. Audit log entry + WebSocket event published
3. Celery task dispatched → `VERIFYING` → NDVI fetch → cadastral lookup → ML inference → fraud check
4. Decision: `APPROVED`/`REJECTED`/`FLAGGED` + audit entry
5. If approved, `execute_dbt_task` triggers bank payout
6. WebSocket pushes all progress events to browser in real-time

### Mock Mode
Set `MOCK_MODE=true` in `backend/.env` (default). Uses deterministic synthetic NDVI from polygon hash. To use real Sentinel-2:
1. Register at https://dataspace.copernicus.eu
2. Create OAuth client at https://shapps.dataspace.copernicus.eu/dashboard
3. Set `MOCK_MODE=false`, add `CDSE_CLIENT_ID` and `CDSE_CLIENT_SECRET`

## Key Files

- `backend/app/routers/applications.py` - Submit and status endpoints
- `backend/app/workers/tasks.py` - `verify_application` and `execute_dbt_task` Celery tasks
- `backend/app/services/fraud.py` - All fraud detection rules (pure functions)
- `backend/app/services/ml.py` - ML inference with SHAP explanations
- `backend/scripts/train_model.py` - Trains XGBoost + IsolationForest on synthetic data
- `frontend/src/pages/ApplicationStatus.tsx` - WebSocket-powered live status page

## Ports Reference

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 5173 | React dev server |
| API | 8000 | FastAPI + Swagger at /docs |
| API Health | 8000/api/health | Liveness + model check |
| Bank mock | 9000 | Mock NPCI/UPI payout |
| Land mock | 9100 | Mock cadastral registry |
| MinIO | 9011 | S3 console (minioadmin/minioadmin) |
| MongoDB | 27017 | Primary data store |
| Redis | 6379 | Celery broker + WS pub/sub |