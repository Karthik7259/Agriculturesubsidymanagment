"""Fetch and upsert all government schemes (hardcoded + live-scraped).

Usage:
    python scripts/scrape_schemes.py
    python scripts/scrape_schemes.py --no-scrape   # skip live scraping, hardcoded only
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

from app.db import ensure_indexes
from app.services.scheme_scraper import ALL_SCHEMES, fetch_all_schemes, upsert_schemes


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape and seed government schemes")
    parser.add_argument("--no-scrape", action="store_true", help="Skip live scraping, use hardcoded data only")
    args = parser.parse_args()

    ensure_indexes()

    if args.no_scrape:
        log.info("Skipping live scrape — using %d hardcoded schemes only", len(ALL_SCHEMES))
        scheme_list = ALL_SCHEMES
    else:
        log.info("Fetching schemes (hardcoded + live scrape)…")
        scheme_list = fetch_all_schemes()

    count = upsert_schemes(scheme_list)
    log.info("Done — upserted %d schemes into MongoDB.", count)

    # Print summary table
    central = sum(1 for s in scheme_list if s.get("scheme_type") == "central")
    state = sum(1 for s in scheme_list if s.get("scheme_type") == "state")
    other = count - central - state
    print(f"\nSummary: {count} total  |  {central} central  |  {state} state  |  {other} other")

    categories: dict[str, int] = {}
    for s in scheme_list:
        cat = s.get("category", "other")
        categories[cat] = categories.get(cat, 0) + 1
    print("\nBy category:")
    for cat, n in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"  {cat:<25} {n}")


if __name__ == "__main__":
    main()
