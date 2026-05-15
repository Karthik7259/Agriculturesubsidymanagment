from fastapi import APIRouter, Depends, HTTPException, Query
from ..db import schemes, farmers
from ..security import get_current_active_user
from ..services.recommender import recommend_for


router = APIRouter()


@router.get("/")
def list_schemes(
    state: str | None = Query(default=None),
    scheme_type: str | None = Query(default=None, description="central | state"),
    category: str | None = Query(default=None, description="income_support, insurance, irrigation, …"),
    crop: str | None = Query(default=None),
):
    query: dict = {}
    if state:
        query["$or"] = [{"eligible_states": []}, {"eligible_states": state}]
    if scheme_type:
        query["scheme_type"] = scheme_type
    if category:
        query["category"] = category
    if crop:
        query["crop_required"] = {"$in": ["any", crop.lower()]}

    out = []
    for s in schemes.find(query):
        s["_id"] = str(s["_id"])
        out.append(s)
    return out


@router.get("/categories")
def list_categories():
    """Return distinct categories and scheme_types present in the DB."""
    return {
        "categories": schemes.distinct("category"),
        "scheme_types": schemes.distinct("scheme_type"),
        "ministries": schemes.distinct("ministry"),
    }


@router.get("/recommend")
def recommend(
    declared_land_ha: float = Query(..., gt=0),
    crop_type: str | None = Query(default=None),
    user: dict = Depends(get_current_active_user),
):
    farmer = farmers.find_one({"farmer_id": user["sub"]})
    if not farmer:
        raise HTTPException(404, "Farmer not found")

    farmer_ctx = {
        "state": farmer.get("state", ""),
        "annual_income": farmer.get("annual_income", 0),
        "land_ha": declared_land_ha,
    }
    recs = recommend_for(farmer_ctx, top_k=20)

    if crop_type:
        filtered = [
            s for s in recs
            if s.get("crop_required", "any") in ("any", crop_type.lower())
        ]
        if filtered:
            recs = filtered

    return recs


@router.get("/{scheme_id}")
def get_scheme(scheme_id: str):
    s = schemes.find_one({"scheme_id": scheme_id})
    if not s:
        raise HTTPException(404, "Scheme not found")
    s["_id"] = str(s["_id"])
    return s
