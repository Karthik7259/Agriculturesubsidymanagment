# 📊 Data Storage Architecture & Schema

## 🗄️ Database Overview

```
┌─────────────────────────────────────────────────────────────┐
│ APPLICATION DATA FLOW                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  MongoDB (Primary)    Redis (Cache/Pub-Sub)    S3/MinIO     │
│  ├─ farmers           ├─ celery_broker         ├─ preview   │
│  ├─ schemes           ├─ celery_backend        │  images    │
│  ├─ applications      └─ pub/sub channels      └─ raw TIFF  │
│  ├─ audit_log                                               │
│  ├─ ndvi_tiles        External APIs                         │
│  └─ models            ├─ Copernicus (Sentinel-2)            │
│                       ├─ Land Records Mock                  │
│                       └─ Bank Mock                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

# 1️⃣ MONGODB (Primary Database)

**Connection:** `mongodb://mongo:27017/subsidy`

---

## Collection: `farmers`

**Purpose:** User profiles and authentication

**Indexes:**
- `farmer_id` (UNIQUE)
- `phone` (UNIQUE)

**Schema:**
```json
{
  "_id": ObjectId,
  "farmer_id": "FRM-XXXXXXXXXX",              // Unique ID
  "full_name": "Ramesh Patil",               // Full name
  "phone": "9876543210",                     // 10-15 digits, unique
  "hashed_password": "bcrypt_hash",          // Never stored in plain text
  "state": "Maharashtra",                    // State name
  "district": "Pune",                        // District name
  "annual_income": 750000.0,                 // In rupees
  "role": "farmer",                          // "farmer" or "admin"
  "created_at": ISODate("2026-04-30T10:00:00Z"),
  "updated_at": ISODate("2026-04-30T10:00:00Z")  // Optional
}
```

**Example:**
```json
{
  "_id": ObjectId("6609fb1234567890abcdef01"),
  "farmer_id": "FRM-B8A2F9E1",
  "full_name": "Ramesh Patil",
  "phone": "9876543210",
  "hashed_password": "$2b$12$...",
  "state": "Maharashtra",
  "district": "Pune",
  "annual_income": 750000.0,
  "role": "farmer",
  "created_at": ISODate("2026-04-15T08:30:00Z")
}
```

---

## Collection: `schemes`

**Purpose:** Government subsidy schemes

**Indexes:**
- `scheme_id` (UNIQUE)

**Schema:**
```json
{
  "_id": ObjectId,
  "scheme_id": "S-PM-KISAN",                  // Unique code
  "scheme_name": "PM-KISAN Samman Nidhi",     // Full name
  "description": "Rs 6,000 per year...",      // Details
  "crop_required": "any" | "rice" | "wheat",  // Crop constraint
  "min_land_hectares": 0.0,                   // Minimum land
  "max_land_hectares": 100.0,                 // Maximum land
  "max_income": 1500000.0,                    // Income limit in rupees
  "eligible_states": [                        // Empty = all states
    "Punjab",
    "Haryana",
    "Uttar Pradesh"
  ],
  "benefit_amount": 6000.0                    // Payment amount in rupees
}
```

**Example:**
```json
{
  "_id": ObjectId("6609fb1234567890abcdef02"),
  "scheme_id": "S-PM-KISAN",
  "scheme_name": "PM-KISAN Samman Nidhi",
  "description": "Rs 6,000 per year income support to landholding farmers.",
  "crop_required": "any",
  "min_land_hectares": 0.0,
  "max_land_hectares": 100.0,
  "max_income": 1500000.0,
  "eligible_states": [],
  "benefit_amount": 6000.0
}
```

