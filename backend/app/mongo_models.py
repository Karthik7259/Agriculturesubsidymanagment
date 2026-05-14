from __future__ import annotations
from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from bson import ObjectId


def _oid_str() -> str:
    return str(ObjectId())


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: List[List[List[float]]]


class BankAccount(BaseModel):
    bank_id: str
    account_number_hash: str
    account_masked: str
    ifsc_code: str
    bank_name: str
    account_holder_name: str
    verified_flag: bool


class Farmer(BaseModel):
    _id: str = Field(default_factory=_oid_str, alias="_id")
    farmer_id: str
    full_name: str
    aadhaar_hash: str
    phone: str
    password_hash: str
    email: Optional[str] = None
    language_preference: Optional[str] = None
    annual_income: Optional[float] = None
    address: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    bank_accounts: List[BankAccount] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {},
    }


class Crop(BaseModel):
    crop_id: str
    crop_name: str
    season: str
    sowing_date: Optional[datetime] = None
    expected_harvest_date: Optional[datetime] = None


class LandRecord(BaseModel):
    _id: str = Field(default_factory=_oid_str, alias="_id")
    land_id: str
    farmer_id: str
    survey_number: Optional[str] = None
    cadastral_land_ha: Optional[float] = None
    soil_type: Optional[str] = None
    ownership_status: Optional[str] = None
    verified_flag: bool = False
    parcel_polygon: Optional[GeoJSONPolygon] = None
    current_crops: List[Crop] = []

    model_config = {"populate_by_name": True}


class Scheme(BaseModel):
    _id: str = Field(default_factory=_oid_str, alias="_id")
    scheme_id: str
    scheme_name: str
    description: Optional[str] = None
    min_land_ha: Optional[float] = 0.0
    max_land_ha: Optional[float] = 0.0
    max_income: Optional[float] = None
    eligible_crops: List[str] = []
    benefit_type: Literal["FLAT_RATE", "PER_HECTARE"] = "FLAT_RATE"
    subsidy_amount: float
    is_active: bool = True

    model_config = {"populate_by_name": True}


class SatelliteVerification(BaseModel):
    ndvi_value: Optional[float] = None
    cloud_cover: Optional[float] = None
    verified_land_ha: Optional[float] = None
    crop_detected: Optional[str] = None
    verification_status: Optional[str] = None
    image_url: Optional[str] = None
    verification_date: Optional[datetime] = None


class EligibilityCheck(BaseModel):
    land_valid: bool
    crop_valid: bool
    scheme_rules_valid: bool
    eligibility_score: Optional[float] = None
    result: Optional[str] = None
    checked_at: Optional[datetime] = None


class FraudDetection(BaseModel):
    duplicate_flag: bool = False
    data_mismatch_flag: bool = False
    suspicious_pattern_flag: bool = False
    fraud_score: Optional[float] = None
    risk_level: Optional[str] = None
    fraud_flags: List[str] = []
    checked_at: Optional[datetime] = None


class DecisionExplanation(BaseModel):
    decision: Optional[str] = None
    reason_text: Optional[str] = None
    confidence_score: Optional[float] = None
    generated_at: Optional[datetime] = None


class SubsidyTransaction(BaseModel):
    calculated_payout_amount: Optional[float] = None
    transaction_status: Optional[str] = None
    reference_number: Optional[str] = None
    transaction_date: Optional[datetime] = None
    bank_account_masked: Optional[str] = None


class Application(BaseModel):
    _id: str = Field(default_factory=_oid_str, alias="_id")
    application_id: str
    farmer_id: str
    scheme_id: str
    land_id: str
    season: str
    status: Optional[str] = None
    application_date: Optional[datetime] = None
    declared_land_ha: Optional[float] = None
    declared_crop: Optional[str] = None
    satellite_verification: Optional[SatelliteVerification] = None
    eligibility_check: Optional[EligibilityCheck] = None
    fraud_detection: Optional[FraudDetection] = None
    decision_explanation: Optional[DecisionExplanation] = None
    subsidy_transaction: Optional[SubsidyTransaction] = None

    model_config = {"populate_by_name": True}


class AuditLog(BaseModel):
    _id: str = Field(default_factory=_oid_str, alias="_id")
    log_id: str
    application_id: str
    actor_id: str
    action: str
    payload_hash: Optional[str] = None
    remarks: Optional[str] = None
    timestamp: Optional[datetime] = None


class Notification(BaseModel):
    _id: str = Field(default_factory=_oid_str, alias="_id")
    notification_id: str
    farmer_id: str
    message: str
    status: Optional[str] = None
    timestamp: Optional[datetime] = None
