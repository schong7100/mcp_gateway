import httpx

from src.config import settings

_proxy_mounts = {}
if settings.https_proxy:
    _proxy_mounts["https://"] = httpx.AsyncHTTPTransport(proxy=settings.https_proxy)
if settings.http_proxy:
    _proxy_mounts["http://"] = httpx.AsyncHTTPTransport(proxy=settings.http_proxy)

http_client = httpx.AsyncClient(
    mounts=_proxy_mounts if _proxy_mounts else None,
    timeout=httpx.Timeout(30.0, connect=10.0),
    follow_redirects=True,
)

UPSTREAM_MAP: dict[str, str] = {
    "c7": settings.context7_base_url,
    "exa": settings.exa_base_url,
}


async def forward_request(
    service: str,
    path: str,
    method: str,
    headers: dict[str, str],
    body: bytes | None = None,
    query_string: str = "",
) -> httpx.Response:
    """요청을 업스트림 서비스로 전달합니다."""
    base_url = UPSTREAM_MAP[service]
    target_url = f"{base_url}/{path.lstrip('/')}"
    if query_string:
        target_url = f"{target_url}?{query_string}"

    # 프록시가 전달하면 안 되는 hop-by-hop 헤더 제거
    forward_headers = {
        k: v
        for k, v in headers.items()
        if k.lower() not in ("host", "authorization", "content-length", "transfer-encoding")
    }

    # Exa에는 API 키 추가
    if service == "exa" and settings.exa_api_key:
        forward_headers["x-api-key"] = settings.exa_api_key

    response = await http_client.request(
        method=method,
        url=target_url,
        headers=forward_headers,
        content=body,
    )
    return response
