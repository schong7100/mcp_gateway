import json
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.config import settings
from src.db.models import AuditTrail, SearchLog
from src.db.session import get_db
from src.gateway.filter import content_filter
from src.gateway.proxy import forward_request

router = APIRouter(prefix="/proxy", tags=["proxy"])


def _parse_request_body(body: bytes, query_string: str | None) -> dict | None:
    """요청 본문과 query string을 로그용 JSON으로 변환합니다."""
    result: dict = {}

    if query_string:
        params = parse_qs(query_string)
        result["query_params"] = {k: v[0] if len(v) == 1 else v for k, v in params.items()}

    if body:
        try:
            result["body"] = json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            result["body_length"] = len(body)

    return result if result else None


async def _handle_proxy(
    service: str,
    path: str,
    request: Request,
    user: CurrentUser,
    db: AsyncSession,
) -> Response:
    body = await request.body()
    headers = dict(request.headers)

    # 요청 필터 — 민감 정보 포함 시 403 차단 (최후 방어선)
    request_text_parts = []
    if body:
        request_text_parts.append(body.decode("utf-8", errors="ignore"))
    if request.url.query:
        request_text_parts.append(request.url.query)
    request_text = "\n".join(request_text_parts)

    if settings.filter_enabled and request_text:
        request_rules = await content_filter.load_rules(db, service, direction="request")
        if request_rules:
            input_result = content_filter.apply(request_rules, request_text)
            if not input_result.passed:
                filter_details = {
                    "direction": "request",
                    "matches": [
                        {
                            "rule_id": m.rule_id,
                            "rule_name": m.rule_name,
                            "rule_type": m.rule_type,
                            "matched_text": m.matched_text,
                        }
                        for m in input_result.matches
                    ],
                }
                request_body_json = _parse_request_body(body, request.url.query)
                log = SearchLog(
                    user_id=user.user_id,
                    user_name=user.username,
                    service=service,
                    method=request.method,
                    path=path,
                    request_body=request_body_json,
                    response_status=403,
                    response_body={"error": "Blocked by content filter"},
                    filtered=True,
                    filter_details=filter_details,
                )
                db.add(log)
                audit = AuditTrail(
                    user_id=user.user_id,
                    user_name=user.username,
                    action="search_blocked",
                    resource_type="proxy",
                    resource_id=f"{service}/{path}",
                    details={
                        "method": request.method,
                        "blocked_rules": [m["rule_name"] for m in filter_details["matches"]],
                        "blocked_texts": [
                            {"rule": m["rule_name"], "text": m["matched_text"]}
                            for m in filter_details["matches"]
                        ],
                        "match_count": len(filter_details["matches"]),
                    },
                )
                db.add(audit)
                await db.commit()
                return Response(
                    content=json.dumps({
                        "error": "Request blocked by content filter",
                        "matches": [m["rule_name"] for m in filter_details["matches"]],
                    }),
                    status_code=403,
                    media_type="application/json",
                )

    # 업스트림으로 요청 전달
    upstream_resp = await forward_request(
        service=service,
        path=path,
        method=request.method,
        headers=headers,
        body=body if body else None,
        query_string=request.url.query or "",
    )

    response_body = upstream_resp.content
    response_text = upstream_resp.text

    # 검색 로그 저장
    request_body_json = _parse_request_body(body, request.url.query)

    response_body_json = None
    try:
        response_body_json = json.loads(response_text)
    except (json.JSONDecodeError, UnicodeDecodeError):
        response_body_json = {"raw_length": len(response_body)}

    log = SearchLog(
        user_id=user.user_id,
        user_name=user.username,
        service=service,
        method=request.method,
        path=path,
        request_body=request_body_json,
        response_status=upstream_resp.status_code,
        response_body=response_body_json,
        filtered=False,
        filter_details=None,
    )
    db.add(log)

    audit = AuditTrail(
        user_id=user.user_id,
        user_name=user.username,
        action="search",
        resource_type="proxy",
        resource_id=f"{service}/{path}",
        details={"method": request.method},
    )
    db.add(audit)
    await db.commit()

    # 업스트림 응답 헤더 전달 (hop-by-hop 제외)
    excluded_headers = (
        "transfer-encoding", "connection", "content-encoding", "content-length",
    )
    response_headers = {
        k: v
        for k, v in upstream_resp.headers.items()
        if k.lower() not in excluded_headers
    }

    return Response(
        content=response_body,
        status_code=upstream_resp.status_code,
        headers=response_headers,
        media_type=upstream_resp.headers.get("content-type", "application/json"),
    )


@router.api_route("/c7/{path:path}", methods=["GET", "POST"])
async def proxy_context7(
    path: str,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await _handle_proxy("c7", path, request, user, db)


@router.api_route("/exa/{path:path}", methods=["GET", "POST"])
async def proxy_exa(
    path: str,
    request: Request,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    return await _handle_proxy("exa", path, request, user, db)
