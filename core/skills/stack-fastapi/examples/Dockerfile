# One Dockerfile, two targets. `dev`: the toolchain and the source, for Compose (the source is mounted
# over /app, uvicorn reloads on change) and for CI (the gate runs in it). The last stage is the production
# image: built with uv, run as a non-root user, never containing .env files or tests.
FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS dev
WORKDIR /app
# The virtualenv lives outside /app so the mounted source never carries a host .venv; `uv run` keeps it
# in sync with uv.lock on every call.
ENV UV_PROJECT_ENVIRONMENT=/opt/venv UV_LINK_MODE=copy PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project
COPY . .
EXPOSE 8080
CMD ["uv", "run", "--frozen", "uvicorn", "app.main:app", "--reload", "--host", "0.0.0.0", "--port", "8080"]

FROM ghcr.io/astral-sh/uv:python3.13-bookworm-slim AS build
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./

FROM python:3.13-slim-bookworm
RUN useradd --create-home --uid 10001 app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
ENV PATH="/app/.venv/bin:$PATH"
USER app
EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
