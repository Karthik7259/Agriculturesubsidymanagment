from app.security import create_token, hash_password, verify_password
from jose import jwt
from app.config import settings


def test_bcrypt_roundtrip():
    h = hash_password("Sup3rSecret")
    assert verify_password("Sup3rSecret", h)
    assert not verify_password("wrong", h)


def test_jwt_encodes_sub_and_role():
    t = create_token(sub="F-2026-000001", role="farmer")
    payload = jwt.decode(t, settings.jwt_secret, algorithms=[settings.jwt_algo])
    assert payload["sub"] == "F-2026-000001"
    assert payload["role"] == "farmer"
    assert "exp" in payload