**Seeded Schemes (9 total):**
- S-PM-KISAN (any crop, ₹6,000)
- S-FERTILIZER-SUBSIDY (any crop, ₹2,500)
- S-PADDY-MSP-BONUS (rice, ₹8,000)
- S-WHEAT-PROCUREMENT (wheat, ₹7,500)
- S-SUGARCANE-SUPPORT (sugarcane, ₹10,000)
- S-COTTON-SUBSIDY (cotton, ₹9,000)
- S-DROUGHT-RELIEF (any crop, ₹12,000)
- S-ORGANIC-CONVERSION (any crop, ₹15,000)
- S-HORTICULTURE-GRANT (any crop, ₹20,000)

---

## Collection: `applications`

**Purpose:** Subsidy applications (main workflow data)

**Indexes:**
- `application_id` (UNIQUE)
- `farmer_id` + `created_at` (compound)
- `status` (for filtering)
- `parcel_polygon` (GEOSPHERE for geo queries)

**Schema:**
```json
{
  "_id": ObjectId,
  
  // Identifiers
  "application_id": "APP-XXXXXXXXXX",         // Unique application ID
  "farmer_id": "FRM-B8A2F9E1",               // Reference to farmer
  "scheme_id": "S-PM-KISAN",                 // Reference to scheme
  
  // Status Lifecycle
  "status": "SUBMITTED | VERIFYING | APPROVED | REJECTED | FLAGGED | DISBURSED | DBT_FAILED",
  "created_at": ISODate("2026-04-30T10:00:00Z"),
  "updated_at": ISODate("2026-04-30T10:00:00Z"),
  
  // Farmer Info
  "farmer_state": "Maharashtra",              // Denormalized for queries
  "annual_income": 750000.0,
  
  // Land & Crop Data
  "parcel_polygon": {                         // GeoJSON format
    "type": "Polygon",
    "coordinates": [[[73.8567, 18.5204], ...]]
  },
  "declared_land_ha": 2.5,                   // Farmer's claim
  "crop_type": "wheat",                       // Lowercase
  
  // Verification Results
  "verified_land_ha": 2.42,                  // From NDVI calculation
  "cadastral_land_ha": 2.48,                 // From land records
  "cadastral_parcel": { ... },               // Full parcel record (nested)
  "cadastral_match_kind": "geo_intersect",   // Match method
  
  // NDVI Data
  "mean_ndvi": 0.65,                         // Vegetation health (0-1)
  "ndvi_cloud_cover": 0.05,                  // Cloud percentage
  "ndvi_tile_id": "MOCK_S2_12345678",        // Satellite tile ID
  "ndvi_preview_url": "http://minio.../...", // Link to preview PNG
  
  // ML Model Results
  "eligibility_prob": 0.78,                  // 0-1 probability
  "shap_explanation": "High land area...",   // Human-readable reason
  
  // Fraud Detection
  "fraud_flags": [                           // List of issues found
    "HIGH_OVERCLAIM",
    "NON_CROPPED_LAND"
  ],
  
  // DBT (Payment) Data
  "dbt_status": "SUCCESS | FAILED",          // Payment status
  "dbt_txn_id": "TXN-9876543210",            // Transaction ID
  "dbt_bank_name": "State Bank of India",    // Bank name
  "dbt_ifsc": "SBIN0001234",                 // Bank IFSC code
  "dbt_account_masked": "XXXX1234",          // Last 4 digits
  "dbt_npci_ref": "NPCI-REF-123456",         // NPCI reference
  "dbt_balance_after": 50000.0,              // Account balance after transfer
  "dbt_error": null                          // Error message if failed
}
```

