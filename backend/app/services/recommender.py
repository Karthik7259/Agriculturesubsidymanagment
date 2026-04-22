from ..db import schemes, applications


def _approval_rate_in_state(state: str) -> float:
    total = applications.count_documents({"farmer_state": state})
    if total == 0:
        return 0.0
    approved = applications.count_documents({"farmer_state": state, "status": {"$in": ["APPROVED", "DISBURSED"]}})
    return approved / total


def recommend_for(farmer: dict, top_k: int = 10) -> list[dict]:
    state = farmer.get("state", "")
    land_ha = float(farmer.get("land_ha", 0) or 0)
    income = float(farmer.get("annual_income", 0) or 0)

    query = {
        "$and": [
            {"$or": [{"eligible_states": {"$size": 0}}, {"eligible_states": state}]},
            {"max_income": {"$gte": income}},
            {"min_land_hectares": {"$lte": max(land_ha, 0.0001)}},
        ]
    }
    base = list(schemes.find(query))

    boost = _approval_rate_in_state(state)
    for s in base:
        s["_id"] = str(s["_id"])
        s["_rank_score"] = s.get("benefit_amount", 0) * (1 + boost)

    base.sort(key=lambda s: s["_rank_score"], reverse=True)
    return base[:top_k]
