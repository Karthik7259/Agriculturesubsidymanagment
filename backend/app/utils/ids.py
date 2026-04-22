import secrets
from datetime import datetime


def gen_farmer_id() -> str:
    year = datetime.utcnow().year
    return f"F-{year}-{secrets.randbelow(1_000_000):06d}"


def gen_application_id() -> str:
    year = datetime.utcnow().year
    return f"A-{year}-{secrets.randbelow(10_000_000):07d}"


def gen_scheme_id(name: str) -> str:
    slug = "".join(c.upper() if c.isalnum() else "-" for c in name).strip("-")
    return f"S-{slug}"[:40]
