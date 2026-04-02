from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.db.models import FilterRule, SearchLog
from src.db.session import get_db

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


def _period_start(period: str) -> datetime:
    """period 파라미터를 시작 시각으로 변환합니다."""
    now = datetime.now(tz=UTC)
    if period == "today":
        return datetime.combine(date.today(), datetime.min.time(), tzinfo=UTC)
    if period == "week":
        return now - timedelta(days=7)
    if period == "month":
        return now - timedelta(days=30)
    return datetime.combine(date.today(), datetime.min.time(), tzinfo=UTC)


@router.get("/stats")
async def dashboard_stats(
    period: str = Query(default="today", pattern=r"^(today|week|month)$"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    since = _period_start(period)

    # 검색 요청 수
    total_result = await db.execute(
        select(func.count(SearchLog.id)).where(SearchLog.created_at >= since)
    )
    total = total_result.scalar_one()

    # 차단 건수 (response_status=403)
    blocked_result = await db.execute(
        select(func.count(SearchLog.id)).where(
            SearchLog.created_at >= since,
            SearchLog.response_status == 403,
        )
    )
    blocked = blocked_result.scalar_one()

    # 차단률 (%)
    block_rate = round((blocked / total * 100), 1) if total > 0 else 0.0

    # 활성 필터 규칙 수
    active_rules_result = await db.execute(
        select(func.count(FilterRule.id)).where(FilterRule.enabled.is_(True))
    )
    active_rules = active_rules_result.scalar_one()

    # 서비스별 분포
    service_result = await db.execute(
        select(SearchLog.service, func.count(SearchLog.id))
        .where(SearchLog.created_at >= since)
        .group_by(SearchLog.service)
    )
    service_breakdown = {row[0]: row[1] for row in service_result.all()}

    # 시간별 검색 요청량 (period에 따라 범위 조정)
    if period == "today":
        trend_since = datetime.now(tz=UTC) - timedelta(hours=24)
        trunc_unit = "hour"
    elif period == "week":
        trend_since = since
        trunc_unit = "hour"
    else:
        trend_since = since
        trunc_unit = "day"

    hour_trunc = func.date_trunc(trunc_unit, SearchLog.created_at)
    hourly_result = await db.execute(
        select(
            hour_trunc.label("hour"),
            func.count(SearchLog.id).label("count"),
        )
        .where(SearchLog.created_at >= trend_since)
        .group_by(hour_trunc)
        .order_by(hour_trunc)
    )

    if trunc_unit == "hour":
        hourly_trend = [
            {"hour": row.hour.strftime("%m/%d %H:00"), "count": row.count}
            for row in hourly_result.all()
        ]
    else:
        hourly_trend = [
            {"hour": row.hour.strftime("%m/%d"), "count": row.count}
            for row in hourly_result.all()
        ]

    return {
        "total": total,
        "blocked": blocked,
        "block_rate": block_rate,
        "active_rules": active_rules,
        "service_breakdown": service_breakdown,
        "hourly_trend": hourly_trend,
        "period": period,
    }


@router.get("/top-blocked-users")
async def top_blocked_users(
    period: str = Query(default="today", pattern=r"^(today|week|month)$"),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """차단 건수 상위 10명을 반환합니다."""
    since = _period_start(period)

    result = await db.execute(
        select(
            SearchLog.user_name,
            func.count(SearchLog.id).label("blocked_count"),
        )
        .where(
            SearchLog.created_at >= since,
            SearchLog.response_status == 403,
        )
        .group_by(SearchLog.user_name)
        .order_by(func.count(SearchLog.id).desc())
        .limit(10)
    )

    return [
        {"user_name": row.user_name, "blocked_count": row.blocked_count}
        for row in result.all()
    ]
