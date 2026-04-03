import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from src.api.deps import CurrentUser, get_current_user
from src.config import settings

router = APIRouter(prefix="/api/v1/users", tags=["users"])

_admin_client: httpx.AsyncClient | None = None
_admin_token_cache: dict | None = None


async def _get_admin_token() -> str:
    """Keycloak Admin REST API용 관리자 토큰을 획득합니다."""
    global _admin_token_cache, _admin_client
    if _admin_client is None:
        _admin_client = httpx.AsyncClient()

    # master realm의 admin 계정으로 Resource Owner Password Grant
    token_url = f"{settings.keycloak_url}/realms/master/protocol/openid-connect/token"
    resp = await _admin_client.post(
        token_url,
        data={
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": settings.keycloak_admin_username,
            "password": settings.keycloak_admin_password,
        },
    )
    if resp.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to obtain Keycloak admin token",
        )
    return resp.json()["access_token"]


def _require_admin(user: CurrentUser) -> None:
    if user.roles is None or "admin" not in user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )


@router.get("")
async def list_users(
    user: CurrentUser = Depends(get_current_user),
) -> list[dict]:
    _require_admin(user)
    token = await _get_admin_token()

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}/users",
            headers={"Authorization": f"Bearer {token}"},
            params={"max": 100},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Keycloak API error")

    users = resp.json()
    return [
        {
            "id": u.get("id"),
            "username": u.get("username"),
            "email": u.get("email"),
            "enabled": u.get("enabled"),
            "firstName": u.get("firstName"),
            "lastName": u.get("lastName"),
            "createdTimestamp": u.get("createdTimestamp"),
        }
        for u in users
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    token = await _get_admin_token()

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}/users",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "username": payload.get("username"),
                "email": payload.get("email"),
                "enabled": True,
                "credentials": [
                    {
                        "type": "password",
                        "value": payload.get("password", "changeme"),
                        "temporary": True,
                    }
                ],
            },
        )

    if resp.status_code == 201:
        location = resp.headers.get("location", "")
        user_id = location.rsplit("/", 1)[-1] if location else ""
        return {"id": user_id, "username": payload.get("username"), "created": True}

    if resp.status_code == 409:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="User already exists"
        )

    raise HTTPException(status_code=resp.status_code, detail="Keycloak API error")


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    token = await _get_admin_token()

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}/users/{user_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

    if resp.status_code == 404:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Keycloak API error")

    return resp.json()


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    payload: dict,
    user: CurrentUser = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    token = await _get_admin_token()

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            f"{settings.keycloak_url}/admin/realms/{settings.keycloak_realm}/users/{user_id}",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if resp.status_code == 204:
        return {"id": user_id, "updated": True}

    raise HTTPException(status_code=resp.status_code, detail="Keycloak API error")
