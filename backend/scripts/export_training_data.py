"""Export the synthetic training dataset to CSV for inspection."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import csv
import numpy as np

from app.services.ml import FEATURE_NAMES


def _synthetic_dataset(n: int = 6000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    """Generate synthetic training dataset."""
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


def export_to_csv(output_path: str = "backend/data/training_dataset.csv") -> None:
    """Generate synthetic dataset and export to CSV."""
    print(f"Generating synthetic dataset (6000 samples, seed=42)...")
    X, y = _synthetic_dataset(n=6000, seed=42)
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    print(f"Writing to {output_path}...")
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        # Header row
        writer.writerow(FEATURE_NAMES + ["eligible"])
        # Data rows
        for features, label in zip(X, y):
            writer.writerow(list(features) + [int(label)])
    
    print(f"✓ Dataset exported: {output_path}")
    print(f"  Rows: {len(X)}")
    print(f"  Columns: {len(FEATURE_NAMES) + 1}")
    print(f"  Eligible (class=1): {np.sum(y)}")
    print(f"  Ineligible (class=0): {len(y) - np.sum(y)}")


if __name__ == "__main__":
    export_to_csv("backend/data/training_dataset.csv")
