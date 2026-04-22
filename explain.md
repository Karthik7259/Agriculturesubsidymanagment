# How the AI Agricultural Subsidy Verification Platform works

This document explains the internals: **what each part does, how data flows, and why the design choices were made.** If you just want to run it, see [`README.md`](./README.md).

---

## 1 · The problem and the shape of the solution

Government agricultural subsidies are delayed and misallocated because verification is manual, self-declared land and crop data is unchecked, decisions are opaque, and there is no tamper-evident record of approvals.

The system replaces manual inspection with five independent evidence sources, fused into a single decision:

1. **What the farmer declared** — land size, crop, income, polygon.
2. **What the satellite shows** — Sentinel-2 NDVI over the polygon tells us whether the land is actually cultivated.
3. **What the cadastral registry says** — is this parcel registered to this farmer, and what has grown on it in previous seasons?
4. **What the ML model predicts** — probability of eligibility given all features, with SHAP-derived top-3 contributions explaining the prediction.
5. **What the fraud rules say** — overclaim, duplicate-parcel, non-cropped land, income inconsistency, cadastral mismatch, crop-history mismatch, anomaly.

The output is a decision (`APPROVED` / `REJECTED` / `FLAGGED`), a human-readable explanation, and — if approved — an HMAC-signed payout to the bank. Every state transition is written to an insert-only audit log and broadcast over a WebSocket so the farmer watches their application progress live.

---

## 2 · Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────┐
│                           React UI (5173)                        │
│       Landing • Login • Dashboard • ApplyWizard • Status         │
│                    Admin: Queue • Audit • Demo                   │
└───────────┬──────────────────────────────────────┬───────────────┘
            │ HTTP + JWT                           │ WebSocket
            ▼                                      ▼
┌──────────────────────────────────────────────────────────────────┐
│                        FastAPI backend (8000)                    │
│   /api/auth  /api/schemes  /api/applications  /api/admin         │
│   /api/demo  /api/health   /api/ws/applications/{id}             │
└───────┬─────────┬──────────────┬──────────────┬──────────────────┘
        │         │              │              │
        ▼         ▼              ▼              ▼
   MongoDB     Redis        Celery worker    MinIO/S3
 (subsidy +   (broker +   (verify_application,  (NDVI
   mocks DBs)  pub/sub)    execute_dbt_task)   previews)
        ▲                      │
        │    ┌─────────────────┼──────────────────────┐
        │    ▼                 ▼                      ▼
        │ Copernicus      Land-mock (:9100)      Bank-mock (:9000)
        │ Sentinel-2      polygon-matched        HMAC-verified
        │ (optional)      cadastral registry     ledger with KYC
        └────────────────────────────────────────────────────────
