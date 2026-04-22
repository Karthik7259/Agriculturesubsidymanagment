from fastapi import APIRouter
from ..config import settings
from ..db import db
from ..services import ml
from ..models import HealthOut

router = APIRouter()


@router.get("/health", response_model=HealthOut)
def health():
    try:
        db.command("ping")
        mongo_ok = True
    except Exception:
        mongo_ok = False
    return HealthOut(
        status="ok" if mongo_ok else "degraded",
        mongo=mongo_ok,
        model_loaded=ml.is_loaded(),
        mock_mode=settings.mock_mode,
    )
