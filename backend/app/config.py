from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://localhost:27017/subsidy"
    jwt_secret: str = "dev-secret-change-me"
    jwt_algo: str = "HS256"
    jwt_ttl_hours: int = 2

    mock_mode: bool = True

    # Legacy Copernicus password-grant creds (kept for STAC/direct-data paths)
    copernicus_user: str = ""
    copernicus_pass: str = ""

    # Sentinel Hub on CDSE — OAuth client-credentials (recommended)
    cdse_client_id: str = ""
    cdse_client_secret: str = ""

    bank_api_url: str = "http://bank-mock:9000/payouts"
    bank_hmac_key: str = "dev-bank-hmac-key"

    land_records_api: str = "http://land-mock:9100/parcels"
    land_records_token: str = "dev-land-token"

    s3_endpoint: str = "http://minio:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_tiles: str = "subsidy-ndvi-dev"

    model_path: str = "/opt/models/eligibility.pkl"
    isoforest_path: str = "/opt/models/isoforest.pkl"

    celery_broker: str = "redis://redis:6379/0"
    celery_backend: str = "redis://redis:6379/1"

    aws_region: str = "ap-south-1"

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")


settings = Settings()
