import json
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.db.models import AuditTrail
from src.db.session import get_db
from src.schemas.audit import AuditTrailListResponse, AuditTrailResponse

router = APIRouter(prefix="/api/v1/audit", tags=["audit"])


@router.get("", response_model=AuditTrailListResponse)
async def list_audit_trail(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    user_id: str | None = None,
    action: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AuditTrailListResponse:
    stmt = select(AuditTrail).order_by(AuditTrail.created_at.desc())
    count_stmt = select(func.count(AuditTrail.id))

    if user_id:
        stmt = stmt.where(AuditTrail.user_id == user_id)
        count_stmt = count_stmt.where(AuditTrail.user_id == user_id)
    if action:
        stmt = stmt.where(AuditTrail.action == action)
        count_stmt = count_stmt.where(AuditTrail.action == action)

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()

    return AuditTrailListResponse(
        items=[AuditTrailResponse.model_validate(item) for item in items],
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
async def export_audit_trail(
    format: str = Query(default="jsonl", pattern=r"^(jsonl|csv)$"),
    period: str = Query(default="7d", pattern=r"^\d+[dh]$"),
    user_id: str | None = None,
    action: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """감사 로그를 JSONL 또는 CSV 형식으로 내보냅니다."""
    since = _parse_period(period)
    stmt = select(AuditTrail).where(
        AuditTrail.created_at >= since,
    ).order_by(AuditTrail.created_at.desc())

    if user_id:
        stmt = stmt.where(AuditTrail.user_id == user_id)
    if action:
        stmt = stmt.where(AuditTrail.action == action)

    result = await db.execute(stmt)
    items = result.scalars().all()

    if format == "csv":
        return _stream_audit_csv(items)
    return _stream_audit_jsonl(items)


def _stream_audit_jsonl(items: list[AuditTrail]) -> StreamingResponse:
    def generate():
        for item in items:
            row = {
                "time": item.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                "user_id": item.user_id,
                "user_name": item.user_name,
                "action": item.action,
                "resource_type": item.resource_type,
                "resource_id": item.resource_id,
                "details": item.details,
            }
            yield json.dumps(row, ensure_ascii=False) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": "attachment; filename=audit_trail.jsonl"},
    )


def _stream_audit_csv(items: list[AuditTrail]) -> StreamingResponse:
    def generate():
        yield "time,user_id,user_name,action,resource_type,resource_id,details\n"
        for item in items:
            details_str = json.dumps(item.details, ensure_ascii=False) if item.details else ""
            yield (
                f"{item.created_at.strftime('%Y-%m-%d %H:%M:%S')},"
                f"{item.user_id},{item.user_name},{item.action},"
                f"{item.resource_type},{item.resource_id or ''},\"{details_str}\"\n"
            )

    return StreamingResponse(
        generate(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_trail.csv"},
    )