**Example (APPROVED & DISBURSED):**
```json
{
  "_id": ObjectId("6609fb1234567890abcdef03"),
  "application_id": "APP-E5D2C1A9",
  "farmer_id": "FRM-B8A2F9E1",
  "scheme_id": "S-PM-KISAN",
  "status": "DISBURSED",
  "created_at": ISODate("2026-04-25T09:15:00Z"),
  "updated_at": ISODate("2026-04-26T11:30:00Z"),
  "farmer_state": "Maharashtra",
  "annual_income": 750000.0,
  "parcel_polygon": {
    "type": "Polygon",
    "coordinates": [[[73.8567, 18.5204], [73.8577, 18.5204], ...]]
  },
  "declared_land_ha": 2.5,
  "crop_type": "wheat",
  "verified_land_ha": 2.42,
  "cadastral_land_ha": 2.48,
  "cadastral_parcel": { /* nested full parcel object */ },
  "cadastral_match_kind": "geo_intersect",
  "mean_ndvi": 0.65,
  "ndvi_cloud_cover": 0.05,
  "ndvi_tile_id": "MOCK_S2_87654321",
  "ndvi_preview_url": "http://localhost:9010/previews/APP-E5D2C1A9_MOCK_S2_87654321.png",
  "eligibility_prob": 0.78,
  "shap_explanation": "High land area (0.45), good NDVI (0.68), eligible income",
  "fraud_flags": [],
  "dbt_status": "SUCCESS",
  "dbt_txn_id": "TXN-9876543210",
  "dbt_bank_name": "State Bank of India",
  "dbt_ifsc": "SBIN0001234",
  "dbt_account_masked": "XXXX1234",
  "dbt_npci_ref": "NPCI-REF-123456",
  "dbt_balance_after": 50000.0,
  "dbt_error": null
}
```

**Status Transitions:**
```
SUBMITTED
    ↓
VERIFYING (Celery task running)
    ├─ (if any fraud flags or prob < 0.6) → FLAGGED
    ├─ (if prob >= 0.6 & no flags) → APPROVED
    └─ (if prob < 0.6 & no flags) → REJECTED

APPROVED
    ↓
(DBT Task executes)
    ├─ (if bank transfer successful) → DISBURSED
    └─ (if bank transfer failed) → DBT_FAILED
```

---

## Collection: `audit_log`

**Purpose:** Immutable audit trail of all decisions

**Indexes:**
- `application_id` + `timestamp` (compound, for chronological lookup)

**Schema:**
```json
{
  "_id": ObjectId,
  "application_id": "APP-XXXXXXXXXX",         // Which application
  "from_state": "SUBMITTED | null",           // Previous state
  "to_state": "VERIFYING | APPROVED | ...",   // New state
  "triggered_by": "api | orchestrator | ml-inference | dbt-worker | admin",
  "timestamp": ISODate("2026-04-30T10:15:00Z"),
  "payload_hash": "sha256_hash_of_payload",   // Encrypted decision data
  "note": "Optional admin note"               // Only for admin overrides
}
```

**Example Trail (Single Application):**
```json
[
  {
    "_id": ObjectId("6609fb1234567890abcdef04"),
    "application_id": "APP-E5D2C1A9",
    "from_state": null,
    "to_state": "SUBMITTED",
    "triggered_by": "api",
    "timestamp": ISODate("2026-04-25T09:15:00Z"),
    "payload_hash": "f8e9d2c1b0a9f8e7d6c5b4a3f2e1d0c9"
  },
  {
    "_id": ObjectId("6609fb1234567890abcdef05"),
    "application_id": "APP-E5D2C1A9",
    "from_state": "SUBMITTED",
    "to_state": "VERIFYING",
    "triggered_by": "orchestrator",
    "timestamp": ISODate("2026-04-25T09:16:00Z"),
    "payload_hash": "hash_of_verify_start"
  },
  {
    "_id": ObjectId("6609fb1234567890abcdef06"),
    "application_id": "APP-E5D2C1A9",
    "from_state": "VERIFYING",
    "to_state": "APPROVED",
    "triggered_by": "ml-inference",
    "timestamp": ISODate("2026-04-25T09:25:00Z"),
    "payload_hash": "hash_includes_prob_0.78_flags_empty"
  },
  {
    "_id": ObjectId("6609fb1234567890abcdef07"),
    "application_id": "APP-E5D2C1A9",
    "from_state": "APPROVED",
    "to_state": "DISBURSED",
    "triggered_by": "dbt-worker",
    "timestamp": ISODate("2026-04-26T11:30:00Z"),
    "payload_hash": "hash_includes_txn_id_account"
  }
]
```

