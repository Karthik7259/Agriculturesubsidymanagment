from pymongo import MongoClient, ASCENDING, GEOSPHERE, DESCENDING
from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings


# Synchronous (existing) client
_client = MongoClient(settings.mongo_uri)
db = _client.get_default_database()

farmers = db.farmers
schemes = db.schemes
applications = db.applications
audit_log = db.audit_log
ndvi_tiles = db.ndvi_tiles
models_col = db.models
land_records = db.land_records


def ensure_indexes() -> None:
    farmers.create_index([("farmer_id", ASCENDING)], unique=True)
    farmers.create_index([("phone", ASCENDING)], unique=True)

    schemes.create_index([("scheme_id", ASCENDING)], unique=True)

    applications.create_index([("application_id", ASCENDING)], unique=True)
    applications.create_index([("farmer_id", ASCENDING), ("created_at", DESCENDING)])
    applications.create_index([("status", ASCENDING)])
    try:
        applications.create_index([("parcel_polygon", GEOSPHERE)])
    except Exception:
        pass

    audit_log.create_index([("application_id", ASCENDING), ("timestamp", ASCENDING)])

    ndvi_tiles.create_index([("application_id", ASCENDING), ("acquired_at", DESCENDING)])


# Asynchronous Motor client helper
async_client = AsyncIOMotorClient(settings.mongo_uri)
async_db = async_client.get_default_database()

afarmers = async_db.farmers
aschemes = async_db.schemes
aapplications = async_db.applications
aaudit_log = async_db.audit_log
andvi_tiles = async_db.ndvi_tiles
amodels_col = async_db.models


async def ensure_indexes_async() -> None:
    await afarmers.create_index([("farmer_id", ASCENDING)], unique=True)
    await afarmers.create_index([("phone", ASCENDING)], unique=True)

    await aschemes.create_index([("scheme_id", ASCENDING)], unique=True)

    await aapplications.create_index([("application_id", ASCENDING)], unique=True)
    await aapplications.create_index([("farmer_id", ASCENDING), ("created_at", DESCENDING)])
    await aapplications.create_index([("status", ASCENDING)])
    try:
        await aapplications.create_index([("parcel_polygon", GEOSPHERE)])
    except Exception:
        pass

    await aaudit_log.create_index([("application_id", ASCENDING), ("timestamp", ASCENDING)])

    await andvi_tiles.create_index([("application_id", ASCENDING), ("acquired_at", DESCENDING)])