```

Three independent processes cooperate: the **API** (request/response), the **worker** (long-running verification + DBT), and the **frontend** (UI). Redis is shared between Celery (task queue) and the event bus (pub/sub for WebSocket pushes). MongoDB holds two logical databases — `subsidy` for real application state, `mocks` for the persistent simulated cadastral + bank world.

---

## 3 · Request → decision: the complete data flow

When a farmer clicks **Submit** in the wizard, here is exactly what happens:

1. **HTTP POST** `/api/applications/` arrives at FastAPI with a JWT header.
2. `security.get_current_active_user` decodes the JWT, returns `{sub, role, exp}`.
3. `applications.submit()` validates the polygon via the Pydantic `ApplicationCreate` model (which enforces closed-ring geometry, min 0.1 ha, etc.), ensures no active duplicate exists for this `(farmer, scheme)` pair, and inserts an application document with `status=SUBMITTED`.
4. `audit.log()` inserts an entry into `audit_log` *and* publishes a `state_change` event to Redis channel `app:<id>`.
5. A Celery task `app.workers.tasks.verify_application` is dispatched. If Redis/Celery is unavailable, the API falls back to running the task inline so the submission never silently fails.
6. HTTP 202 returns to the browser with `{application_id, status: "SUBMITTED"}`.

Meanwhile, in the worker process:

7. `verify_application` starts by atomically transitioning `SUBMITTED → VERIFYING` (using `findAndModify` with a guard predicate so duplicate dispatches don't double-process).
8. **NDVI**:
   - If `MOCK_MODE=true` or CDSE credentials aren't set → `_mock_ndvi` returns deterministic hectares + mean NDVI seeded from a hash of the polygon coordinates, plus a generated 128×128 color-mapped PNG.
   - Else → `copernicus.CDSEClient.fetch_ndvi` does OAuth2 client-credentials against the CDSE identity server, then `POST`s a Sentinel Hub Process API request with a server-side NDVI evalscript that returns both a FLOAT32 GeoTIFF and a UINT8 PNG in a single multipart response. Rasterio opens the TIFF in-memory, masks pixels where NDVI > 0.3, sums the pixel-area to hectares, and takes the mean NDVI over the mask.
   - The preview PNG is uploaded to MinIO/S3 under `previews/{app_id}_{tile_id}.png`.
   - A progress event `ndvi_fetch_done` goes out on the WebSocket channel.
9. **Cadastral lookup**: `cadastral.lookup_by_polygon` posts the polygon to the land-records mock at `/parcels/match`. That service runs a MongoDB `$geoIntersects` query against the seeded parcels (with a nearest-neighbour fallback via `$near`) and returns the full cadastral record — owner, ownership-since, ownership history, crop history, disputes, soil, irrigation, survey/khata. Any open dispute or non-agricultural classification becomes a fraud flag. Unmatched polygons raise `CADASTRAL_UNVERIFIED`.
10. **Feature vector**: assembled from declared + verified + cadastral hectares, mean NDVI, income, crop one-hot, and a derived `overclaim_ratio = declared / verified`.
11. **ML inference**: `ml.predict_and_explain` lazily loads the XGBoost model (and its SHAP explainer) on first call, predicts a probability, and returns a human-readable explanation: the top-3 features by `|shap_value|`, each annotated with a signed direction ("for" / "against") and a normalised percentage.
12. **Fraud rules**: `fraud.rule_flags` raises deterministic flags; `fraud.duplicate_parcel_flag` checks for polygon re-use across applications; `fraud.anomaly` asks the pre-fit IsolationForest whether this feature row is an outlier. A crop-history consistency check compares the declared crop against the last N seasons from the cadastral record.
13. **Decision**:
    - Any flag → `FLAGGED` (queued for admin review; DBT does not fire).
    - Else `prob ≥ 0.6` → `APPROVED`.
    - Else → `REJECTED`.
14. The application document is updated with the full evidence bundle (verified hectares, cadastral parcel, NDVI tile ID, preview URL, probability, SHAP explanation, flags, status).
15. `audit.log` appends the `VERIFYING → <decision>` entry, including the SHA-256 hash of the canonical-JSON payload.
16. If `APPROVED`, `execute_dbt_task` is dispatched.
17. The WebSocket client in the browser, listening on `/api/ws/applications/{id}`, receives every event as it's published and updates the UI — the "● live" badge, the progress label, the NDVI preview, the cadastral card, the SHAP explanation, all appear progressively.

For the DBT path:

18. `dbt.execute_dbt` loads the application + scheme, builds a canonical-JSON payload, signs it with HMAC-SHA256, POSTs to the bank mock with the signature in the `X-Signature` header.
19. The bank mock verifies the signature, dedupes by `idempotency_key` (which is the application ID — so retries never double-pay), checks KYC status and whether the account is frozen, simulates a 2% NPCI-timeout and a 1% name-mismatch failure, credits the account, and persists the transaction to `bank_txns` with an NPCI ref.
20. The application document is updated with the full receipt (bank name, IFSC, masked account, txn ID, NPCI ref, balance after). An audit entry records `APPROVED → DISBURSED` (or `DBT_FAILED`), and the UI shows a receipt block.

End to end, in mock mode this takes about 2–3 seconds. With real Sentinel Hub it's about 6–12 seconds depending on server load.

---

## 4 · Backend module responsibilities

### `app/config.py`

Single pydantic-settings class, bound to `.env`. Every service reads `settings`, no one reads environment variables directly. Adding a new config value is a one-line edit.

### `app/db.py`

The only place we construct the MongoDB client. Exports named collection handles (`farmers`, `schemes`, `applications`, `audit_log`, `ndvi_tiles`) so downstream code never writes `db["applications"]`. `ensure_indexes()` runs on FastAPI startup and creates the geosphere index on `parcel_polygon`, unique indexes on `farmer_id` / `phone` / `scheme_id` / `application_id`, and compound indexes for the common queries.

### `app/security.py`

Three responsibilities, kept small and auditable:

- `hash_password` / `verify_password` — bcrypt via Passlib, no surprises.
- `create_token` — HS256 JWT with `sub`, `role`, `iat`, `exp` (2h TTL).
- `get_current_active_user` / `require_admin` — FastAPI dependencies that decode the bearer token and enforce roles. The JWT decode allows 60s of clock leeway, so a minor clock drift between API and client doesn't spuriously reject tokens.

### `app/models.py`

All request/response Pydantic models live here. Validation happens at the edge of the system: `ApplicationCreate` validates that the polygon ring is closed and non-empty, that declared hectares is ≥ 0.1 (so Sentinel-2's 10m pixel can resolve it), etc. The service layer never needs to re-validate.

### `app/routers/*.py`

Thin HTTP adapters. They parse the request, call into the services layer, and serialise the response. No business logic lives here. For example, `applications.submit()` is about 25 lines and does exactly the steps from the data flow above.

### `app/services/audit.py`

The audit logger has exactly one public write function, `log(app_id, from_state, to_state, triggered_by, payload, note)`, which does two things: insert into `audit_log` and publish a `state_change` event. There is no `update` or `delete`. In a production deployment you'd back this with a MongoDB role that grants only `insert`/`find` on that collection, so even a compromised API can't rewrite history.

The `payload_hash` field is the SHA-256 of the canonical-JSON of the event payload. This makes the trail tamper-evident: you can reproduce the hash from the inputs and verify it.

### `app/services/satellite.py` + `app/services/copernicus.py`

Two-mode design:

- **Mock mode** synthesises NDVI statistics deterministically from a hash of the polygon, so the same polygon always gives the same NDVI across restarts. This matters for reproducible demos and repeatable tests.
- **Real mode** uses the Copernicus Sentinel Hub Process API on CDSE. The client-credentials OAuth flow caches tokens for their lifetime minus 60s. The evalscript is JavaScript that runs server-side inside the Copernicus infrastructure, so we only pay for the small output AOI, not the whole 100 MB tile. We ask for two outputs in a single request: a FLOAT32 GeoTIFF of NDVI and a UINT8 PNG preview using a colormap that matches the mock.

The multipart response is parsed via the stdlib `email` module — lightweight, no dependency.

If real-mode fails (network, quota, expired token), we log the error and fall back to mock NDVI so the pipeline never blocks.

### `app/services/cadastral.py`

Client for the land-records service. The payload is just the polygon (plus an optional aadhaar hash for stricter matching). Returned data includes the full parcel record with ownership and crop history, which is saved on the application document for audit and display.

### `app/services/ml.py`

The XGBoost model and SHAP `TreeExplainer` are loaded lazily under a lock on first inference call — the API can start before the model file exists, which matters in CI / fresh-start environments. `predict_and_explain` returns `(prob, explanation_string)`. If SHAP is unavailable or its output shape is unexpected, the code gracefully degrades to a heuristic ranking over the same feature set so users still get an explanation.

Feature schema is frozen at `FEATURE_NAMES = [declared_land_ha, verified_land_ha, cadastral_land_ha, mean_ndvi, annual_income, crop_is_high_vigor, overclaim_ratio]`. Changing it requires retraining and bumping a version — there is no silent drift.

### `app/services/fraud.py`

Pure functions over feature dicts:

| Flag | Rule |
|---|---|
| `HIGH_OVERCLAIM` | `verified < 0.7 × declared` |
| `NON_CROPPED_LAND` | `mean_ndvi < 0.15` and crop in `{wheat, rice, sugarcane, maize, cotton}` |
| `CADASTRAL_MISMATCH` | `declared > 1.10 × cadastral` |
| `CADASTRAL_UNVERIFIED` | no cadastral match |
| `DUPLICATE_PARCEL` | same polygon submitted under another `application_id` |
| `ANOMALY` | IsolationForest predicts `-1` on the feature row |
| `CROP_HISTORY_MISMATCH` | declared crop not in cadastral record's crop history |
| `CADASTRAL_DISPUTE_OPEN` | parcel has an unresolved dispute |
| `LAND_NOT_AGRICULTURAL` | parcel classification ≠ agricultural/horticultural |

Any single flag routes the application to human review.

### `app/services/dbt.py`

HMAC-SHA256 over canonical JSON, POST, parse response, persist receipt + error, emit audit entry. The idempotency key is the application ID, so a retried task never double-credits.

### `app/services/events.py` + `app/routers/ws.py`

Redis pub/sub with channels named `app:{application_id}`. The WS endpoint does an `async for msg in pubsub.listen()` and forwards each message as-is to the browser. Multiple browsers watching the same application each get their own subscription — Redis handles fan-out.

This is deliberately thin. We didn't reach for Socket.IO or server-sent events because the API surface is one-way (server → browser) and one-per-connection.

### `app/services/storage.py`

boto3 client pointed at MinIO in dev, real S3 in prod — same code, different endpoint. `ensure_bucket` is called once at API startup. Uploads happen after NDVI compute.

### `app/workers/celery_app.py` + `tasks.py`

Celery is configured with `task_acks_late` and `task_reject_on_worker_lost` so a crashed worker doesn't silently drop a task. The two task functions are thin wrappers around `_run_verify` and `dbt.execute_dbt` — the wrappers add retry policy, the logic lives in services.

### `app/routers/demo.py`

Exists so the frontend can talk to the mock cadastral + bank through the same origin as the main API, without having to punch extra CORS holes. Simple HTTP proxy; requires a JWT.

---

## 5 · The mock services: internally consistent synthetic worlds

The `mocks/` directory implements two services that would, in production, be the boundary between this platform and the Government of India. They are **realistic** — Mongo-backed, persistent across restarts, idempotent, with real HMAC verification and failure-mode simulation — not stubs that return the same canned response for every call.

### Cadastral (`mocks/land_records_server.py`)

- 30 parcels across 6 Maharashtra districts (Pune, Nashik, Aurangabad, Solapur, Kolhapur, Nagpur), seeded on first startup.
- Each parcel has a realistic polygon (0.1–1 ha rectangle jittered around a district centre), a Marathi owner name, an ownership-since date, 0–2 prior owners with transfer type (inheritance / sale-deed / partition / gift-deed), 3–5 prior seasons of crop history with yields and who verified them, plus occasional disputes (5% of parcels).
- The match endpoint uses a 2dsphere geospatial index with `$geoIntersects`, falling back to `$near` on the ring's first point if no polygon overlaps. This handles farmers who draw a slightly-off polygon.

### Bank (`mocks/bank_server.py`)

- Per-farmer account collection with bank name (SBI / BoM / HDFC / ICICI / PNB), IFSC, masked account number, KYC status, balance, frozen flag.
- First-time DBT auto-provisions an account (modelling an Aadhaar-linked banking system where everyone has a primary account).
- Every call is HMAC-verified. Idempotency is enforced via a unique sparse index on `idempotency_key`.
- Configurable failure rates: `BANK_FAIL_RATE_NPCI` (default 2%), `BANK_FAIL_RATE_KYC` (default 1%). You can force a failure by passing `?fail=1` on the request URL for manual testing.
- Every transaction persists an NPCI-style reference, balance-after, and timestamp into `bank_txns`. The admin demo page reads from this collection live.

---

## 6 · The data model

### `farmers` (subsidy db)

```json
{
  "farmer_id": "F-2026-000001",
  "full_name": "Ramesh Patil",
  "phone": "9876543210",
  "hashed_password": "<bcrypt>",
  "state": "Maharashtra",
  "district": "Pune",
  "annual_income": 180000,
  "role": "farmer" | "admin",
  "created_at": <datetime>
}
```

### `schemes` (subsidy db)

```json
{
  "scheme_id": "S-PM-KISAN",
  "scheme_name": "PM-KISAN Samman Nidhi",
  "description": "...",
  "crop_required": "any" | "wheat" | ...,
  "min_land_hectares": 0.0,
  "max_land_hectares": 100.0,
  "max_income": 1500000,
  "eligible_states": [] | ["Maharashtra", ...],
  "benefit_amount": 6000
}
```

### `applications` (subsidy db) — growing document

On submit:
```json
{
  "application_id": "A-2026-0000001",
  "farmer_id": "F-2026-000001",
  "farmer_state": "Maharashtra",
  "scheme_id": "S-PM-KISAN",
  "parcel_polygon": {"type": "Polygon", "coordinates": [[...]]},
  "declared_land_ha": 2.0,
  "crop_type": "wheat",
  "annual_income": 180000,
  "status": "SUBMITTED",
  "fraud_flags": [],
  "created_at": ..., "updated_at": ...
}
```

After verification, these fields are added:
```
verified_land_ha          mean_ndvi            cadastral_land_ha
ndvi_tile_id              ndvi_cloud_cover     ndvi_preview_url
cadastral_parcel          cadastral_match_kind eligibility_prob
shap_explanation          fraud_flags          status
```

After DBT:
```
dbt_status  dbt_txn_id  dbt_bank_name  dbt_ifsc  dbt_account_masked
dbt_npci_ref  dbt_balance_after  dbt_error
```

### `audit_log` (subsidy db) — one entry per state transition

```json
{
  "application_id": "A-2026-0000001",
  "from_state": "SUBMITTED",
  "to_state": "VERIFYING",
  "triggered_by": "orchestrator",
  "timestamp": <datetime>,
  "payload_hash": "sha256:...",
  "note": "optional human text"
}
```

### `ndvi_tiles` (subsidy db)

One entry per NDVI compute — which tile, which AOI, preview URL, cloud cover, mean NDVI. Used for audit and for the "show me the imagery evidence" admin use case.

### `parcels` (mocks db)

```json
{
  "parcel_id": "MA-PUN-0001",
  "state": "Maharashtra", "district": "Pune", "taluka": "Haveli",
  "survey_no": "87/A", "khata_no": "4217",
  "polygon": {...},
  "total_hectares": 1.83,
  "classification": "agricultural",
  "soil_type": "black cotton",
  "irrigation_source": "canal",
  "owner_name": "Ganesh More",
  "owner_aadhaar_hash": "sha256:...",
  "ownership_since": "2014-06-14",
  "ownership_history": [{"owner_name": "...", "from": "...", "to": "...", "transfer_type": "inheritance"}],
  "crop_history": [{"season": "kharif-2024", "crop": "wheat", "yield_t_per_ha": 3.2, "verified_by": "village-officer"}],
  "encumbrances": [],
  "disputes": []
}
```

### `bank_accounts`, `bank_txns` (mocks db)

Account has bank + IFSC + masked account number + KYC + balance + frozen. Txn has txn_id + NPCI ref + amount + status + error + balance-after + direction + timestamps. Every real DBT call writes one txn.

---

## 7 · The ML pipeline

### Features

Seven features, chosen so that each has a real-world justification for why it predicts eligibility:

| Feature | Rationale |
|---|---|
| `declared_land_ha` | Bigger farms have different scheme tier eligibility |
| `verified_land_ha` | Ground-truth from satellite |
| `cadastral_land_ha` | Authoritative area from the registry |
| `mean_ndvi` | Cultivation intensity |
| `annual_income` | Means-testing |
| `crop_is_high_vigor` | Whether the crop would be expected to show high NDVI |
| `overclaim_ratio` | `declared / verified` — the core fraud signal |

### Training (`scripts/train_model.py`)

Generates a 6000-row synthetic dataset in which the label `eligible` is determined by a noisy linear combination of the features. Trains an XGBoost classifier (falls back to sklearn's GradientBoosting if XGBoost isn't importable), prints the F1 on a stratified 20% holdout, and persists the pickled model to `/opt/models/eligibility.pkl`. Also trains an IsolationForest anomaly detector on the same rows for the `ANOMALY` flag.

In production, you'd replace `_synthetic_dataset()` with a Mongo query over historical `applications` with labelled outcomes.

### Inference + SHAP

`shap.TreeExplainer(model)` is built at first call. Per inference we extract SHAP values for the row, take the top-3 features by absolute value, and format:

```
mean_ndvi 42% for | overclaim_ratio 31% against | cadastral_land_ha 27% for eligibility
```

Percentages are normalised so they sum to 100 across the top-3. "for" / "against" is determined by the sign of the SHAP value. This single string is stored on the application document and displayed to the farmer.

---

## 8 · Frontend structure

The frontend is plain Vite + React + TypeScript with no UI framework — styling is done through CSS custom properties in `index.css`. This keeps the dependency footprint small and makes the theme a 20-line change.

### Router (`App.tsx`)

Role-gated via `ProtectedRoute`. Unauthenticated users are redirected to `/login`; farmers attempting to hit an `adminOnly` route are redirected to `/dashboard`.

### Auth context (`context/AuthContext.tsx`)

Reads/writes `token` and `user` to `localStorage`, exposes `login(phone, password)` and `logout()`. On 401 the axios interceptor in `api/client.ts` clears storage and kicks to `/login`.

### ApplyWizard

Four-step state machine:

1. **Declare** — sets `declared_land_ha`, `crop_type`, `annual_income`.
2. **Scheme** — calls `/api/schemes/recommend` with the declaration to show only eligible schemes.
3. **Parcel** — two paths: pick a pre-registered parcel (auto-fills polygon + size + crop, flies the map to it) or draw one with `react-leaflet-draw`. The captured polygon is the same GeoJSON shape MongoDB expects.
4. **Review** — summary + submit.

### ApplicationStatus

On mount it opens a WebSocket to `/api/ws/applications/{id}`. The `● live`/`○ offline` badge mirrors the WS state. Two event types are handled:

- `progress` — updates the small-text step label ("🛰️ Fetching Sentinel-2 imagery…"). If the event carries `preview_url`, the NDVI card gets the image immediately.
- `state_change` — triggers a fresh GET so the full application document is re-rendered.

Polling is no longer used; the WS does the pushing. An initial REST GET on mount gives us the starting state.

### Admin pages

- **Queue** — lists applications with per-row approve/reject override. Override records the admin's ID and note in the audit log.
- **Analytics** — three KPI cards + a by-status bar chart (plain CSS bars).
- **Audit timeline** — vertical timeline with SHA-256 payload hashes shown explicitly. No edit/delete UI, by design.
- **Demo data** — Leaflet map with every seeded parcel rendered as a polygon (tooltip shows owner, hectares, soil, irrigation); below it, the full global bank ledger table.

---

## 9 · Security posture

| Concern | Measure |
|---|---|
| Password storage | bcrypt via Passlib, never the raw password |
| Session | Short-TTL JWT (2h) + optional refresh flow hook |
| Role enforcement | `require_admin` dependency on every admin route |
| CSRF | Not required — tokens sent via `Authorization` header, not cookies |
| Replay of bank API | HMAC-SHA256 over canonical JSON + idempotency key |
| Tamper-evidence | Payload-hash on every audit entry; audit-log should be backed by an insert-only DB role in prod |
| Injection | Pydantic validation at the edge; pymongo parameterises queries |
| PII in logs | Aadhaar is stored only as `sha256:` hash, never raw |
| Rate limiting | Relying on ingress; not implemented in-app yet |

---

## 10 · Design decisions and why

**Why MongoDB, not Postgres?** Cadastral polygons are GeoJSON and Mongo's 2dsphere index + `$geoIntersects` is the cleanest way to match them. Applications are wide, sparsely-populated documents whose shape grows as verification progresses (NDVI, cadastral parcel, SHAP, DBT receipt) — a document store fits better than a normalised schema with many nullable columns. Audit log is append-only by contract; Mongo's role system supports insert-only privileges naturally.

**Why Celery + Redis, not async background tasks in FastAPI?** Verification involves a 1–10s external HTTP call (Copernicus) and a secondary dispatch (DBT). Running it in-process would tie up the API event loop and complicate retries. Celery gives us acks-late, retries with exponential backoff, multi-worker scaling, and a clean separation of concerns. Redis doubles as the WS event bus, so we get fan-out for free.

**Why WebSocket pub/sub and not polling?** Polling at 4s (what v1 had) wastes traffic during the 10+ seconds of real Sentinel-2 call and gives a laggy UX. A WS with Redis pub/sub is ~100 lines total, pushes within milliseconds, and scales across multiple API replicas because Redis fans out.

**Why run the mock cadastral + bank against Mongo rather than hard-coding Python dicts?** So a demo is indistinguishable from the real thing from the client's side — polygon matching really uses a geosphere index, idempotency really uses a unique DB constraint, failure injection really produces persistent failed transactions. This also means a tester can grep for a specific `npci_ref` across time and find it.

**Why Vite + plain CSS, not Next.js / Tailwind?** The UI is dev-server-first and doesn't need SSR. Tailwind's setup overhead outweighs the win on a ten-page app. Plain CSS with custom properties keeps dependencies minimal and makes the theme one file.

**Why SHAP for explanations?** It gives signed, locally-faithful attributions for tree models — exactly what a farmer needs to understand "why was I rejected?". Heuristic fallback is there in case SHAP misbehaves on new XGBoost versions so the explanation is never empty.

**Why mock Sentinel-2 deterministically from polygon hash?** So demos are reproducible. Same polygon → same NDVI → same decision — critical when debugging fraud rules or demoing the same flow twice in a row.

---

## 11 · Extension points

- **Swap synthetic training data for real labels.** Pull from Mongo, retrain nightly, version the model in `models_col`, blue/green roll out by pointing `MODEL_PATH` at the new file.
- **Add a second satellite source.** `satellite.compute_ndvi` is the only signature any consumer depends on; adding Planet or Landsat under the same contract is straightforward.
- **Real bank integration.** `dbt.execute_dbt` already does HMAC + canonical JSON. Replace the URL and the signing key, keep the contract.
- **Per-state cadastral federation.** `cadastral.lookup_by_polygon` accepts any HTTP endpoint. Route to different URLs based on the polygon's centroid state.
- **Blockchain anchoring.** The audit log's SHA-256 payload-hash per entry is the natural anchor point — a nightly Merkle root of the day's hashes published on-chain gives you an external immutability check.
- **Multi-season aggregation.** Require ≥ 2 NDVI observations across 30 days showing vegetation growth to defeat adversarial painted tarps.

---

## 12 · What could break — and what to check

| Failure | Where to look |
|---|---|
| Application stuck `VERIFYING` | `docker compose logs worker` — usually a Mongo write timeout or an unhandled exception in a service |
| Wrong NDVI values | Check `satellite.py` mock branch; rehash a polygon to confirm determinism; for real mode, check the CDSE token cache and the evalscript |
| Flag false-positive | Bisect with `pytest tests/test_fraud.py`; rules are pure functions and easy to test |
| DBT 504 | Bank mock is simulating an NPCI timeout; retry logic in Celery should take over |
| Audit entry without `payload_hash` | Caller passed `payload=None`; this is allowed for pure transitions but should be rare |

---

That's the whole picture. If you find a corner that isn't covered here, open an issue and a short explanation will be added.
