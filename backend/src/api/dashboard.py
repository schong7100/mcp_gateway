from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.db.models import FilterRule, SearchLog
from src.db.session import get_db

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=UTC)

    # 오늘 검색 요청 수
    total_result = await db.execute(
        select(func.count(SearchLog.id)).where(SearchLog.created_at >= today_start)
    )
    total_today = total_result.scalar_one()

    # 오늘 필터링 건수 (응답 마스킹)
    filtered_result = await db.execute(
        select(func.count(SearchLog.id)).where(
            SearchLog.created_at >= today_start,
            SearchLog.filtered.is_(True),
        )
    )
    filtered_today = filtered_result.scalar_one()

    # 오늘 차단 건수 (요청 차단)
    blocked_result = await db.execute(
        select(func.count(SearchLog.id)).where(
            SearchLog.created_at >= today_start,
            SearchLog.response_status == 403,
        )
    )
    blocked_today = blocked_result.scalar_one()

    # 활성 필터 규칙 수
    active_rules_result = await db.execute(
        select(func.count(FilterRule.id)).where(FilterRule.enabled.is_(True))
    )
    active_rules = active_rules_result.scalar_one()

    # 서비스별 분포
    service_result = await db.execute(
        select(SearchLog.service, func.count(SearchLog.id))
        .where(SearchLog.created_at >= today_start)
        .group_by(SearchLog.service)
    )
    service_breakdown = {row[0]: row[1] for row in service_result.all()}

    return {
        "total_today": total_today,
        "filtered_today": filtered_today,
        "blocked_today": blocked_today,
        "active_rules": active_rules,
        "service_breakdown": service_breakdown,
    }
