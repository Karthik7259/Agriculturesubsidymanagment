import os
import pytest

from app.config import settings
from app.services import ml


pytestmark = pytest.mark.skipif(
    not os.path.exists(settings.model_path),
    reason="Model not trained yet — run scripts/train_model.py",
)


def test_predict_and_explain_format():
    row = ml.to_row({
        "declared_land_ha": 2.0,
        "verified_land_ha": 1.9,
        "cadastral_land_ha": 2.0,
        "mean_ndvi": 0.55,
        "annual_income": 180_000,
        "crop_type": "wheat",
    })
    prob, expl = ml.predict_and_explain(row)
    assert 0.0 <= prob <= 1.0
    assert expl.count("|") == 2
    for part in expl.split("|"):
        assert ("for" in part) or ("against" in part)


def test_to_row_shape():
    row = ml.to_row({"declared_land_ha": 1.0, "verified_land_ha": 1.0,
                     "cadastral_land_ha": 1.0, "mean_ndvi": 0.5,
                     "annual_income": 100_000, "crop_type": "rice"})
    assert len(row) == len(ml.FEATURE_NAMES)
