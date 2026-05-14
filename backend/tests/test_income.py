from app.services.income import estimate_income_from_hectares, normalize_aadhaar


def test_normalize_aadhaar_strips_separators():
    assert normalize_aadhaar("1234 5678 9012") == "123456789012"


def test_income_scales_with_hectares():
    assert estimate_income_from_hectares(2.5) == 375000.0