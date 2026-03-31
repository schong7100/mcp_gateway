import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps import CurrentUser, get_current_user
from src.db.models import AuditTrail, FilterRule
from src.db.session import get_db
from src.schemas.filters import FilterRuleCreate, FilterRuleResponse, FilterRuleUpdate

router = APIRouter(prefix="/api/v1/filters", tags=["filters"])


@router.get("", response_model=list[FilterRuleResponse])
async def list_filter_rules(
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FilterRuleResponse]:
    stmt = select(FilterRule).order_by(FilterRule.created_at.desc())
    result = await db.execute(stmt)
    rules = result.scalars().all()
    return [FilterRuleResponse.model_validate(rule) for rule in rules]


@router.post("", response_model=FilterRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_filter_rule(
    payload: FilterRuleCreate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FilterRuleResponse:
    rule = FilterRule(
        name=payload.name,
        description=payload.description,
        rule_type=payload.rule_type,
        pattern=payload.pattern,
        service=payload.service,
        direction=payload.direction,
        enabled=payload.enabled,
        created_by=user.username,
    )
    db.add(rule)

    audit = AuditTrail(
        user_id=user.user_id,
        user_name=user.username,
        action="filter_create",
        resource_type="filter_rule",
        resource_id=str(rule.id),
        details={"name": payload.name, "rule_type": payload.rule_type},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rule)
    return FilterRuleResponse.model_validate(rule)


@router.get("/{rule_id}", response_model=FilterRuleResponse)
async def get_filter_rule(
    rule_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FilterRuleResponse:
    rule = await db.get(FilterRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter rule not found")
    return FilterRuleResponse.model_validate(rule)


@router.patch("/{rule_id}", response_model=FilterRuleResponse)
async def update_filter_rule(
    rule_id: uuid.UUID,
    payload: FilterRuleUpdate,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FilterRuleResponse:
    rule = await db.get(FilterRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter rule not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    audit = AuditTrail(
        user_id=user.user_id,
        user_name=user.username,
        action="filter_update",
        resource_type="filter_rule",
        resource_id=str(rule_id),
        details={"updated_fields": list(update_data.keys())},
    )
    db.add(audit)
    await db.commit()
    await db.refresh(rule)
    return FilterRuleResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_filter_rule(
    rule_id: uuid.UUID,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    rule = await db.get(FilterRule, rule_id)
    if rule is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter rule not found")

    audit = AuditTrail(
        user_id=user.user_id,
        user_name=user.username,
        action="filter_delete",
        resource_type="filter_rule",
        resource_id=str(rule_id),
        details={"name": rule.name},
    )
    db.add(audit)
    await db.delete(rule)
    await db.commit()
