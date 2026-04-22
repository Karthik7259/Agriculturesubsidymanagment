import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .db import ensure_indexes
from .routers import auth, schemes, applications, admin, health, ws, demo
from .services import storage


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_indexes()
    try:
        storage.ensure_bucket()
    except Exception as exc:
        logging.warning("S3/MinIO bucket setup failed: %s", exc)
    logging.info("Indexes ensured. MOCK_MODE=%s CDSE=%s", settings.mock_mode, bool(settings.cdse_client_id))
    yield


app = FastAPI(title="AI Agricultural Subsidy Platform", version="1.0.0", lifespan=lifespan)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(schemes.router, prefix="/api/schemes", tags=["schemes"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(demo.router, prefix="/api/demo", tags=["demo"])
app.include_router(ws.router, prefix="/api", tags=["ws"])


@app.get("/")
def root():
    return {"service": "AI Agricultural Subsidy Platform", "version": "1.0.0"}
