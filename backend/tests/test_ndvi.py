from app.services import satellite
from app.utils.geo import polygon_area_hectares


SQUARE_100M = {
    "type": "Polygon",
    "coordinates": [[
        [73.8567, 18.5204],
        [73.8577, 18.5204],
        [73.8577, 18.5214],
        [73.8567, 18.5214],
        [73.8567, 18.5204],
    ]],
}


def test_polygon_area_hectares_sanity():
    ha = polygon_area_hectares(SQUARE_100M["coordinates"])
    assert 0.5 < ha < 20.0


def test_mock_ndvi_is_deterministic():
    a = satellite.compute_ndvi(SQUARE_100M, declared_ha=1.0)
    b = satellite.compute_ndvi(SQUARE_100M, declared_ha=1.0)
    assert a["hectares"] == b["hectares"]
    assert a["mean_ndvi"] == b["mean_ndvi"]
    assert a["tile_id"] == b["tile_id"]


def test_mock_ndvi_returns_expected_keys():
    r = satellite.compute_ndvi(SQUARE_100M, declared_ha=1.0)
    for key in ("hectares", "mean_ndvi", "tile_id", "cloud_cover", "acquired_at"):
        assert key in r
    assert 0.0 <= r["mean_ndvi"] <= 1.0
    assert 0.0 <= r["cloud_cover"] <= 1.0
