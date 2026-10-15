import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    # camelCase JSON, snake_case Python (team API style)
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


class CreateUser(ApiModel):
    model_config = ConfigDict(extra="forbid", alias_generator=to_camel, populate_by_name=True)

    email: EmailStr = Field(max_length=254)
    display_name: str = Field(min_length=1, max_length=100)


class User(ApiModel):
    id: uuid.UUID
    email: str
    display_name: str
    status: Literal["ACTIVE", "SUSPENDED"]
    created_at: datetime


class UserPage(ApiModel):
    items: list[User]
    next_cursor: str | None
