from app.utils.hashing import canonical_json, hash_payload, sha256_hex


def test_canonical_json_is_stable():
    a = canonical_json({"b": 2, "a": 1})
    b = canonical_json({"a": 1, "b": 2})
    assert a == b


def test_hash_payload_deterministic():
    p = {"x": 1, "y": "z"}
    assert hash_payload(p) == hash_payload({"y": "z", "x": 1})


def test_sha256_hex_known():
    assert sha256_hex("hello") == "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
