"""Train the eligibility XGBoost model + an Isolation Forest anomaly detector.

Uses a synthetic dataset for the v1 bootstrap. In production this should pull
historical labelled applications from MongoDB instead — the structure is the
same, just swap `_synthetic_dataset()` for a Mongo query.
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split

from app.config import settings
from app.services.ml import FEATURE_NAMES


def _synthetic_dataset(n: int = 6000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    declared = rng.uniform(0.2, 8.0, n)
    truthful = rng.uniform(0.7, 1.0, n)
    verified = declared * truthful * rng.uniform(0.9, 1.05, n)
    cadastral = declared * rng.uniform(0.9, 1.1, n)
    ndvi = np.clip(rng.normal(0.5, 0.15, n), 0.0, 0.95)
    income = rng.uniform(50_000, 1_200_000, n)
    crop_hi = (rng.random(n) > 0.4).astype(float)
    overclaim = declared / np.maximum(verified, 0.05)

    noise = rng.normal(0, 0.05, n)
    score = (
        0.35 * (ndvi - 0.3) * 4
        + 0.25 * (truthful - 0.85) * 6
        - 0.20 * (overclaim - 1.0) * 2
        + 0.10 * (1 - income / 1_200_000)
        + 0.05 * crop_hi
        + 0.05 * np.log1p(verified)
        + noise
    )
    eligible = (score > 0.35).astype(int)

    X = np.column_stack([declared, verified, cadastral, ndvi, income, crop_hi, overclaim]).astype("float32")
    y = eligible.astype("int64")
    return X, y


def train() -> None:
    print("Generating synthetic dataset...")
    X, y = _synthetic_dataset()
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    try:
        from xgboost import XGBClassifier
        model = XGBClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            subsample=0.9,
            colsample_bytree=0.9,
            eval_metric="logloss",
            tree_method="hist",
            n_jobs=4,
        )
        model_name = "XGBClassifier"
    except Exception as exc:
        print(f"XGBoost unavailable ({exc}), falling back to GradientBoosting")
        from sklearn.ensemble import GradientBoostingClassifier
        model = GradientBoostingClassifier(n_estimators=200, max_depth=5, learning_rate=0.1)
        model_name = "GradientBoostingClassifier"

    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    f1 = f1_score(y_test, y_pred)
    print(f"\n{model_name} trained:")
    print(f"  F1 (holdout): {f1:.3f}")
    print(classification_report(y_test, y_pred, digits=3))

    os.makedirs(os.path.dirname(settings.model_path), exist_ok=True)
    joblib.dump(model, settings.model_path)
    print(f"Saved eligibility model → {settings.model_path}")

    print("\nTraining Isolation Forest...")
    iso = IsolationForest(
        n_estimators=150,
        contamination=0.08,
        random_state=42,
        n_jobs=4,
    )
    iso.fit(X_train)
    joblib.dump(iso, settings.isoforest_path)
    print(f"Saved anomaly model → {settings.isoforest_path}")

    print("\nFeature schema:", FEATURE_NAMES)


if __name__ == "__main__":
    train()