---

## Collection: `ndvi_tiles`

**Purpose:** Satellite imagery records and metadata

**Indexes:**
- `application_id` + `acquired_at` (compound, for fetching latest tiles)

**Schema:**
```json
{
  "_id": ObjectId,
  "application_id": "APP-XXXXXXXXXX",         // Which application
  "tile_id": "MOCK_S2_87654321",              // Unique tile ID
  "acquired_at": ISODate("2026-04-24T10:00:00Z"),  // Acquisition date
  "cloud_cover": 0.05,                        // 0-1 (0% to 100%)
  "mean_ndvi": 0.65,                          // Average NDVI value
  "hectares": 2.42,                           // Vegetated area
  "preview_url": "http://minio/.../preview.png"  // Link to PNG preview
}
```

**Example:**
```json
{
  "_id": ObjectId("6609fb1234567890abcdef08"),
  "application_id": "APP-E5D2C1A9",
  "tile_id": "MOCK_S2_87654321",
  "acquired_at": ISODate("2026-04-24T10:15:00Z"),
  "cloud_cover": 0.05,
  "mean_ndvi": 0.65,
  "hectares": 2.42,
  "preview_url": "http://localhost:9010/previews/APP-E5D2C1A9_MOCK_S2_87654321.png"
}
```

---

## Collection: `models_col`

**Purpose:** ML model versioning and metadata (optional)

**Schema:**
```json
{
  "_id": ObjectId,
  "model_name": "eligibility_xgboost",
  "version": "1.0",
  "trained_at": ISODate("2026-04-20T10:00:00Z"),
  "feature_names": [
    "declared_land_ha",
    "verified_land_ha",
    "cadastral_land_ha",
    "mean_ndvi",
    "annual_income",
    "crop_is_high_vigor",
    "overclaim_ratio"
  ],
  "accuracy": 0.87
}
```

---

# 2️⃣ REDIS (Cache & Pub/Sub)

**Connection Strings:**
- Broker: `redis://redis:6379/0` (Celery tasks)
- Backend: `redis://redis:6379/1` (Celery results)

**Purpose:** Async task queue, caching, real-time event streaming

### Pub/Sub Channels:
```
Pattern: app:{application_id}

Example: app:APP-E5D2C1A9

Messages (JSON):
{
  "type": "progress",
  "application_id": "APP-E5D2C1A9",
  "step": "ndvi_fetch_done",
  "hectares": 2.42,
  "mean_ndvi": 0.65,
  "preview_url": "http://..."
}

{
  "type": "state_change",
  "application_id": "APP-E5D2C1A9",
  "from_state": "SUBMITTED",
  "to_state": "VERIFYING",
  "triggered_by": "orchestrator",
  "timestamp": "2026-04-25T09:16:00Z"
}
```

### Celery Tasks (in Redis):
```
Queue: celery (default)

Tasks:
- app.workers.tasks.verify_application
- app.workers.tasks.execute_dbt_task

Example: 
{
  "id": "task_uuid",
  "task": "app.workers.tasks.verify_application",
  "args": ["APP-E5D2C1A9"],
  "status": "STARTED | SUCCESS | FAILURE"
}
```

---

# 3️⃣ MinIO/S3 (File Storage)

**Endpoint:** `http://minio:9000`
**Public URL:** `http://localhost:9010`
**Bucket:** `subsidy-ndvi-dev`
**Credentials:** minioadmin/minioadmin

### File Structure:
```
subsidy-ndvi-dev/
└── previews/
    ├── APP-E5D2C1A9_MOCK_S2_87654321.png
    ├── APP-F7E2D1A8_CDSE_S2_20260425_12345678.png
    ├── APP-D6E3F2C9_MOCK_S2_11223344.png
    └── ...
```

