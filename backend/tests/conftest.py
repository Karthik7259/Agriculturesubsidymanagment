"""Pytest config.

For full API-integration tests you'd point `MONGO_URI` at a test DB (e.g. via
docker compose exec api pytest). The unit tests in this package don't require
Mongo — they only touch pure functions.
"""

import os


os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("MOCK_MODE", "true")
