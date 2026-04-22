"""Sentinel-2 NDVI verification.

Two code paths:

 - MOCK_MODE or missing CDSE creds → synthetic deterministic NDVI from polygon hash.
 - Real mode → Copernicus Data Space Ecosystem (Sentinel Hub Process API) returns
   a NDVI GeoTIFF + PNG preview clipped to the polygon. We read the TIFF with
   rasterio, mask NDVI > 0.3 for hectare count, upload the preview PNG to
   MinIO/S3, and persist the tile record in Mongo.
"""

from __future__ import annotations

import hashlib
import io
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from ..config import settings
from ..db import ndvi_tiles
from ..utils.geo import polygon_area_hectares
from . import storage


log = logging.getLogger(__name__)


def _seed_from_polygon(polygon: dict) -> int:
    raw = str(polygon.get("coordinates")).encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:4], "big")


def _mock_ndvi(polygon: dict, declared_ha: float | None = None) -> dict[str, Any]:
    seed = _seed_from_polygon(polygon)
    rng = np.random.default_rng(seed)

    area_ha = polygon_area_hectares(polygon["coordinates"]) or (declared_ha or 1.0)
    vegetation_fraction = float(rng.uniform(0.55, 0.95))
    mean_ndvi = float(rng.uniform(0.32, 0.72))
    cloud_cover = float(rng.uniform(0.0, 0.15))
    hectares = round(area_ha * vegetation_fraction, 3)
    acquired = datetime.now(timezone.utc) - timedelta(days=int(rng.integers(1, 15)))

    preview_png = _render_mock_preview(mean_ndvi, seed)

    return {
        "hectares": hectares,
        "mean_ndvi": round(mean_ndvi, 3),
        "tile_id": f"MOCK_S2_{seed:08x}",
        "cloud_cover": round(cloud_cover, 3),
        "acquired_at": acquired,
        "preview_png": preview_png,
    }


def _render_mock_preview(mean_ndvi: float, seed: int) -> bytes | None:
    """Generate a 128x128 colorised NDVI preview for mock mode."""
    try:
        from PIL import Image
    except ImportError:
        return None

    rng = np.random.default_rng(seed)
    base = np.clip(rng.normal(mean_ndvi, 0.1, (128, 128)), -0.2, 0.9).astype("float32")
    rgb = _ndvi_to_rgb(base)
    img = Image.fromarray(rgb, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _ndvi_to_rgb(arr: np.ndarray) -> np.ndarray:
    """Map a float NDVI array [-1..1] to an (H,W,3) uint8 RGB image."""
    out = np.zeros((*arr.shape, 3), dtype="uint8")
    colors = [
        (-1.0, (139, 90, 43)),
        (0.15, (214, 180, 100)),
        (0.30, (255, 230, 130)),
        (0.45, (170, 210, 100)),
        (0.60, (90, 180, 90)),
        (0.75, (40, 140, 60)),
        (1.0, (20, 95, 40)),
    ]
    for t, rgb in colors:
        out[arr <= t] = rgb
    out[arr > 0.75] = colors[-1][1]
    return out


def _real_ndvi_from_tiff(tiff_bytes: bytes) -> tuple[float, float]:
    """Open in-memory NDVI TIFF and compute (hectares, mean_ndvi)."""
    import rasterio
    from rasterio.io import MemoryFile

    with MemoryFile(tiff_bytes) as memfile:
        with memfile.open() as ds:
            arr = ds.read(1).astype("float32")
            transform = ds.transform

    mask = (arr > 0.3) & np.isfinite(arr)
    if not mask.any():
        return 0.0, 0.0

    px_area_m2 = abs(transform.a * transform.e)
    hectares = float(mask.sum() * px_area_m2 / 10_000.0)
    mean_ndvi = float(arr[mask].mean())
    return round(hectares, 3), round(mean_ndvi, 3)


def _real_ndvi(polygon: dict, declared_ha: float | None) -> dict[str, Any]:
    from .copernicus import get_client

    client = get_client()
    response = client.fetch_ndvi(polygon, within_days=15)

    ndvi_tiff = response["ndvi_tiff"]
    preview_png = response.get("preview_png")

    hectares, mean_ndvi = _real_ndvi_from_tiff(ndvi_tiff)

    seed = _seed_from_polygon(polygon)
    tile_id = f"CDSE_S2_{datetime.utcnow():%Y%m%d}_{seed:08x}"

    return {
        "hectares": hectares,
        "mean_ndvi": mean_ndvi,
        "tile_id": tile_id,
        "cloud_cover": None,
        "acquired_at": response["acquired_at"],
        "preview_png": preview_png,
    }


def compute_ndvi(polygon: dict, declared_ha: float | None = None) -> dict[str, Any]:
    if settings.mock_mode or not (settings.cdse_client_id and settings.cdse_client_secret):
        log.info("NDVI: MOCK_MODE (no CDSE credentials)")
        return _mock_ndvi(polygon, declared_ha)

    log.info("NDVI: hitting Copernicus Data Space")
    try:
        return _real_ndvi(polygon, declared_ha)
    except Exception as exc:
        log.error("Real NDVI failed, falling back to mock: %s", exc)
        return _mock_ndvi(polygon, declared_ha)


def persist_tile_record(application_id: str, ndvi: dict[str, Any]) -> str | None:
    """Upload preview PNG to S3 (if present) + insert an ndvi_tiles doc.

    Returns the public URL of the preview PNG (or None if preview missing).
    """
    preview_url = None
    preview_png = ndvi.get("preview_png")
    if preview_png:
        try:
            storage.ensure_bucket()
            key = f"previews/{application_id}_{ndvi.get('tile_id', 'tile')}.png"
            preview_url = storage.upload_bytes(key, preview_png, "image/png")
        except Exception as exc:
            log.warning("Preview upload failed: %s", exc)

    ndvi_tiles.insert_one(
        {
            "application_id": application_id,
            "tile_id": ndvi.get("tile_id"),
            "acquired_at": ndvi.get("acquired_at"),
            "cloud_cover": ndvi.get("cloud_cover"),
            "mean_ndvi": ndvi.get("mean_ndvi"),
            "hectares": ndvi.get("hectares"),
            "preview_url": preview_url,
        }
    )
    return preview_url