### File Details:
```
Format: PNG (8-bit RGB image)
Size: ~15-30 KB
Content: NDVI heatmap visualization
Color mapping: Brown (low NDVI) → Green (high NDVI)
Resolution: 128×128 pixels (mock) or variable (real Sentinel-2)
```

---

# 4️⃣ MOCK EXTERNAL DATABASES

These are separate MongoDB collections accessed via HTTP APIs (not directly from main app).

## Mock Database: `parcels` (Land Records)

**API Endpoint:** `http://land-mock:9100/parcels/match`

**Structure:**
```json
{
  "_id": ObjectId,
  "parcel_id": "MH-PUN-0001",                 // Unique parcel ID
  "state": "Maharashtra",
  "district": "Pune",
  "taluka": "Haveli",
  "survey_no": "245/A",                       // Survey number
  "khata_no": "8765",                         // Khata number
  "polygon": {                                // GeoJSON
    "type": "Polygon",
    "coordinates": [[[73.8567, 18.5204], ...]]
  },
  "total_hectares": 2.48,
  "classification": "agricultural",           // or "horticultural"
  "soil_type": "black cotton",
  "irrigation_source": "borewell",            // or "canal", "rainfed", "tank"
  "owner_name": "Ramesh Patil",
  "owner_aadhaar_hash": "sha256:abc123def456",
  "ownership_since": "2005-06-15T00:00:00Z",
  "ownership_history": [
    {
      "owner_name": "Ganesh More",
      "owner_aadhaar_hash": "sha256:xyz789abc123",
      "from": "1998-03-20T00:00:00Z",
      "to": "2005-06-15T00:00:00Z",
      "transfer_type": "inheritance"  // or "sale-deed", "partition", "gift-deed"
    }
  ],
  "crop_history": [
    {
      "season": "rabi-2025",
      "crop": "wheat",
      "yield_t_per_ha": 3.5,
      "verified_by": "drone-survey"  // or "village-officer", "self-declared"
    },
    {
      "season": "kharif-2024",
      "crop": "cotton",
      "yield_t_per_ha": 1.8,
      "verified_by": "village-officer"
    }
  ],
  "encumbrances": [],                         // Liens/charges on property
  "disputes": [
    {
      "opened_at": "2010-09-15T00:00:00Z",
      "status": "resolved",                   // or "pending", "rejected"
      "reason": "boundary dispute"
    }
  ],
  "updated_at": ISODate("2026-04-20T10:00:00Z")
}
```

---

## Mock Database: `bank_accounts` (Banking)

**API Endpoint:** `http://bank-mock:9000/payouts`

**Structure:**
```json
{
  "_id": ObjectId,
  "farmer_id": "FRM-B8A2F9E1",                // Reference to farmer
  "account_number_hash": "sha256:hash",
  "account_number_masked": "XXXX1234",        // Last 4 digits only
  "bank_name": "State Bank of India",
  "ifsc": "SBIN0001234",                      // IFSC code
  "name_on_account": "Ramesh Patil",
  "kyc_status": "VERIFIED | PENDING",         // KYC verification
  "balance": 50000.0,                         // Current balance
  "frozen": false,                            // Account frozen?
  "created_at": ISODate("2024-01-15T10:00:00Z")
}
```

---

