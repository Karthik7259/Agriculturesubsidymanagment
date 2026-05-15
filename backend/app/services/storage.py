"""MinIO / S3 storage wrapper for NDVI previews and (optionally) raw TIFFs.
Falls back to local filesystem when S3/MinIO is unavailable."""

from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path

import boto3
from botocore.client import Config

from ..config import settings


log = logging.getLogger(__name__)

# Local storage fallback path
LOCAL_STORAGE_PATH = Path("ndvi_uploads")


def _get_local_path(key: str) -> Path:
    """Get local filesystem path for a given key."""
    LOCAL_STORAGE_PATH.mkdir(exist_ok=True)
    return LOCAL_STORAGE_PATH / key


@lru_cache(maxsize=1)
def get_s3():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def _public_base() -> str:
    """Endpoint the browser can reach. Falls back to s3_endpoint if unset."""
    return (settings.s3_public_endpoint or settings.s3_endpoint).rstrip("/")


def ensure_bucket(name: str | None = None) -> None:
    bucket = name or settings.s3_bucket_tiles

    # Try S3 first, fall back to local storage
    try:
        s3 = get_s3()
        s3.head_bucket(Bucket=bucket)
        log.info("S3 bucket available: %s", bucket)
        return
    except Exception:
        pass

    # Fallback to local filesystem
    LOCAL_STORAGE_PATH.mkdir(exist_ok=True)
    log.info("Using local storage fallback at: %s", LOCAL_STORAGE_PATH.resolve())


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    bucket = settings.s3_bucket_tiles
    s3 = get_s3()

    # Try S3 first
    try:
        s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
        return f"{_public_base()}/{bucket}/{key}"
    except Exception:
        pass

    # Fallback to local filesystem
    local_path = _get_local_path(key)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_bytes(data)
    log.info("Saved preview locally: %s", local_path)
    return f"http://localhost:8000/ndvi-uploads/{key}"


def public_url(key: str) -> str:
    return f"{_public_base()}/{settings.s3_bucket_tiles}/{key}"
