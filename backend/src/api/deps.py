from dataclasses import dataclass

import httpx
from fastapi import HTTPException, Request, status
from jose import JWTError, jwt

from src.config import settings

_jwks_client: httpx.AsyncClient | None = None
_jwks_cache: dict | None = None


@dataclass
class CurrentUser:
    user_id: str
    username: str
    email: str | None = None
    roles: list[str] | None = None


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_client
    if _jwks_cache is not None:
        return _jwks_cache

    if _jwks_client is None:
        _jwks_client = httpx.AsyncClient()

    well_known_url = (
        f"{settings.keycloak_url}/realms/{settings.keycloak_realm}"
        "/.well-known/openid-configuration"
    )
    resp = await _jwks_client.get(well_known_url)
    oidc_config = resp.json()

    jwks_resp = await _jwks_client.get(oidc_config["jwks_uri"])
    _jwks_cache = jwks_resp.json()
    return _jwks_cache


async def get_current_user(request: Request) -> CurrentUser:
    """Keycloak JWT 또는 Proxy API key를 검증하고 현재 사용자 정보를 반환합니다."""
    if settings.dev_mode:
        return CurrentUser(
            user_id="dev-user",
            username="developer",
            email="dev@localhost",
            roles=["admin"],
        )

    # Proxy API key 인증 (MCP stdio 서버용 — X-API-Key 또는 Bearer token)
    # 개발자는 Keycloak 계정 없이 IP 기반으로 식별
    client_ip = (request.client.host if request.client else "unknown")
    api_key = request.headers.get("x-api-key", "")
    if api_key and settings.proxy_api_key and api_key == settings.proxy_api_key:
        return CurrentUser(
            user_id=f"ip:{client_ip}",
            username=client_ip,
            email=None,
            roles=["viewer"],
        )

    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer ") and settings.proxy_api_key:
        bearer_value = auth_header[7:]
        if bearer_value == settings.proxy_api_key:
            return CurrentUser(
                user_id=f"ip:{client_ip}",
                username=client_ip,
                email=None,
                roles=["viewer"],
            )

    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )

    token = auth_header[7:]

    try:
        jwks = await _get_jwks()
        unverified_header = jwt.get_unverified_header(token)

        # JWKS에서 매칭되는 키 찾기
        rsa_key = None
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header.get("kid"):
                rsa_key = key
                break

        if rsa_key is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token signing key not found",
            )

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.keycloak_client_id,
            issuer=f"{settings.keycloak_url}/realms/{settings.keycloak_realm}",
        )

        return CurrentUser(
            user_id=payload.get("sub", ""),
            username=payload.get("preferred_username", ""),
            email=payload.get("email"),
            roles=payload.get("realm_access", {}).get("roles", []),
        )

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token validation failed: {e}",
        )