# 📋 Data Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. FARMER REGISTRATION                                          │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/auth/register                                         │
│ └─→ INSERT into farmers collection                             │
│     └─→ farmer_id, hashed_password, state, district, income    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. SUBMIT APPLICATION                                           │
├─────────────────────────────────────────────────────────────────┤
│ POST /api/applications                                          │
│ └─→ INSERT into applications (SUBMITTED)                       │
│     └─→ Enqueue Celery task: verify_application               │
│         └─→ Publish Redis event: task_queued                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. VERIFICATION WORKFLOW (Celery Worker)                        │
├─────────────────────────────────────────────────────────────────┤
│ UPDATE applications SET status=VERIFYING                        │
│ INSERT into audit_log (VERIFYING event)                         │
│ Publish Redis: progress ndvi_fetch_start                        │
│     ├─→ Fetch NDVI from Copernicus/mock                        │
│     └─→ INSERT into ndvi_tiles                                 │
│     └─→ Upload preview PNG to MinIO                            │
│         └─→ Publish Redis: progress ndvi_fetch_done            │
│                                                                  │
│ Publish Redis: progress cadastral_fetch_start                   │
│     ├─→ POST to /land-mock/parcels/match                       │
│     └─→ Get cadastral_parcel from mock DB                      │
│         └─→ Publish Redis: progress cadastral_fetch_done       │
│                                                                  │
│ Publish Redis: progress ml_inference_start                      │
│     ├─→ Run XGBoost model                                       │
│     ├─→ Calculate SHAP explanation                             │
│     └─→ Check fraud rules                                       │
│         └─→ Publish Redis: progress ml_inference_done          │
│                                                                  │
│ UPDATE applications SET status=APPROVED/REJECTED/FLAGGED       │
│ INSERT into audit_log (decision)                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DBT EXECUTION (if APPROVED)                                  │
├─────────────────────────────────────────────────────────────────┤
│ Enqueue Celery task: execute_dbt_task                           │
│ POST to /bank-mock/payouts                                      │
│     ├─→ Check balance in bank_accounts                         │
│     ├─→ Deduct amount + update balance                         │
│     ├─→ Generate txn_id, NPCI ref                              │
│     └─→ Return receipt                                          │
│                                                                  │
│ UPDATE applications SET dbt_status, dbt_txn_id, etc.           │
│ UPDATE applications SET status=DISBURSED/DBT_FAILED            │
│ INSERT into audit_log (DBT result)                              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. LIVE UPDATES TO FRONTEND                                     │
├─────────────────────────────────────────────────────────────────┤
│ WebSocket /api/ws/applications/{app_id}                         │
│     ├─→ Subscribe to Redis channel: app:APP-E5D2C1A9           │
│     ├─→ Receive progress events in real-time                   │
│     ├─→ Receive state_change events                            │
│     └─→ Stream as JSON to browser                              │
│         └─→ Frontend updates UI: status, NDVI preview, decision│
└─────────────────────────────────────────────────────────────────┘
```

---

# 🔐 Data Security

| Field | Storage | Protection |
|-------|---------|-----------|
| Password | farmers.hashed_password | bcrypt (Passlib) |
| Aadhaar | Various hashes | SHA256 hash only |
| Account No. | bank_accounts.account_number_hash | SHA256 hash |
| Account Masked | dbt_account_masked | Last 4 digits only |
| Audit Payload | audit_log.payload_hash | SHA256 hash (not full data) |

---

# 📊 Database Sizing (Example with 10,000 applications)

| Collection | Approx. Size | Count |
|-----------|--------------|-------|
| farmers | ~5 MB | 2,000 |
| schemes | ~50 KB | 9 |
| applications | ~500 MB | 10,000 |
| audit_log | ~800 MB | 50,000 entries |
| ndvi_tiles | ~100 MB | 10,000 |
| S3 (NDVI PNGs) | ~300 MB | 10,000 × ~30KB |

**Total:** ~1.7 GB

---

# 🗃️ Backup Strategy

```
MongoDB:
  - Persistence: mongo_data volume (/data/db)
  - Backup command: mongodump → backup.tar.gz
  - Restore: mongorestore from backup

MinIO/S3:
  - Persistence: minio_data volume (/data)
  - Backup: S3-compatible backup tools
  - Replication: Enable MinIO replication

Redis:
  - Persistence: RDB snapshots (optional)
  - Not critical (can regenerate tasks)
```
