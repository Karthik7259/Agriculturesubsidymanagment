"""Eligibility model + SHAP explainer.

Loaded lazily so the API can start even before the model file exists; calling
`predict_and_explain` triggers load. `scripts/train_model.py` produces the pkl.
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Optional

import joblib
import numpy as np

from ..config import settings


log = logging.getLogger(__name__)


FEATURE_NAMES = [
    "declared_land_ha",
    "verified_land_ha",
    "cadastral_land_ha",
    "mean_ndvi",
    "annual_income",
    "crop_is_high_vigor",
    "overclaim_ratio",
]

HIGH_VIGOR = {"wheat", "rice", "sugarcane", "maize", "cotton"}


_model = None
_explainer = None
_lock = threading.Lock()


def _load() -> None:
    global _model, _explainer
    with _lock:
        if _model is not None:
            return
        if not os.path.exists(settings.model_path):
            raise RuntimeError(
                f"Model file not found at {settings.model_path}. "
                "Run scripts/train_model.py to create it."
            )
        _model = joblib.load(settings.model_path)
        try:
            import shap  # heavy import, lazy
            _explainer = shap.TreeExplainer(_model)
        except Exception as exc:
            log.warning("SHAP explainer unavailable: %s", exc)
            _explainer = None


def is_loaded() -> bool:
    return _model is not None


def to_row(features: dict) -> list[float]:
    declared = float(features.get("declared_land_ha", 0) or 0)
    verified = float(features.get("verified_land_ha", 0) or 0)
    cadastral = float(features.get("cadastral_land_ha", 0) or declared)
    ndvi = float(features.get("mean_ndvi", 0) or 0)
    income = float(features.get("annual_income", 0) or 0)
    crop = str(features.get("crop_type", "")).lower()
    crop_hi = 1.0 if crop in HIGH_VIGOR else 0.0
    overclaim = declared / verified if verified > 0 else 5.0
    return [declared, verified, cadastral, ndvi, income, crop_hi, overclaim]


def _explain_from_shap(shap_vals: np.ndarray) -> str:
    pairs = sorted(
        zip(FEATURE_NAMES, shap_vals.tolist()),
        key=lambda kv: abs(kv[1]),
        reverse=True,
    )[:3]
    total = sum(abs(v) for _, v in pairs) or 1e-6
    parts = [
        f"{name} {round(100 * abs(v) / total)}% {'for' if v > 0 else 'against'} eligibility"
        for name, v in pairs
    ]
    return " | ".join(parts)


def _heuristic_explain(row: list[float], prob: float) -> str:
    """Fallback when SHAP is unavailable — still top-3 directional contributions."""
    declared, verified, cadastral, ndvi, income, crop_hi, overclaim = row
    pseudo = [
        ("mean_ndvi", (ndvi - 0.3) * 2),
        ("overclaim_ratio", -(overclaim - 1) * 1.5),
        ("declared_land_ha", declared * 0.2),
        ("verified_land_ha", verified * 0.2),
        ("annual_income", -(income / 500_000) if income > 300_000 else 0.05),
        ("crop_is_high_vigor", crop_hi * 0.3),
        ("cadastral_land_ha", 0.1 if cadastral > 0 else -0.4),
    ]
    pseudo.sort(key=lambda kv: abs(kv[1]), reverse=True)
    top = pseudo[:3]
    total = sum(abs(v) for _, v in top) or 1e-6
    return " | ".join(
        f"{n} {round(100 * abs(v) / total)}% {'for' if v > 0 else 'against'} eligibility"
        for n, v in top
    )


def predict_and_explain(row: list[float]) -> tuple[float, str]:
    _load()
    assert _model is not None
    x = np.array([row], dtype="float32")
    prob = float(_model.predict_proba(x)[0, 1])

    if _explainer is not None:
        try:
            vals = _explainer.shap_values(x)
            arr = vals[0] if isinstance(vals, list) else vals[0]
            arr = np.asarray(arr).ravel()
            if arr.shape[0] == len(FEATURE_NAMES):
                return prob, _explain_from_shap(arr)
        except Exception as exc:
            log.warning("SHAP values failed, using heuristic explanation: %s", exc)

    return prob, _heuristic_explain(row, prob)
