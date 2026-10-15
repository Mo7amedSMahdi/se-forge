import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.problems import ProblemError
from app.users import schemas, service

router = APIRouter(prefix="/v1/users", tags=["users"])
Session = Annotated[AsyncSession, Depends(get_session)]


@router.get("", operation_id="listUsers", response_model=schemas.UserPage, response_model_by_alias=True)
async def list_users(
    session: Session, limit: Annotated[int, Query(ge=1, le=100)] = 20, cursor: str | None = None
) -> schemas.UserPage:
    users, next_cursor = await service.list_users(session, limit, cursor)
    return schemas.UserPage(items=[schemas.User.model_validate(u) for u in users], next_cursor=next_cursor)


@router.post("", operation_id="createUser", status_code=201, response_model=schemas.User, response_model_by_alias=True)
async def create_user(body: schemas.CreateUser, session: Session, response: Response) -> schemas.User:
    user = await service.create_user(session, body.email, body.display_name)
    response.headers["Location"] = f"/v1/users/{user.id}"
    return schemas.User.model_validate(user)


@router.get("/{userId}", operation_id="getUser", response_model=schemas.User, response_model_by_alias=True)
async def get_user(session: Session, user_id: Annotated[str, Path(alias="userId")]) -> schemas.User:
    try:
        parsed = uuid.UUID(user_id)
    except ValueError as exc:
        raise ProblemError(404, "User not found") from exc
    return schemas.User.model_validate(await service.get_user(session, parsed))
