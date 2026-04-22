from pymongo import MongoClient, ASCENDING, GEOSPHERE, DESCENDING
from .config import settings


_client = MongoClient(settings.mongo_uri)
db = _client.get_default_database()

farmers = db.farmers
schemes = db.schemes
applications = db.applications
audit_log = db.audit_log
ndvi_tiles = db.ndvi_tiles
models_col = db.models


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
