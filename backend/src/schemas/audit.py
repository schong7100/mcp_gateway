import uuid
from datetime import datetime

from pydantic import BaseModel


class AuditTrailResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: str
    user_name: str
    action: str
    resource_type: str
    resource_id: str | None
    details: dict | None
    created_at: datetime


class AuditTrailListResponse(BaseModel):
    items: list[AuditTrailResponse]
    total: int
    page: int
    page_size: int
