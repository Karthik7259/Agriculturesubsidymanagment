from datetime import datetime, timedelta, timezone
from uuid import uuid4
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pymongo.errors import DuplicateKeyError

from ..db import aadhaar_otp_sessions, farmers
from ..models import AadhaarOtpStartRequest, AadhaarOtpVerifyRequest, RegisterRequest, LoginResponse
from ..services.income import derive_annual_income, aadhaar_hash
from ..services.government_data import fetch_or_create_profile, fetch_or_create_profile_by_hash, primary_land, serialize_profile
from ..security import hash_password, verify_password, create_token, get_current_active_user
from ..utils.ids import gen_farmer_id


router = APIRouter()


@router.post("/aadhaar/start")
def start_aadhaar_otp(body: AadhaarOtpStartRequest):
    aadhaar = aadhaar_hash(body.aadhaar_number)
    session_id = f"OTP-{uuid4().hex}"
    otp = "123456"
    aadhaar_otp_sessions.insert_one({
        "session_id": session_id,
        "aadhaar_hash": aadhaar,
        "full_name": body.full_name,
        "otp": otp,
        "verified": False,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
    })
    return {
        "session_id": session_id,
        "delivery": "demo",
        "message": "Demo OTP generated. Use 123456.",
        "demo_otp": otp,
    }


@router.post("/aadhaar/verify")
def verify_aadhaar_otp(body: AadhaarOtpVerifyRequest):
    session = aadhaar_otp_sessions.find_one({"session_id": body.session_id})
    if not session:
        raise HTTPException(404, "OTP session not found or expired")
    if session.get("otp") != body.otp:
        raise HTTPException(401, "Invalid OTP")

    token = f"AV-{uuid4().hex}"
    aadhaar_otp_sessions.update_one(
        {"session_id": body.session_id},
        {"$set": {"verified": True, "verification_token": token, "verified_at": datetime.now(timezone.utc)}},
    )
    return {
        "aadhaar_otp_token": token,
        "profile": serialize_profile(fetch_or_create_profile_by_hash(session["aadhaar_hash"], session.get("full_name"))),
    }


@router.post("/register", status_code=201)
def register(body: RegisterRequest):
    if farmers.find_one({"phone": body.phone}):
        raise HTTPException(409, "Phone already registered")
    aadhaar = aadhaar_hash(body.aadhaar_number)
    if farmers.find_one({"aadhaar_hash": aadhaar}):
        raise HTTPException(409, "Aadhaar already registered")
    verified = aadhaar_otp_sessions.find_one({
        "aadhaar_hash": aadhaar,
        "verification_token": body.aadhaar_otp_token,
        "verified": True,
    })
    if not verified:
        raise HTTPException(401, "Complete Aadhaar OTP verification before registration")

    govt_profile = fetch_or_create_profile(body.aadhaar_number, body.full_name)
    land = primary_land(govt_profile)
    financial = govt_profile.get("financial") or {}
    personal = govt_profile.get("personal") or {}

    income_info = derive_annual_income(
        aadhaar_number=body.aadhaar_number,
        land_id=body.land_id or land.get("land_id"),
        consent_to_tax_fetch=body.consent_to_tax_fetch,
    )
    annual_income = body.annual_income
    if annual_income is None:
        annual_income = financial.get("annual_income")
    if annual_income is None:
        annual_income = income_info.get("annual_income")
    if annual_income is None:
        raise HTTPException(422, "Provide annual income or use a seeded Aadhaar profile")

    farmer_id = gen_farmer_id()
    for _ in range(5):
        if not farmers.find_one({"farmer_id": farmer_id}):
            break
        farmer_id = gen_farmer_id()

    doc = {
        "farmer_id": farmer_id,
        "full_name": body.full_name or personal.get("full_name"),
        "phone": body.phone,
        "hashed_password": hash_password(body.password),
        "aadhaar_hash": aadhaar,
        "land_id": body.land_id or land.get("land_id"),
        "consent_to_tax_fetch": body.consent_to_tax_fetch,
        "state": body.state or land.get("state"),
        "district": body.district or land.get("district"),
        "taluka": land.get("taluk") or land.get("taluka"),
        "village": land.get("village"),
        "annual_income": annual_income,
        "annual_income_source": income_info.get("income_source") or "synthetic_government_profile",
        "annual_income_basis_hectares": income_info.get("income_basis_hectares"),
        "annual_income_evidence": income_info.get("income_evidence"),
        "income_derivation_attempts": income_info.get("income_derivation_attempts", []),
        "government_profile": serialize_profile(govt_profile),
        "land_records": govt_profile.get("land_records", []),
        "crop_history": (govt_profile.get("agriculture") or {}).get("crop_history", []),
        "financial_records": financial,
        "farmer_category": govt_profile.get("farmer_category"),
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
