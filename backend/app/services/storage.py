"""MinIO / S3 storage wrapper for NDVI previews and (optionally) raw TIFFs."""

from __future__ import annotations

import json
import logging
from functools import lru_cache

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from ..config import settings


log = logging.getLogger(__name__)


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
    s3 = get_s3()
    try:
        s3.head_bucket(Bucket=bucket)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in ("404", "NoSuchBucket"):
            s3.create_bucket(Bucket=bucket)
            log.info("Created S3 bucket: %s", bucket)
        else:
            log.warning("head_bucket failed for %s: %s", bucket, exc)

    # Allow anonymous reads so the browser can render preview PNGs.
    # Safe for dev/demo; tighten in prod (e.g. use presigned URLs).
    try:
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        s3.put_bucket_policy(Bucket=bucket, Policy=json.dumps(policy))
    except ClientError as exc:
        log.warning("Could not set public-read policy on %s: %s", bucket, exc)


def upload_bytes(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    bucket = settings.s3_bucket_tiles
    s3 = get_s3()
    s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
    return f"{_public_base()}/{bucket}/{key}"


def public_url(key: str) -> str:
    return f"{_public_base()}/{settings.s3_bucket_tiles}/{key}"
