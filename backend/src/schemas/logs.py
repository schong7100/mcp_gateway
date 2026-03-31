import uuid
from datetime import datetime

from pydantic import BaseModel


class SearchLogResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    user_id: str
    user_name: str
    service: str
    method: str
    path: str
    request_body: dict | None
    response_status: int
    filtered: bool
    filter_details: dict | None
    created_at: datetime


class SearchLogListResponse(BaseModel):
    items: list[SearchLogResponse]
    total: int
    page: int
    page_size: int
