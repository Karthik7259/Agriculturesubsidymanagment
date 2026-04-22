import math


def polygon_area_hectares(coordinates: list[list[list[float]]]) -> float:
    """Spherical polygon area via shoelace on lon/lat (degrees), returning hectares.

    Accurate enough for parcel-scale polygons (< few km across). For larger or
    pole-adjacent polygons, swap in a proper geodesic library.
    """
    if not coordinates or not coordinates[0]:
        return 0.0
    ring = coordinates[0]
    if len(ring) < 4:
        return 0.0

    R = 6_371_000.0
    total = 0.0
    n = len(ring) - 1
    for i in range(n):
        lon1, lat1 = ring[i]
        lon2, lat2 = ring[i + 1]
        total += math.radians(lon2 - lon1) * (2 + math.sin(math.radians(lat1)) + math.sin(math.radians(lat2)))
    area_m2 = abs(total * R * R / 2.0)
    return area_m2 / 10_000.0


def polygon_bbox(coordinates: list[list[list[float]]]) -> tuple[float, float, float, float]:
    ring = coordinates[0]
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return min(lons), min(lats), max(lons), max(lats)
