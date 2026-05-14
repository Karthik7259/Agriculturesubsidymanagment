# Localhost Prototype Run Guide

This project is meant to run locally for demo purposes.

Frontend:
- React/Vite: http://localhost:5173

Backend:
- FastAPI: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

Database and support services:
- MongoDB stores farmers, synthetic government records, schemes, applications, and audit logs.
- Redis is used by Celery/WebSocket events.
- Mock services simulate land records, bank/DBT, and tax income APIs.

## Recommended Local Setup

Use Docker Desktop for the database and services, but everything still runs on your localhost.

1. Start Docker Desktop.
2. From the project root:

```powershell
docker compose up -d --build
docker compose exec api python scripts/train_model.py
docker compose exec api python scripts/seed.py
```

3. Open:

```text
http://localhost:5173
```

## Demo Aadhaar Registration

Use one of these seeded Aadhaar numbers:

```text
111122223333  Ramesh Patil   Pune       wheat/sugarcane
222233334444  Meena Sharma   Nashik     rice/wheat
333344445555  Kiran Gowda    Mandya     sugarcane
```

Registration flow:

1. Go to Register.
2. Enter Aadhaar number and full name.
3. Click Send OTP.
4. Use demo OTP `123456`.
5. Click Verify and fetch data.
6. The app auto-fills government profile data: land, crop history, income, loans, insurance, subsidies.
7. Enter password and create account.

## Farmer Demo Flow

1. Login with the registered mobile number and password.
2. Dashboard shows the unified farmer profile.
3. Click New Application.
4. Land area, crop, season, irrigation, income, estimated production, and parcel polygon are prefilled where available.
5. Pick an eligible scheme.
6. Submit application.
7. Verification runs locally using mock/synthetic NDVI, cadastral, ML, audit, and DBT flows.

## Admin Login

```text
phone:    9999999999
password: admin123
```

Admin can view queue, analytics, audit trail, demo cadastral records, and bank ledger.

## If You Do Not Want Docker

You still need local services:

- MongoDB running at `mongodb://localhost:27017/subsidy`
- Redis running at `redis://localhost:6379`
- Python 3.11 virtualenv with `backend/requirements.txt`
- Node.js with frontend dependencies installed

For a fast college/demo prototype, Docker Desktop is much simpler because it starts Mongo, Redis, MinIO, mock APIs, backend, worker, and frontend together.
