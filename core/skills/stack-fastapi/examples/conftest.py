"""A real PostgreSQL per test session (Testcontainers), migrated with Alembic like production. The
migrations run up, all the way down and up again, so every gate run proves they are reversible."""

import os
import subprocess
import sys
from collections.abc import AsyncIterator, Iterator

import pytest
from httpx import ASGITransport, AsyncClient
from testcontainers.community.postgres import PostgresContainer


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    with PostgresContainer("postgres:17-alpine", driver="asyncpg") as pg:
        url = pg.get_connection_url()
        os.environ["DATABASE_URL"] = url
        alembic = [sys.executable, "-m", "alembic"]
        subprocess.run([*alembic, "upgrade", "head"], check=True, env=os.environ.copy())  # noqa: S603
        subprocess.run([*alembic, "downgrade", "base"], check=True, env=os.environ.copy())  # noqa: S603
        subprocess.run([*alembic, "upgrade", "head"], check=True, env=os.environ.copy())  # noqa: S603
        yield url


@pytest.fixture(scope="session")
async def client(database_url: str) -> AsyncIterator[AsyncClient]:
    from app.main import app  # imported after DATABASE_URL is set

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
