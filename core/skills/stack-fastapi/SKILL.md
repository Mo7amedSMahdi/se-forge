---
name: stack-fastapi
description: How this team builds a Python backend - FastAPI with async SQLAlchemy 2, Alembic migrations, pytest + httpx + Testcontainers, uv, ruff and mypy - including the problem-details shape, cursor pages, raw SQL for complex queries, the project.json settings and the Dockerfile. Use on any project whose stack is FastAPI, when planning, building or reviewing backend work.
---

# FastAPI backend

Decisions 37, 41 and 70-73. Checked by running `tests/stacks/run.sh fastapi` (2026-10-07; the dev part 2026-10-08) and `tests/ci/run.sh <gitlab|github> fastapi` in the kit (Python 3.13, uv 0.9, FastAPI 0.142, SQLAlchemy 2.1, Alembic 1.20, pytest 9, Testcontainers 4.15). The files in `examples/` are copies of that sample.

## Layout
```
app/main.py              FastAPI(), problems.install(app), one include_router per feature
app/config.py            pydantic-settings; DATABASE_URL from the environment
app/db.py                async engine, async_sessionmaker, get_session dependency, DeclarativeBase
app/problems.py          RFC 9457 errors (examples/problems.py)
app/<feature>/           models.py (ORM), schemas.py (Pydantic, camelCase aliases), service.py (rules + data), router.py
migrations/              Alembic, async template (`alembic init -t async migrations`); env.py reads settings.database_url
tests/                   conftest.py (Testcontainers + alembic upgrade), test_<feature>.py
```

## Patterns (see `examples/`)
- **Routes** match the contract: `APIRouter(prefix="/v1/<resource>")`, `operation_id=` the contract's operationId, `response_model_by_alias=True`. A path parameter named in camelCase: `Annotated[str, Path(alias="userId")]`.
- **Models**: Pydantic `alias_generator=to_camel, populate_by_name=True`; request models `extra="forbid"` (unknown fields are a 400).
- **Errors**: raise `ProblemError(status, title, detail)`; `problems.install` turns it, `HTTPException` and `RequestValidationError` into `application/problem+json`. Validation is **400** with `errors: [{field, message}]` (FastAPI's default 422 is replaced).
- **Unique violations**: catch `sqlalchemy.exc.IntegrityError` on commit → 409.
- **Query style** (per project, decision 37): ORM `select()` for everyday reads; complex queries with `sqlalchemy.text()` and bound parameters, never f-strings or `%`.
- **Lists**: cursor = base64url JSON of the last row's sort keys; order by `created_at DESC, id DESC`, fetch `limit + 1` (examples/service.py).
- **Created**: status 201 and `response.headers["Location"]`.

## Migrations (Alembic)
The commands below run in the dev container: prefix them with `docker compose run --rm api` (or `docker compose exec -T api` while it is up).
- New: `uv run alembic revision -m "<what>"` (or `--autogenerate`, then read and trim what it wrote). One change per revision; up and down.
- Run: `uv run alembic upgrade head`; back: `uv run alembic downgrade -1`; test: upgrade head → downgrade base → upgrade head on a throwaway container.
- Raw SQL in a migration: `op.execute(...)`. PostgreSQL `CREATE INDEX CONCURRENTLY` must run in `with op.get_context().autocommit_block():`.

## Tests
- `pytest` with `asyncio_mode = "auto"` and session-scoped loops; httpx `AsyncClient(transport=ASGITransport(app=app))`.
- The database is real: `testcontainers.community.postgres.PostgresContainer(..., driver="asyncpg")`, migrated in a session fixture up, all the way down and up again (`upgrade head`, `downgrade base`, `upgrade head`; examples/conftest.py), so every gate run proves the migrations are reversible. Import the app only after `DATABASE_URL` is set.
- Inside a container (the dev container, CI) Testcontainers needs the Docker socket, `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` and the `host-gateway` entry (examples/compose.yaml).

## project.json
```json
"project": { "stack": { "backend": "FastAPI (Python 3.13)" },
  "db": { "image": "postgres:17-alpine", "migrate": "docker compose run --rm api uv run --frozen alembic upgrade head", "rollback": "docker compose run --rm api uv run --frozen alembic downgrade -1", "urlEnv": "DATABASE_URL" } },
"policy": {
  "tests": { "sides": [{ "name": "backend", "code": ["app/**/*.py"], "tests": ["tests/**/*.py"] }] },
  "gates": { "full": "docker compose run --rm -T --no-deps api sh -c 'uv run --frozen ruff format --check . && uv run --frozen ruff check . && uv run --frozen mypy app && uv run --frozen pytest -q'" },
  "edits": { "format": [{ "glob": "**/*.py", "command": "docker compose run --rm -T --no-deps api uv run --frozen ruff format {file}" }],
             "lint": [{ "glob": "**/*.py", "command": "docker compose run --rm -T --no-deps api uv run --frozen ruff check {file}" }] },
  "commit": { "checks": [{ "glob": "**/*.py", "command": "docker compose run --rm -T --no-deps api uv run --frozen ruff check {files}" }] }
}
```
`pyproject.toml` holds the tool settings: ruff (`select = ["E","F","I","B","UP","ASYNC","S"]`), mypy `strict = true` with the pydantic plugin, pytest's asyncio options.

Everything runs in the dev container (decision 72): the gate, the per-file checks and the migrations go through `docker compose run`. In one repository holding both services, prefix the globs with the service's folder and add `"dir": "<folder>"` to each per-file rule (skill `dev-environment`).

## Containers (skills `dockerize`, `dev-environment`)
- `examples/Dockerfile`: the `dev` target (the uv image; the virtualenv in `/opt/venv`, outside the mounted source; `uvicorn --reload`), then the production image: `uv sync --frozen --no-dev`, the app and its `.venv` on `python:3.13-slim` as a non-root user, `uvicorn app.main:app --port 8080`. `.dockerignore` keeps `.venv` and `.env*` out.
- `examples/compose.yaml`: PostgreSQL 17 with a health check; the API from the dev target, migrated at start, the Docker socket for Testcontainers, healthy once `/openapi.json` answers.
- Outside local development, migrations run as their own step before the new version starts, never at app start-up.

## Done when
- the change follows the layout and patterns above, and the contract's status codes each have a test;
- the gate passes in the dev container (`forge gates`, the `policy.gates.full` above);
- a migration, if any, passes the test setup's upgrade → downgrade → upgrade (every gate run does it).
