import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FilterRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    rule_type: str = Field(..., pattern=r"^(regex|keyword|quality)$")
    pattern: str = Field(..., min_length=1)
    service: str = Field(default="all", pattern=r"^(context7|exa|all)$")
    direction: str = Field(default="both", pattern=r"^(request|response|both)$")
    enabled: bool = True


class FilterRuleUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    pattern: str | None = Field(default=None, min_length=1)
    service: str | None = Field(default=None, pattern=r"^(context7|exa|all)$")
    direction: str | None = Field(default=None, pattern=r"^(request|response|both)$")
    enabled: bool | None = None


class FilterRuleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    description: str | None
    rule_type: str
    pattern: str
    service: str
    direction: str
    enabled: bool
    created_by: str
    created_at: datetime
    updated_at: datetime
