"""Shared Mongo connection for the mock cadastral + bank services.

Uses a dedicated `mocks` database so demo state is kept separate from the
production application collections.
"""

from __future__ import annotations

import os
from urllib.parse import urlparse, urlunparse

from pymongo import ASCENDING, DESCENDING, GEOSPHERE, MongoClient


def _mocks_uri() -> str:
    override = os.getenv("MOCKS_MONGO_URI")
    if override:
        return override
    main = os.getenv("MONGO_URI", "mongodb://mongo:27017/subsidy")
    parsed = urlparse(main)
    return urlunparse(parsed._replace(path="/mocks"))


_client = MongoClient(_mocks_uri())
db = _client.get_default_database()

parcels = db.parcels
bank_accounts = db.bank_accounts
bank_txns = db.bank_txns


def ensure_indexes() -> None:
    parcels.create_index([("parcel_id", ASCENDING)], unique=True)
    parcels.create_index([("polygon", GEOSPHERE)])
    parcels.create_index([("owner_aadhaar_hash", ASCENDING)])
    parcels.create_index([("state", ASCENDING), ("district", ASCENDING)])

    bank_accounts.create_index([("farmer_id", ASCENDING)], unique=True)
    bank_accounts.create_index([("account_number_hash", ASCENDING)], unique=True)

    bank_txns.create_index([("txn_id", ASCENDING)], unique=True)
    bank_txns.create_index([("idempotency_key", ASCENDING)], unique=True, sparse=True)
    bank_txns.create_index([("farmer_id", ASCENDING), ("created_at", DESCENDING)])
