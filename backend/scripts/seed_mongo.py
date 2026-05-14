from datetime import datetime
from bson import ObjectId
from pymongo import MongoClient
from app.config import settings
import random


def seed():
    client = MongoClient(settings.mongo_uri)
    db = client.get_default_database()

    # Farmers
    farmer = {
        "farmer_id": "FRM-0000000001",
        "full_name": "Ramesh Patil",
        "aadhaar_hash": "sha256:abc123def456",
        "phone": "9000000001",
        "password_hash": "bcrypt:xxxx",
        "email": "ramesh@example.com",
        "language_preference": "MR",
        "annual_income": 750000.0,
        "address": "123 Main St",
        "state": "Maharashtra",
        "district": "Pune",
        "taluka": "Haveli",
        "village": "Wagholi",
        "bank_accounts": [
            {
                "bank_id": "BNK-123",
                "account_number_hash": "sha256:bank_acc",
                "account_masked": "XXXX1234",
                "ifsc_code": "SBIN0001234",
                "bank_name": "State Bank of India",
                "account_holder_name": "Ramesh Patil",
                "verified_flag": True,
            }
        ],
        "created_at": datetime.utcnow(),
    }

    db.farmers.update_one(
        {"$or": [{"farmer_id": farmer["farmer_id"]}, {"phone": farmer["phone"]}]},
        {"$setOnInsert": farmer},
        upsert=True,
    )
    print("Ensured farmer", farmer["farmer_id"])

    # Land record
    land = {
        "land_id": "LND-0000000001",
        "farmer_id": farmer["farmer_id"],
        "survey_number": "245/A",
        "cadastral_land_ha": 2.48,
        "soil_type": "black cotton",
        "ownership_status": "Owned",
        "verified_flag": True,
        "parcel_polygon": {
            "type": "Polygon",
            "coordinates": [[[73.8567, 18.5204], [73.8577, 18.5204], [73.8577, 18.5214], [73.8567, 18.5204]]],
        },
        "current_crops": [
            {
                "crop_id": "CRP-1",
                "crop_name": "wheat",
                "season": "Rabi-2026",
                "sowing_date": datetime(2025, 11, 15),
                "expected_harvest_date": datetime(2026, 4, 10),
            }
        ],
    }

    db.land_records.update_one({"land_id": land["land_id"]}, {"$setOnInsert": land}, upsert=True)
    print("Ensured land", land["land_id"])

    # Scheme
    scheme = {
        "scheme_id": "S-PM-KISAN",
        "scheme_name": "PM-KISAN Samman Nidhi",
        "description": "Income support to landholding farmers.",
        "min_land_ha": 0.0,
        "max_land_ha": 100.0,
        "max_income": 1500000.0,
        "eligible_crops": ["any"],
        "benefit_type": "FLAT_RATE",
        "subsidy_amount": 6000.0,
        "is_active": True,
    }

    db.schemes.update_one({"scheme_id": scheme["scheme_id"]}, {"$setOnInsert": scheme}, upsert=True)
    print("Ensured scheme", scheme["scheme_id"])

    # Application
    application = {
        "application_id": "APP-0000000001",
        "farmer_id": farmer["farmer_id"],
        "scheme_id": scheme["scheme_id"],
        "land_id": land["land_id"],
        "season": "Rabi-2026",
        "status": "PENDING",
        "application_date": datetime.utcnow(),
        "declared_land_ha": 2.5,
        "declared_crop": "wheat",
    }

    db.applications.update_one({"application_id": application["application_id"]}, {"$setOnInsert": application}, upsert=True)
    print("Ensured application", application["application_id"])

    # Audit log
    log = {
        "log_id": "LOG-0001",
        "application_id": application["application_id"],
        "actor_id": "SYSTEM",
        "action": "REGISTERED",
        "payload_hash": "sha256:payload",
        "remarks": "Seed data",
        "timestamp": datetime.utcnow(),
    }

    db.audit_log.update_one({"log_id": log["log_id"]}, {"$setOnInsert": log}, upsert=True)
    print("Ensured audit log", log["log_id"])

    # Notification
    notif = {
        "notification_id": "NOTIF-0001",
        "farmer_id": farmer["farmer_id"],
        "message": "Your subsidy application has been received.",
        "status": "Delivered",
        "timestamp": datetime.utcnow(),
    }

    db.notifications.update_one({"notification_id": notif["notification_id"]}, {"$setOnInsert": notif}, upsert=True)
    print("Ensured notification", notif["notification_id"])


if __name__ == "__main__":
    seed()
    # create a batch of synthetic land records for testing/analysis
    def seed_batch_lands(n=30, center_lat=18.5204, center_lon=73.8567):
        client = MongoClient(settings.mongo_uri)
        db = client.get_default_database()
        soils = ["black cotton", "alluvial", "lateritic", "sandy loam"]
        ownership = ["Owned", "Leased", "Joint"]
        crops = ["wheat", "rice", "maize", "soybean"]
        for i in range(n):
            lid = f"LND-BATCH-{i+1:03d}"
            lat = center_lat + random.uniform(-0.01, 0.01)
            lon = center_lon + random.uniform(-0.01, 0.01)
            delta = random.uniform(0.0003, 0.0012)
            polygon = {
                "type": "Polygon",
                "coordinates": [[[lon, lat], [lon + delta, lat], [lon + delta, lat + delta], [lon, lat + delta], [lon, lat]]],
            }
            land_doc = {
                "land_id": lid,
                "farmer_id": "FRM-0000000001",
                "survey_number": f"SV-{1000 + i}",
                "cadastral_land_ha": round(random.uniform(0.2, 5.0), 3),
                "soil_type": random.choice(soils),
                "ownership_status": random.choice(ownership),
                "verified_flag": random.choice([True, False]),
                "parcel_polygon": polygon,
                "current_crops": [
                    {
                        "crop_id": f"CRP-B-{i+1}",
                        "crop_name": random.choice(crops),
                        "season": random.choice(["Rabi-2026", "Kharif-2025"]),
                    }
                ],
            }
            db.land_records.update_one({"land_id": lid}, {"$setOnInsert": land_doc}, upsert=True)
        print(f"Ensured {n} batch land records (prefix LND-BATCH-)")

    seed_batch_lands(30)
