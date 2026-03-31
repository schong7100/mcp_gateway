from fastapi import APIRouter, Depends, Query
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
