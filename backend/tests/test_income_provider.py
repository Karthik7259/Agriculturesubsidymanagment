from app.services import income


class _Resp:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise Exception("http error")

    def json(self):
        return self._payload


def test_tax_provider_wins_with_consent(monkeypatch):
    def fake_get(url, headers=None, timeout=0):
        return _Resp({"annual_income": 512000, "record_id": "TAX-123", "assessment_year": "2025-26"})

    monkeypatch.setattr(income.httpx, "get", fake_get)

    out = income.derive_annual_income(
        aadhaar_number="123456789012",
        consent_to_tax_fetch=True,
    )

    assert out["annual_income"] == 512000
    assert out["income_source"] == "tax_api"


def test_fallback_to_land_when_tax_unavailable(monkeypatch):
    def fake_get(url, headers=None, timeout=0):
        raise income.httpx.ConnectError("down")

    class _Land:
        @staticmethod
        def find_one(query):
            if query.get("land_id") == "LND-XYZ":
                return {"cadastral_land_ha": 2.0}
            return None

    monkeypatch.setattr(income.httpx, "get", fake_get)
    monkeypatch.setattr(income, "land_records", _Land())

    out = income.derive_annual_income(
        aadhaar_number="123456789012",
        land_id="LND-XYZ",
        consent_to_tax_fetch=True,
    )

    assert out["income_source"] == "land_record"
    assert out["annual_income"] == 300000.0
    assert out["income_derivation_attempts"][0]["source"] == "tax_api"
