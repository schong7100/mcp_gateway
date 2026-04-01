import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.db.models import SearchLog
from src.db.session import get_db
from src.schemas.logs import SearchLogListResponse, SearchLogResponse

router = APIRouter(prefix="/api/v1/logs", tags=["logs"])


@router.get("", response_model=SearchLogListResponse)
async def list_search_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    service: str | None = Query(default=None, pattern=r"^(context7|exa)$"),
    user_id: str | None = None,
    filtered_only: bool = False,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SearchLogListResponse:
    stmt = select(SearchLog).order_by(SearchLog.created_at.desc())
    count_stmt = select(func.count(SearchLog.id))

    if service:
        service_key = "c7" if service == "context7" else service
        stmt = stmt.where(SearchLog.service == service_key)
        count_stmt = count_stmt.where(SearchLog.service == service_key)
    if user_id:
        stmt = stmt.where(SearchLog.user_id == user_id)
        count_stmt = count_stmt.where(SearchLog.user_id == user_id)
    if filtered_only:
        stmt = stmt.where(SearchLog.filtered.is_(True))
        count_stmt = count_stmt.where(SearchLog.filtered.is_(True))

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    return SearchLogListResponse(
        items=[SearchLogResponse.model_validate(log) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
    )


def _parse_period(period: str) -> datetime:
    """기간 문자열(예: '7d', '30d', '24h')을 시작 시각으로 변환합니다."""
    unit = period[-1]
    value = int(period[:-1])
    if unit == "d":
        return datetime.now(tz=UTC) - timedelta(days=value)
    if unit == "h":
        return datetime.now(tz=UTC) - timedelta(hours=value)
    raise ValueError(f"Unsupported period format: {period}")


@router.get("/export")
async def export_search_logs(
    format: str = Query(default="jsonl", pattern=r"^(jsonl|csv)$"),
    period: str = Query(default="7d", pattern=r"^\d+[dh]$"),
    service: str | None = Query(default=None, pattern=r"^(context7|exa)$"),
    user_id: str | None = None,
    filtered_only: bool = False,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """검색 로그를 JSONL 또는 CSV 형식으로 내보냅니다."""
    since = _parse_period(period)
    stmt = select(SearchLog).where(
        SearchLog.created_at >= since,
    ).order_by(SearchLog.created_at.desc())

    if service:
        service_key = "c7" if service == "context7" else service
        stmt = stmt.where(SearchLog.service == service_key)
    if user_id:
        stmt = stmt.where(SearchLog.user_id == user_id)
    if filtered_only:
        stmt = stmt.where(SearchLog.filtered.is_(True))

    result = await db.execute(stmt)
    logs = result.scalars().all()

    if format == "csv":
        return _stream_logs_csv(logs)
    return _stream_logs_jsonl(logs)


def _stream_logs_jsonl(logs: list[SearchLog]) -> StreamingResponse:
    def generate():
        for log in logs:
            row = {
                "time": log.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "user_id": log.user_id,
                "user_name": log.user_name,
                "service": log.service,
                "method": log.method,
                "path": log.path,
                "request_body": log.request_body,
                "response_status": log.response_status,
                "filtered": log.filtered,
                "filter_details": log.filter_details,
            }
            yield json.dumps(row, ensure_ascii=False) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=search_logs.jsonl"},
    )


def _stream_logs_csv(logs: list[SearchLog]) -> StreamingResponse:
    def generate():
        yield "time,user_id,user_name,service,method,path,response_status,filtered,filter_details\n"
        for log in logs:
            filter_info = (
                json.dumps(log.filter_details, ensure_ascii=False)
                if log.filter_details else ""
            )
            yield (
                f"{log.created_at.strftime('%Y-%m-%d %H:%M:%S')},"
                f"{log.user_id},{log.user_name},{log.service},"
                f"{log.method},{log.path},{log.response_status},"
                f"{log.filtered},\"{filter_info}\"\n"
            )

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=search_logs.csv"},
    )
