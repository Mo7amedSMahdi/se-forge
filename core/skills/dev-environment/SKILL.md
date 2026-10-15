---
name: dev-environment
description: The local container setup every project uses (decisions 70-72) - the database, the API and the web app in Docker Compose with hot reload, and the gate, tests and migrations run inside those containers by developers and agents alike. Use when setting up or changing compose.yaml, when running the app, its tests or its migrations locally, or when a dev container misbehaves.
---

# Local development in Compose

Verified on every stack sample with `tests/stacks/run.sh <stack> dev` (2026-10-08): up, the API answers,
a saved change is served by the running container, the gate (Testcontainers included) passes inside it.
Each stack guide's `examples/compose.yaml` and `examples/Dockerfile` are copies of those samples.

## Shape of compose.yaml (one per repo; examples in `stack-*`)
- **db**: the project's database image, a named volume, a health check, published on `127.0.0.1:${DB_PORT:-<port>}`. Development passwords only, overridable from `.env`.
- **api** (or **app**): `build: { context: ., target: dev }` (skill `dockerize`); the source mounted `.:/app`; the container's own dependency folders as anonymous volumes (`/app/node_modules`; .NET `obj/` and `bin/` per project) or kept outside `/app` (uv's `UV_PROJECT_ENVIRONMENT=/opt/venv`); `/var/run/docker.sock` mounted with `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` and `extra_hosts: ["host.docker.internal:host-gateway"]` so Testcontainers work inside; migrations then the watcher as its command; a health check (probe every second while starting, then every 30 s); `depends_on: { db: { condition: service_healthy } }`.
- **web**: the frontend's dev server (`vite --host 0.0.0.0`), `API_URL: http://api:8080` for its `/v1` proxy, its own health check, `depends_on: { api: { condition: service_healthy } }`. Separate repos: `include:` the backend's compose file from a checkout next to this one (`stack-react` example), so one `up` runs everything.
- **e2e** (`profiles: ["e2e"]`): the frontend dev image running `npx playwright test` against the production build, with `API_URL` set.
- **mobile** (a Flutter app; `stack-flutter` example): no server runs in Compose.
  - `mobile` (profile `tools`) runs the gate and `integration` (profile `e2e`) the integration tests on the Linux build under Xvfb against `api`;
  - both have `init: true` and keep `/app/.dart_tool` as an anonymous volume;
  - `include:` the backend's compose file, so `up` runs the API that the app on a simulator uses (`flutter run --dart-define=API_URL=http://localhost:8080` on the Mac; a person's step).
- Every host port comes from a variable with a default (`API_PORT`, `DB_PORT`, `WEB_PORT`), so two projects can run side by side. `.env` (git-ignored) overrides; `.env.example` lists the variables (skill `env-config`).

## One repository holding both services
Verified with `tests/stacks/run.sh monorepo` (the FastAPI sample as `backend/`, the React sample as `frontend/`).
- Each service keeps its own folder, Dockerfile and `compose.yaml`; `frontend/compose.yaml` includes `../backend/compose.yaml`, so `docker compose up -d --wait` in `frontend/` runs everything.
- Every folder's `compose.yaml` starts with the same `name: <repository>` (`forge new` writes it). Then the folders are one Compose project: the web app and the mobile app use one API and one database, and a migration run in `backend/` uses the running database. Unnamed, each folder is a project named after the folder (`backend`, `frontend`), shared with every other repository that has one, and a second one fails with "port is already allocated". Checked by `tests/starter/run.sh all-three` (2026-10-12).
- `project.json`: prefix the globs with the folder (`tests.sides`, the rules), and give each per-file rule its folder, so the command runs there and `{file}`/`{files}` are relative to it:
  `{ "glob": "backend/**/*.py", "dir": "backend", "command": "docker compose run --rm -T --no-deps api uv run --frozen ruff format {file}" }`.
- The gate runs each service's gate from the root: `"full": "cd backend && <backend gate> && cd ../frontend && <frontend gate>"`, each being the stack guide's `docker compose run …` command.
- CI: one matrix entry per folder (`CONTEXT`, `IMAGE_NAME`, `GATE_COMMAND`; skill `ci-pipeline`).

## Steps
1. Start everything: `docker compose up -d --build --wait` (returns when every health check passes). Logs: `docker compose logs --tail 50 api`.
2. Gate and tests, inside the container: `docker compose run --rm -T --no-deps api sh -c '<gate>'`. The project's `policy.gates.full` is exactly this command (stack guides), so `forge gates` runs the same thing. Output control still applies: `> /tmp/gate.log 2>&1`, then read the tail.
3. One command in the running container: `docker compose exec -T api <command>`. The hook checks the command inside like one on the host (adding dependencies asks, `cat .env` is refused). Use paths relative to the working directory: an absolute path inside the container (`/app/...`) is read as a host path outside the repo and refused.
4. Migrations: `docker compose run --rm api <migrate command>` (the stack's `db.migrate`); the api service also runs them at start.
5. After a dependency change (lock file): `docker compose up -d --build --renew-anon-volumes --wait`, so the container's dependency volume is rebuilt from the image.
6. End to end: `docker compose --profile e2e run --rm -T e2e`.
7. Stop: `docker compose down`. `down -v` deletes the database volume: it asks a person first.

## When it misbehaves
| Symptom | Cause and fix |
|---|---|
| `EADDRINUSE` after each save (NestJS) | `nest start --watch` stops the old server with `ps`; slim Node images lack it. The dev target uses `node:24-bookworm`. |
| A change is not picked up (.NET) | Mounted folders raise no reliable file events: `DOTNET_USE_POLLING_FILE_WATCHER=1` (in the dev target). |
| 502 from the web proxy right after `up` | The API was not answering yet: health checks on api and web, `depends_on` with `service_healthy`. |
| Compose recreates the database, or "port is already allocated" | A different port value than the running services got: use the same `.env` for every call. In one repository with several folders, a `compose.yaml` without the shared `name:` starts a second project. |
| Testcontainers cannot connect | The socket mount, `TESTCONTAINERS_HOST_OVERRIDE` or the `host-gateway` entry is missing. |
| Stale dependencies after a pull | Step 5. |
| SQL Server is slow to start on a Mac | No arm64 image; it runs emulated (`platform: linux/amd64`). |
| Flutter integration tests never start | `xvfb-run` running as the container's first process waits forever: `init: true` (or `docker run --init`). |
| Every letter is a box in a Flutter picture | The image has only `fonts-noto-core`: install `fonts-dejavu-core` (Latin and Arabic). |
| Docker stops answering during an Android build | Gradle took the Docker VM's memory: Android builds run in CI (decision 111), not in the local Docker. |

## Done when
- `docker compose up -d --build --wait` brings every service up healthy from a clean checkout;
- a saved change is served by the running container without a manual restart;
- the gate runs inside the container with `docker compose run --rm -T --no-deps …` and passes, and `policy.gates.full` is that command;
- `.env.example` lists every variable compose.yaml reads, and nothing secret is committed.
