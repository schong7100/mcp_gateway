from fastapi import APIRouter, Depends, Query
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
