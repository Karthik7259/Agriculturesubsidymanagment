from app.services import fraud


def test_high_overclaim():
    f = {
        "declared_land_ha": 3.0,
        "verified_land_ha": 1.0,
        "cadastral_land_ha": 2.8,
        "mean_ndvi": 0.5,
        "crop_type": "wheat",
    }
    flags = fraud.rule_flags(f)
    assert "HIGH_OVERCLAIM" in flags


def test_cadastral_mismatch():
    f = {
        "declared_land_ha": 3.5,
        "verified_land_ha": 3.2,
        "cadastral_land_ha": 2.0,
        "mean_ndvi": 0.6,
        "crop_type": "rice",
    }
    assert "CADASTRAL_MISMATCH" in fraud.rule_flags(f)


def test_non_cropped_land():
    f = {
        "declared_land_ha": 2.0,
        "verified_land_ha": 1.9,
        "cadastral_land_ha": 2.0,
        "mean_ndvi": 0.08,
        "crop_type": "wheat",
    }
    assert "NON_CROPPED_LAND" in fraud.rule_flags(f)


def test_clean_application_only_unverified_possible():
    f = {
        "declared_land_ha": 2.0,
        "verified_land_ha": 1.9,
        "cadastral_land_ha": 2.0,
        "mean_ndvi": 0.55,
        "crop_type": "wheat",
    }
    flags = fraud.rule_flags(f)
    assert "HIGH_OVERCLAIM" not in flags
    assert "CADASTRAL_MISMATCH" not in flags
    assert "NON_CROPPED_LAND" not in flags


def test_cadastral_unverified_when_zero():
    f = {
        "declared_land_ha": 2.0,
        "verified_land_ha": 1.9,
        "cadastral_land_ha": 0.0,
        "mean_ndvi": 0.55,
        "crop_type": "wheat",
    }
    assert "CADASTRAL_UNVERIFIED" in fraud.rule_flags(f)
