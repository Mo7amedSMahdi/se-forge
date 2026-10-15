"""Business rules and data access for users. Simple reads use the ORM; a complex query would use
sqlalchemy.text() with bound parameters (never string-built SQL)."""

import base64
import json
import uuid
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.problems import ProblemError
from app.users.models import User


def encode_cursor(user: User) -> str:
    raw = json.dumps({"c": user.created_at.isoformat(), "i": str(user.id)})
    return base64.urlsafe_b64encode(raw.encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        return datetime.fromisoformat(data["c"]), uuid.UUID(data["i"])
    except (ValueError, KeyError, TypeError) as exc:
        raise ProblemError(400, "Invalid cursor") from exc


async def list_users(session: AsyncSession, limit: int, cursor: str | None) -> tuple[list[User], str | None]:
    query = select(User).order_by(User.created_at.desc(), User.id.desc()).limit(limit + 1)
    if cursor:
        created, last_id = decode_cursor(cursor)
        query = query.where(or_(User.created_at < created, (User.created_at == created) & (User.id < last_id)))
    rows = list((await session.scalars(query)).all())
    page = rows[:limit]
    return page, encode_cursor(page[-1]) if len(rows) > limit else None


async def create_user(session: AsyncSession, email: str, display_name: str) -> User:
    user = User(email=email.lower(), display_name=display_name)
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ProblemError(409, "Email already used", f"A user with email {email} exists.") from exc
    await session.refresh(user)
    return user


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise ProblemError(404, "User not found")
    return user
