"""Google Earth Engine-based Sentinel-2 NDVI computation.

Requires:
    pip install earthengine-api

Set in .env:
    GEE_ENABLED=true
    GEE_KEY_PATH=/path/to/service-account-key.json

This uses the free GEE tier — quotas are generous for educational/demonstration use.
"""

from __future__ import annotations

import io
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import numpy as np

from ..config import settings

log = logging.getLogger(__name__)

_gee_initialized = False


def _init_gee() -> bool:
    """Initialize GEE with service account credentials."""
    global _gee_initialized
    if _gee_initialized:
        return True

    if not settings.gee_enabled:
        log.info("GEE: disabled via settings.gee_enabled=false")
        return False

    key_path = settings.gee_key_path
    if not key_path:
        log.warning("GEE: GEE_KEY_PATH not set")
        return False

    if not os.path.exists(key_path):
        log.error("GEE: key file not found at %s", key_path)
        return False

    try:
        import ee
        # Authenticate with service account
        credentials = ee.ServiceAccountCredentials.from_service_account_file(key_path)
        ee.Initialize(credentials)
        _gee_initialized = True
        log.info("GEE: initialized successfully")
        return True
    except Exception as exc:
        log.error("GEE: initialization failed: %s", exc)
        return False


def _polygon_to_ee_geometry(polygon: dict) -> ee.geometry.Geometry:
    """Convert GeoJSON polygon to GEE Geometry."""
    import ee
    coords = polygon.get("coordinates", [])
    if not coords:
        raise ValueError("Empty polygon coordinates")
    # Handle Polygon with possibly multiple rings
    if isinstance(coords[0][0], list):
        # Multi-ring polygon
        rings = coords
    else:
        # Single ring
        rings = [coords]
    return ee.Geometry(rings)


def _colormap_ndvi(ndvi: float) -> tuple[int, int, int]:
    """Map NDVI value to RGB color."""
    if ndvi < 0:
        return (139, 90, 43)  # brown (bare soil)
    elif ndvi < 0.15:
        return (214, 180, 100)  # light brown
    elif ndvi < 0.30:
        return (255, 230, 130)  # yellow (sparse vegetation)
    elif ndvi < 0.45:
        return (170, 210, 100)  # light green
    elif ndvi < 0.60:
        return (90, 180, 90)  # green
    elif ndvi < 0.75:
        return (40, 140, 60)  # dark green
    else:
        return (20, 95, 40)  # very dark green (dense vegetation)


def _render_preview_from_ndvi(mean_ndvi: float, seed: int) -> bytes:
    """Generate a 128x128 colorised NDVI preview based on mean NDVI."""
    rng = np.random.default_rng(seed)
    base = np.clip(rng.normal(mean_ndvi, 0.1, (128, 128)), -0.2, 0.9).astype("float32")

    # Apply colormap
    rgb = np.zeros((128, 128, 3), dtype="uint8")
    thresh = [-0.2, 0.0, 0.15, 0.30, 0.45, 0.60, 0.75, 1.0]
    colors = [
        (139, 90, 43),
        (139, 90, 43),
        (214, 180, 100),
        (255, 230, 130),
        (170, 210, 100),
        (90, 180, 90),
        (40, 140, 60),
        (20, 95, 40),
    ]
    for i in range(len(thresh) - 1):
        mask = (base >= thresh[i]) & (base < thresh[i + 1])
        rgb[mask] = colors[i]
    rgb[base >= 0.75] = colors[-1]

    from PIL import Image
    img = Image.fromarray(rgb, mode="RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def compute_ndvi_gee(polygon: dict, declared_ha: float | None = None) -> dict[str, Any]:
    """Compute NDVI using Google Earth Engine Sentinel-2.

    Returns:
        dict with hectares, mean_ndvi, tile_id, cloud_cover, acquired_at, preview_png
    """
    import ee

    if not _init_gee():
        raise RuntimeError("GEE not available")

    # Convert polygon to GEE geometry
    try:
        geom = _polygon_to_ee_geometry(polygon)
    except Exception as exc:
        raise ValueError(f"Invalid polygon: {exc}")

    # Date range: last 30 days
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=30)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    log.info(f"GEE: fetching Sentinel-2 for {start_str} to {end_str}")

    # Sentinel-2 SR (Surface Reflectance)
    col = (
        ee.ImageCollection("COPERNICUS/S2_SR")
        .filterDate(start_str, end_str)
        .filterBounds(geom)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    )

    # Check if we have images
    count = col.size().getInfo()
    if count == 0:
        log.warning("GEE: no Sentinel-2 images in date range, trying 60 days")
        start_date = end_date - timedelta(days=60)
        start_str = start_date.strftime("%Y-%m-%d")
        col = (
            ee.ImageCollection("COPERNICUS/S2_SR")
            .filterDate(start_str, end_str)
            .filterBounds(geom)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 40))
        )
        count = col.size().getInfo()
        if count == 0:
            raise RuntimeError("GEE: no Sentinel-2 imagery available")

    log.info(f"GEE: found {count} Sentinel-2 images")

    # Compute NDVI: (B8 - B4) / (B8 + B4)
    # B8 = NIR (Band 8), B4 = Red (Band 4)
    def calc_ndvi(img):
        ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        return img.addBands(ndvi)

    ndvi_col = col.map(calc_ndvi)

    # Get the most recent image (or median for cloud resistance)
    # Use median to reduce cloud effects
    image = ndvi_col.median()

    # Reduce region to get mean NDVI over polygon
    stats = image.reduceRegion(
        reducer=ee.Reducer.mean().combine(ee.Reducer.count(), "", False),
        geometry=geom,
        scale=10,  # Sentinel-2 is 10m
        bestEffort=True,
    )

    mean_ndvi = stats.get("NDVI").getInfo()
    pixel_count = stats.get("NDVI_count").getInfo()

    if mean_ndvi is None or pixel_count is None or pixel_count == 0:
        raise RuntimeError("GEE: failed to compute NDVI (no valid pixels)")

    mean_ndvi = round(float(mean_ndvi), 3)

    # Estimate hectares from pixel count (10m resolution = 100 m² per pixel)
    hectares = round(pixel_count * 100 / 10_000, 3)

    # Get approximate cloud cover
    cloud_col = col.select("CLOUDY_PIXEL_PERCENTAGE")
    mean_cloud = cloud_col.mean().getInfo()
    cloud_cover = round(float(mean_cloud or 0) / 100, 3) if mean_cloud else 0.1

    # Generate tile ID
    import hashlib
    seed = int.from_bytes(
        hashlib.sha256(str(polygon.get("coordinates")).encode()).digest()[:4], "big"
    )
    tile_id = f"GEE_S2_{datetime.utcnow():%Y%m%d}_{seed:08x}"

    # Generate preview PNG
    try:
        preview_png = _render_preview_from_ndvi(mean_ndvi, seed)
    except Exception as exc:
        log.warning("GEE: failed to render preview: %s", exc)
        preview_png = None

    return {
        "hectares": hectares,
        "mean_ndvi": mean_ndvi,
        "tile_id": tile_id,
        "cloud_cover": cloud_cover,
        "acquired_at": datetime.now(timezone.utc),
        "preview_png": preview_png,
    }


def is_gee_available() -> bool:
    """Check if GEE is configured and can be initialized."""
    if not settings.gee_enabled:
        return False
    return _init_gee()