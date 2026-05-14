from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import DuplicateKeyError

from ..db import farmers
from ..models import RegisterRequest, LoginResponse
from ..services.income import derive_annual_income, aadhaar_hash
from ..security import hash_password, verify_password, create_token, get_current_active_user
from ..utils.ids import gen_farmer_id


router = APIRouter()


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    if farmers.find_one({"phone": body.phone}):
        raise HTTPException(409, "Phone already registered")

    income_info = derive_annual_income(
        aadhaar_number=body.aadhaar_number,
        land_id=body.land_id,
        consent_to_tax_fetch=body.consent_to_tax_fetch,
    )
    annual_income = body.annual_income
    if annual_income is None:
        annual_income = income_info.get("annual_income")
    if annual_income is None:
        raise HTTPException(422, "Provide aadhaar_number or land_id to derive annual_income automatically")

    farmer_id = gen_farmer_id()
    for _ in range(5):
        if not farmers.find_one({"farmer_id": farmer_id}):
            break
        farmer_id = gen_farmer_id()

    doc = {
        "farmer_id": farmer_id,
        "full_name": body.full_name,
        "phone": body.phone,
        "hashed_password": hash_password(body.password),
        "aadhaar_hash": aadhaar_hash(body.aadhaar_number) if body.aadhaar_number else None,
        "land_id": body.land_id,
        "consent_to_tax_fetch": body.consent_to_tax_fetch,
        "state": body.state,
        "district": body.district,
        "annual_income": annual_income,
        "annual_income_source": income_info.get("income_source") or "manual",
        "annual_income_basis_hectares": income_info.get("income_basis_hectares"),
        "annual_income_evidence": income_info.get("income_evidence"),
        "income_derivation_attempts": income_info.get("income_derivation_attempts", []),
        "role": "farmer",
        "created_at": datetime.now(timezone.utc),
    }
    try:
        farmers.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "Duplicate farmer")

    return {"farmer_id": farmer_id, "full_name": body.full_name}


@router.post("/login", response_model=LoginResponse)
def login(form: OAuth2PasswordRequestForm = Depends()):
    digits = "".join(c for c in form.username if c.isdigit())
    user = farmers.find_one({"phone": digits})
    if not user or not verify_password(form.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid phone or password")

    token = create_token(sub=user["farmer_id"], role=user.get("role", "farmer"))
    return LoginResponse(
        access_token=token,
        token_type="bearer",
        role=user.get("role", "farmer"),
        farmer_id=user["farmer_id"],
    )


@router.get("/me")
def me(user: dict = Depends(get_current_active_user)):
    doc = farmers.find_one({"farmer_id": user["sub"]}, {"_id": 0, "hashed_password": 0})
    if not doc:
        raise HTTPException(404, "Farmer not found")
    return doc
