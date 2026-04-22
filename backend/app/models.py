from datetime import datetime
from typing import Any, Literal, Optional
from pydantic import BaseModel, Field, field_validator


class RegisterRequest(BaseModel):
    full_name: str
    phone: str = Field(min_length=10, max_length=15)
    password: str = Field(min_length=6)
    state: str
    district: str
    annual_income: float = Field(ge=0)

    @field_validator("phone")
    @classmethod
    def digits_only(cls, v: str) -> str:
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) < 10:
            raise ValueError("phone must contain at least 10 digits")
        return digits


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    farmer_id: str


class SchemeOut(BaseModel):
    scheme_id: str
    scheme_name: str
    description: str
    crop_required: str
    min_land_hectares: float
    max_land_hectares: float
    max_income: float
    eligible_states: list[str]
    benefit_amount: float


class GeoJSONPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: list[list[list[float]]]

    @field_validator("coordinates")
    @classmethod
    def non_empty_ring(cls, v):
        if not v or not v[0] or len(v[0]) < 4:
            raise ValueError("Polygon ring must have at least 4 coordinates (closed)")
        return v


class ApplicationCreate(BaseModel):
    scheme_id: str
    parcel_polygon: GeoJSONPolygon
    declared_land_ha: float = Field(gt=0.09, description="Must be at least 0.1 ha to be resolvable by Sentinel-2")
    crop_type: str
    annual_income: float = Field(ge=0)


class ApplicationOut(BaseModel):
    application_id: str
    farmer_id: str
    scheme_id: str
    status: str
    declared_land_ha: float
    verified_land_ha: Optional[float] = None
    cadastral_land_ha: Optional[float] = None
    mean_ndvi: Optional[float] = None
    eligibility_prob: Optional[float] = None
    shap_explanation: Optional[str] = None
    fraud_flags: list[str] = []
    crop_type: str
    annual_income: float
    dbt_status: Optional[str] = None
    dbt_txn_id: Optional[str] = None
    ndvi_preview_url: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class AuditEntry(BaseModel):
    application_id: str
    from_state: Optional[str]
    to_state: str
    triggered_by: str
    timestamp: datetime
    payload_hash: Optional[str] = None
    note: Optional[str] = None


class AdminOverride(BaseModel):
    decision: Literal["APPROVED", "REJECTED"]
    note: str = Field(min_length=3)


class HealthOut(BaseModel):
    status: str
    mongo: bool
    model_loaded: bool
    mock_mode: bool
