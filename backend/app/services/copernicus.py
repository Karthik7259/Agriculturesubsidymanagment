"""Copernicus Data Space Ecosystem client — real Sentinel-2 NDVI.

Uses the Sentinel Hub Process API hosted on CDSE (free tier: 30k PU/month).
Authenticates via OAuth2 client-credentials flow; requests a server-side
NDVI evalscript that returns both a FLOAT32 GeoTIFF (for analysis) and a
UINT8 PNG preview (for the UI) in a single multipart response.

Setup:
    1. Register at https://dataspace.copernicus.eu (free).
    2. At https://shapps.dataspace.copernicus.eu/dashboard create an OAuth
       client and paste its CLIENT_ID / CLIENT_SECRET into .env as
       CDSE_CLIENT_ID / CDSE_CLIENT_SECRET.
    3. Set MOCK_MODE=false.
"""

from __future__ import annotations

import email
import io
import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from ..config import settings


log = logging.getLogger(__name__)


TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"


_EVALSCRIPT = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"], units: "REFLECTANCE" }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "preview", bands: 3, sampleType: "UINT8" }
    ]
  };
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function colormap(v) {
  // NDVI to RGB: brown (low) -> yellow -> green (high)
  if (v < 0)   return [139, 90, 43];
  if (v < 0.15) return [214, 180, 100];
  if (v < 0.30) return [255, 230, 130];
  if (v < 0.45) return [170, 210, 100];
  if (v < 0.60) return [90, 180, 90];
  if (v < 0.75) return [40, 140, 60];
  return [20, 95, 40];
}
function evaluatePixel(s) {
  if (s.dataMask === 0) {
    return { ndvi: [NaN], preview: [0, 0, 0] };
  }
  const ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6);
  return {
    ndvi: [ndvi],
    preview: colormap(clamp(ndvi, -1, 1))
  };
}
"""


class CDSEClient:
    def __init__(self) -> None:
        self._token: str | None = None
        self._token_expiry: float = 0.0

    def _is_configured(self) -> bool:
        return bool(settings.cdse_client_id and settings.cdse_client_secret)

    def _get_token(self) -> str:
        if self._token and time.time() < self._token_expiry - 60:
            return self._token

        if not self._is_configured():
            raise RuntimeError(
                "CDSE_CLIENT_ID / CDSE_CLIENT_SECRET not set — "
                "either enable MOCK_MODE=true or configure Copernicus creds."
            )

        r = httpx.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": settings.cdse_client_id,
                "client_secret": settings.cdse_client_secret,
            },
            timeout=20.0,
        )
        r.raise_for_status()
        data = r.json()
        self._token = data["access_token"]
        self._token_expiry = time.time() + int(data.get("expires_in", 600))
        return self._token

    def _process_payload(self, polygon: dict, within_days: int) -> dict[str, Any]:
        to_dt = datetime.now(timezone.utc)
        from_dt = to_dt - timedelta(days=within_days)
        return {
            "input": {
                "bounds": {
                    "geometry": polygon,
                    "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"},
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {
                                "from": from_dt.isoformat().replace("+00:00", "Z"),
                                "to": to_dt.isoformat().replace("+00:00", "Z"),
                            },
                            "maxCloudCoverage": 30,
                            "mosaickingOrder": "leastCC",
                        },
                    }
                ],
            },
            "output": {
                "resx": 10,
                "resy": 10,
                "responses": [
                    {"identifier": "ndvi", "format": {"type": "image/tiff"}},
                    {"identifier": "preview", "format": {"type": "image/png"}},
                ],
            },
            "evalscript": _EVALSCRIPT,
        }

    def fetch_ndvi(self, polygon: dict, within_days: int = 15) -> dict[str, Any]:
        token = self._get_token()
        payload = self._process_payload(polygon, within_days)

        r = httpx.post(
            PROCESS_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "multipart/mixed",
            },
            timeout=60.0,
        )
        if r.status_code == 404 or r.status_code == 400:
            log.warning("CDSE returned %s: %s", r.status_code, r.text[:400])
            raise RuntimeError(f"Sentinel Hub Process API error: {r.status_code}")
        r.raise_for_status()

        ctype = r.headers.get("content-type", "")
        parts = self._parse_multipart(r.content, ctype)
        ndvi_tiff = parts.get("ndvi") or parts.get("image/tiff")
        preview_png = parts.get("preview") or parts.get("image/png")
        if not ndvi_tiff:
            raise RuntimeError("CDSE response missing NDVI TIFF part")

        return {
            "ndvi_tiff": ndvi_tiff,
            "preview_png": preview_png,
            "acquired_at": datetime.now(timezone.utc),
        }

    @staticmethod
    def _parse_multipart(content: bytes, content_type: str) -> dict[str, bytes]:
        """Parse a multipart/mixed response body into a {name: bytes} dict."""
        wrapped = b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + content
        msg = email.message_from_bytes(wrapped)
        out: dict[str, bytes] = {}
        if not msg.is_multipart():
            return out
        for i, part in enumerate(msg.get_payload()):
            name = None
            cd = part.get("Content-Disposition", "")
            for tok in cd.split(";"):
                tok = tok.strip()
                if tok.startswith("name="):
                    name = tok.split("=", 1)[1].strip('"')
            if not name:
                name = part.get_content_type() or f"part-{i}"
            out[name] = part.get_payload(decode=True)
        return out


_client: CDSEClient | None = None


def get_client() -> CDSEClient:
    global _client
    if _client is None:
        _client = CDSEClient()
    return _client
