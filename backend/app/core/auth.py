"""Validate Microsoft Entra access tokens for the selected Container App API."""

from typing import Any

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from app.core.config import Settings


class EntraTokenVerifier:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.issuer = f"https://login.microsoftonline.com/{settings.entra_tenant_id}/v2.0"
        self.keys = PyJWKClient(
            f"https://login.microsoftonline.com/{settings.entra_tenant_id}/discovery/v2.0/keys",
            cache_jwk_set=True,
            lifespan=300,
        )

    def verify(self, token: str) -> dict[str, Any]:
        try:
            key = self.keys.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key.key,
                algorithms=["RS256"],
                audience=self.settings.entra_client_id,
                issuer=self.issuer,
                options={"require": ["exp", "iat", "iss", "aud", "tid", "oid", "scp"]},
            )
        except jwt.PyJWTError as exc:
            raise HTTPException(status_code=401, detail="Sign in again to continue.") from exc
        scopes = claims.get("scp")
        if (
            claims.get("ver") != "2.0"
            or claims.get("tid") != self.settings.entra_tenant_id
            or claims.get("azp") != self.settings.entra_client_id
            or claims.get("acct") not in (0, "0")
            or not isinstance(scopes, str)
            or "access_as_user" not in scopes.split()
        ):
            raise HTTPException(status_code=403, detail="This account cannot access EcoCompute.")
        groups = claims.get("groups", [])
        if self.settings.entra_allowed_group_id and (
            not isinstance(groups, list)
            or self.settings.entra_allowed_group_id
            not in [group.lower() for group in groups if isinstance(group, str)]
        ):
            raise HTTPException(status_code=403, detail="This account cannot access EcoCompute.")
        return claims


def require_user(request: Request) -> None:
    verifier: EntraTokenVerifier | None = request.app.state.token_verifier
    if verifier is None:
        return
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Sign in to use EcoCompute.")
    verifier.verify(token)
