---
name: env-config
description: How a service gets its configuration - environment variables only, read and checked once at start-up, documented in .env.example, development defaults in compose.yaml, secrets never in the repository or an image. Use when adding, renaming or removing a setting, a connection string, an API key or a feature flag, or when a service fails at start for a missing value.
---

# Configuration from the environment

Decisions 62 (secrets on the server: next release, with staging), 70-72. Agents never open `.env` files
(the hook refuses it) and never print a value: they work from `.env.example` and variable names.

## Rules
- **One source:** environment variables. No settings committed per environment (`appsettings.Production.json` with values, `config/prod.ts`); code defaults only for values that are the same everywhere and not secret.
- **Names:** UPPER_SNAKE_CASE, prefixed by what they configure (`DATABASE_URL`, `SMTP_HOST`, `PAYMENTS_API_KEY`). .NET reads nested keys with a double underscore (`ConnectionStrings__Default`).
- **Read once, at start, checked:** one settings module per service (pydantic-settings `Settings`, a zod schema in Node, options classes with `ValidateOnStart()` in .NET). A missing or malformed required value stops the service at start with the variable's name, never its value.
- **`.env.example`** (committed) lists every variable the service and compose.yaml read: a comment saying what it is, and a safe example or an empty value. Never a real secret, even an expired one.
- **`.env`** (git-ignored, never committed or copied into an image) holds a developer's overrides. compose.yaml loads it with `env_file: [{ path: .env, required: false }]` and gives development defaults in place: `${DATABASE_URL:-postgresql+asyncpg://app:app@db:5432/app}`.
- **Development defaults** in compose.yaml are for local containers only (`app`/`app`, `Forge_dev_1`). A real credential (a third-party sandbox key) goes in `.env`, never in compose.yaml.
- **CI:** values come from the host's CI/CD variables, masked and protected, set by a person (agents cannot read or set them). The kit's CI templates need none beyond what the host provides (registry login, job token).
- **Logs and errors** name the variable, never the value; no settings dump at start.

## Steps
1. Add the setting to the service's settings module with its type and whether it is required.
2. Add it to `.env.example` with a comment, and to compose.yaml's `environment:` with a development default when the service cannot start without it.
3. Use it through the settings object; tests set it explicitly (fixture or test configuration), never from a developer's `.env`.
4. Tell the owner in the ticket comment which new variables a deployment needs (names only).
5. `docker compose up -d --build --wait` from a clean checkout (no `.env`) still starts every service.

## Done when
- every variable the code and compose.yaml read is in `.env.example`, with a comment;
- a missing required value stops the service at start with the variable's name;
- no secret value is in the repository, an image layer, a log line or a test fixture;
- the services start from a clean checkout with the development defaults alone.
