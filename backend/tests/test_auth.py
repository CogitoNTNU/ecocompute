from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from app.main import create_app

TENANT = "00000000-0000-0000-0000-000000000010"
CLIENT = "00000000-0000-0000-0000-000000000011"
GROUP = "00000000-0000-0000-0000-000000000012"


def test_protected_apis_require_valid_tenant_member_and_optional_group(settings):
    private = replace(
        settings,
        entra_tenant_id=TENANT,
        entra_client_id=CLIENT,
        entra_allowed_group_id=GROUP,
    )
    app = create_app(private)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    app.state.token_verifier.keys.get_signing_key_from_jwt = lambda _token: SimpleNamespace(
        key=key.public_key()
    )
    now = datetime.now(UTC)
    claims = {
        "iss": f"https://login.microsoftonline.com/{TENANT}/v2.0",
        "aud": CLIENT,
        "tid": TENANT,
        "azp": CLIENT,
        "ver": "2.0",
        "scp": "access_as_user",
        "oid": "00000000-0000-0000-0000-000000000013",
        "acct": 0,
        "groups": [GROUP],
        "iat": now,
        "nbf": now,
        "exp": now + timedelta(minutes=5),
    }

    def token(**changes):
        return jwt.encode({**claims, **changes}, key, algorithm="RS256")

    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/api/config").json()["auth"]["tenant_id"] == TENANT
        assert client.get("/api/costs").status_code == 401
        assert client.get("/api/me").status_code == 401
        assert client.post("/api/chat", json={}).status_code == 401
        assert client.get("/api/costs", headers={"Authorization": "Bearer bad"}).status_code == 401
        for changed in (
            {"groups": []},
            {"acct": 1},
            {"acct": None},
            {"azp": "00000000-0000-0000-0000-000000000099"},
            {"scp": "other_scope"},
            {"tid": "00000000-0000-0000-0000-000000000099"},
        ):
            assert (
                client.get("/api/costs", headers={"Authorization": f"Bearer {token(**changed)}"}).status_code
                == 403
            )
        for changed in (
            {"aud": "00000000-0000-0000-0000-000000000099"},
            {"iss": "https://malicious.example.test"},
            {"exp": now - timedelta(minutes=5)},
        ):
            assert (
                client.get("/api/costs", headers={"Authorization": f"Bearer {token(**changed)}"}).status_code
                == 401
            )
        assert client.get("/api/costs", headers={"Authorization": f"Bearer {token()}"}).status_code == 200
        assert client.get("/api/me", headers={"Authorization": f"Bearer {token()}"}).json() == {
            "authorized": True
        }

    app_without_group = create_app(replace(private, entra_allowed_group_id=""))
    app_without_group.state.token_verifier.keys.get_signing_key_from_jwt = lambda _token: SimpleNamespace(
        key=key.public_key()
    )
    with TestClient(app_without_group) as client:
        assert (
            client.get("/api/me", headers={"Authorization": f"Bearer {token(groups=[])}"}).status_code == 200
        )
        assert (
            client.get("/api/me", headers={"Authorization": f"Bearer {token(groups=[], acct=1)}"}).status_code
            == 403
        )
