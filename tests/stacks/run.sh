#!/usr/bin/env bash
# Runs one stack sample the way its guide (core/skills/stack-*, db-*) says: the gate command, the
# migrations up, down and up on a fresh database container, and the production image build.
# The dev part (decisions 71, 72) runs the sample's compose.yaml on a copy: up with hot reload, a saved
# change picked up by the running server, the gate inside the dev container.
# Needs Docker; downloads toolchains and packages.
# Usage: tests/stacks/run.sh <fastapi|dotnet|nestjs|mongodb|react|flutter> [all|checks|dev]
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stack="${1:?usage: run.sh <fastapi|dotnet|nestjs|mongodb|react|flutter> [all|checks|dev]}"
part="${2:-all}"
net="forge-stack-$stack-$$"
fails=0
work=""
docker network create "$net" >/dev/null
# -v: database images keep their data in anonymous volumes, which docker rm alone leaves behind.
cleanup() {
  docker ps -aq --filter "label=forge-stack=$net" | xargs -r docker rm -f -v >/dev/null 2>&1; docker network rm "$net" >/dev/null 2>&1
  if [[ -n "$work" ]]; then "${DC[@]}" down -v --rmi local --remove-orphans >/dev/null 2>&1; rm -rf "$work"; fi
}
trap cleanup EXIT
want() { [[ "$part" == all || "$part" == "$1" ]]; }
# --- the dev part ---
# A copy of the sample (without host-built folders) and `docker compose` on it, under a project name of
# its own; host ports are picked by Docker so nothing collides with what already runs.
# devcopy <sample> [<sibling sample> ...]: siblings keep their place next to it (an included compose.yaml).
devcopy() {
  work="$(mktemp -d "${TMPDIR:-/tmp}/forge-dev-$stack.XXXXXX")"
  local s
  for s in "$@"; do
    rsync -a --exclude node_modules --exclude .venv --exclude dist --exclude bin --exclude obj --exclude '.*_cache' --exclude coverage \
      --exclude test-results --exclude playwright-report --exclude .dart_tool --exclude /build "$here/$s/" "$work/$s/"
  done
  # Host ports picked by Docker, the same for every call (a different value would recreate the services).
  DC=(env API_PORT=0 DB_PORT=0 WEB_PORT=0 docker compose -p "forge-dev-$stack-$$" --project-directory "$work/$1" -f "$work/$1/compose.yaml")
}
# The URL of a service's published port on the host.
hostport() { "${DC[@]}" port "$1" "$2" | sed 's/^0\.0\.0\.0/127.0.0.1/'; }
# Polls <url> until its body matches <grep> (any status), or until it answers 2xx when no pattern is
# given, for up to <seconds>.
waitfor() { local url="$1" pattern="${2:-}" secs="${3:-120}" body
  for _ in $(seq 1 "$secs"); do
    if [[ -n "$pattern" ]]; then body="$(curl -sS "$url" 2>/dev/null)" && grep -q "$pattern" <<<"$body" && return 0
    else curl -fsS -o /dev/null "$url" 2>/dev/null && return 0; fi
    sleep 1
  done
  echo "no answer from $url"; "${DC[@]}" logs --tail 40 2>&1; return 1; }
up() { "${DC[@]}" up -d --build --wait --wait-timeout 600; }
step() { local name="$1"; shift; local log; log="$(mktemp)"; if "$@" >"$log" 2>&1; then echo "PASS  $stack: $name"; else echo "FAIL  $stack: $name"; tail -30 "$log" | sed 's/^/      /'; fails=$((fails + 1)); fi; rm -f "$log"; }
# A database container on the sample's network, reachable as "db"; waits until <probe> succeeds inside it.
db() { local image="$1" probe="$2"; shift 2
  docker run -d --label "forge-stack=$net" --network "$net" --network-alias db "$@" "$image" >/dev/null || return 1
  for _ in $(seq 1 60); do docker exec "$(docker ps -q --filter "label=forge-stack=$net" | head -1)" sh -c "$probe" >/dev/null 2>&1 && return 0; sleep 3; done; return 1; }
SOCK=(-v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal)
# The production image starts against the migrated database and answers GET /v1/users with 200.
smoke() { local image="$1"; shift
  docker run -d --label "forge-stack=$net" --network "$net" --name "app-$net" "$@" "$image" >/dev/null || return 1
  for _ in $(seq 1 40); do
    docker run --rm --network "$net" curlimages/curl:8.11.1 -fsS "http://app-$net:8080/v1/users" && return 0
    sleep 3
  done
  docker logs "app-$net" 2>&1 | tail -20; return 1; }

case "$stack" in
  fastapi)
    if want dev; then
      devcopy fastapi
      step "dev: compose up (PostgreSQL, API migrated, uvicorn --reload)" up
      step "dev: the API answers GET /v1/users" waitfor "http://$(hostport api 8080)/v1/users" items
      cp "$work/fastapi/app/main.py" "$work/fastapi/main.py.orig"
      printf '\n\n@app.get("/reload-probe")\ndef reload_probe() -> dict[str, str]:\n    return {"reloaded": "yes"}\n' >>"$work/fastapi/app/main.py"
      step "dev: a saved change is served by the running container (hot reload)" waitfor "http://$(hostport api 8080)/reload-probe" reloaded 60
      mv "$work/fastapi/main.py.orig" "$work/fastapi/app/main.py"
      step "dev: the gate inside the dev container (ruff, mypy --strict, pytest with Testcontainers)" "${DC[@]}" run --rm -T --no-deps api sh -c 'uv run --frozen ruff format --check . && uv run --frozen ruff check . && uv run --frozen mypy app && uv run --frozen pytest -q -W error::DeprecationWarning'
      step "dev: k6 load test against the running API, thresholds met (perf profile)" "${DC[@]}" --profile perf run --rm -T k6
      # A threshold the API cannot meet must fail the run (exit code 99), not just print.
      sed 's/p(95)<300/p(95)<0.001/' "$work/fastapi/perf/users.js" >"$work/fastapi/perf/strict.js"
      step "dev: k6 fails the run when a threshold is not met" sh -c "${DC[*]} --profile perf run --rm -T k6 run /perf/strict.js; test \$? -eq 99"
    fi
    want checks || exit $((fails > 0))
    UV=(docker run --rm --network "$net" -v "$here/fastapi:/work" -w /work "${SOCK[@]}")
    IMG=ghcr.io/astral-sh/uv:python3.13-bookworm-slim
    step "gate (ruff format, ruff check, mypy --strict, pytest with Testcontainers)" "${UV[@]}" "$IMG" sh -c 'uv sync --frozen -q && uv run ruff format --check . && uv run ruff check . && uv run mypy app && uv run pytest -q -W error::DeprecationWarning'
    step "PostgreSQL 17 container" db postgres:17-alpine 'pg_isready -U postgres && psql -U postgres -d app -c "select 1"' -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app
    step "alembic upgrade head, downgrade base, upgrade head" "${UV[@]}" -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/app "$IMG" sh -c 'uv sync --frozen -q && uv run alembic upgrade head && uv run alembic downgrade base && uv run alembic upgrade head'
    step "production image builds" docker build -q -t "forge-stack-fastapi:test" "$here/fastapi"
    step "the image starts and answers GET /v1/users" smoke forge-stack-fastapi:test -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/app
    ;;
  dotnet)
    if want dev; then
      devcopy dotnet
      step "dev: compose up (SQL Server 2022, dotnet ef database update, dotnet watch)" up
      step "dev: the API answers GET /v1/users" waitfor "http://$(hostport api 8080)/v1/users" items 300
      sed -i '' 's/Problems.Of(404, "User not found")/Problems.Of(404, "User not found (reloaded)")/' "$work/dotnet/src/Users.Api/Users/UserEndpoints.cs"
      step "dev: a saved change is served by the running container (hot reload)" waitfor "http://$(hostport api 8080)/v1/users/00000000-0000-0000-0000-000000000000" reloaded 180
      sed -i '' 's/User not found (reloaded)/User not found/' "$work/dotnet/src/Users.Api/Users/UserEndpoints.cs"
      step "dev: the gate inside the dev container (dotnet format, build -warnaserror, test with Testcontainers)" "${DC[@]}" run --rm -T --no-deps api sh -c 'dotnet format --verify-no-changes && dotnet format --verify-no-changes --include src/Users.Api/Program.cs src/Users.Api/Problems.cs && dotnet build -warnaserror && dotnet test'
    fi
    want checks || exit $((fails > 0))
    NET=(docker run --rm --network "$net" -v "$here/dotnet:/work" -w /work "${SOCK[@]}" -e DOTNET_CLI_TELEMETRY_OPTOUT=1 -e DOTNET_NOLOGO=1)
    IMG=mcr.microsoft.com/dotnet/sdk:10.0
    step "gate (dotnet format --verify-no-changes, build -warnaserror, test with Testcontainers)" "${NET[@]}" "$IMG" sh -c 'dotnet format --verify-no-changes && dotnet format --verify-no-changes --include src/Users.Api/Program.cs src/Users.Api/Problems.cs && dotnet build -warnaserror && dotnet test'
    step "SQL Server 2022 container (amd64; emulated on Apple Silicon)" db mcr.microsoft.com/mssql/server:2022-latest '/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Forge_test_1" -C -Q "select 1"' --platform linux/amd64 -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=Forge_test_1
    step "dotnet ef database update, update 0, update; idempotent script; bundle" "${NET[@]}" -e 'ConnectionStrings__Default=Server=db;Database=app;User Id=sa;Password=Forge_test_1;TrustServerCertificate=true' "$IMG" sh -c 'dotnet tool restore && dotnet ef database update --project src/Users.Api && dotnet ef database update 0 --project src/Users.Api && dotnet ef database update --project src/Users.Api && dotnet ef migrations script --idempotent --project src/Users.Api -o /tmp/migrations.sql && grep -q "CREATE TABLE \[Users\]" /tmp/migrations.sql && dotnet ef migrations bundle --project src/Users.Api -o /tmp/efbundle --force && /tmp/efbundle'
    step "production image builds" docker build -q -t "forge-stack-dotnet:test" "$here/dotnet"
    step "the image starts and answers GET /v1/users" smoke forge-stack-dotnet:test -e 'ConnectionStrings__Default=Server=db;Database=app;User Id=sa;Password=Forge_test_1;TrustServerCertificate=true'
    ;;
  nestjs)
    if want dev; then
      devcopy nestjs
      step "dev: compose up (MySQL, API migrated, nest start --watch)" up
      step "dev: the API answers GET /v1/users" waitfor "http://$(hostport api 8080)/v1/users" items 180
      cp "$work/nestjs/src/main.ts" "$work/nestjs/main.ts.orig"
      sed -i '' 's#^  await app.listen#  app.getHttpAdapter().get("/reload-probe", (_req: unknown, res: { json: (b: object) => void }) => res.json({ reloaded: "yes" }));\n  await app.listen#' "$work/nestjs/src/main.ts"
      step "dev: a saved change is served by the running container (hot reload)" waitfor "http://$(hostport api 8080)/reload-probe" reloaded 120
      mv "$work/nestjs/main.ts.orig" "$work/nestjs/src/main.ts"
      step "dev: the gate inside the dev container (build, oxlint, prettier, vitest unit and e2e with Testcontainers)" "${DC[@]}" run --rm -T --no-deps api sh -c 'npm run build && npm run lint && npx oxlint src/problems.ts && npx prettier --check "src/**/*.ts" "test/**/*.ts" && npm test && npm run test:e2e'
    fi
    want checks || exit $((fails > 0))
    NODE=(docker run --rm --network "$net" -v "$here/nestjs:/work" -w /work "${SOCK[@]}")
    IMG=node:24-bookworm
    step "gate (build, oxlint, prettier --check, vitest unit, vitest e2e with Testcontainers)" "${NODE[@]}" "$IMG" sh -c 'npm ci --no-fund --no-audit && npm run build && npm run lint && npx oxlint src/problems.ts && npx prettier --check "src/**/*.ts" "test/**/*.ts" && npm test && npm run test:e2e'
    step "MySQL 8.4 container" db mysql:8.4 'mysql -uroot -proot -e "select 1" app' -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=app
    step "typeorm migration:run, migration:revert, migration:run" "${NODE[@]}" -e DATABASE_URL=mysql://root:root@db:3306/app "$IMG" sh -c 'npm ci --no-fund --no-audit && npm run build && npx typeorm migration:run -d dist/data-source.js && npx typeorm migration:revert -d dist/data-source.js && npx typeorm migration:run -d dist/data-source.js'
    step "production image builds" docker build -q -t "forge-stack-nestjs:test" "$here/nestjs"
    step "the image starts and answers GET /v1/users" smoke forge-stack-nestjs:test -e DATABASE_URL=mysql://root:root@db:3306/app
    ;;
  mongodb)
    if want dev; then
      devcopy mongodb
      step "dev: compose up (MongoDB 8.0, migrate-mongo up)" up
      step "dev: the migrations are applied (migrate-mongo status)" sh -c "${DC[*]} exec -T app npx migrate-mongo status | tee /dev/stderr | grep -Eq 'create-users\.js.*20[0-9]{2}-'"
      step "dev: the gate inside the dev container (tsc --noEmit, vitest with Testcontainers)" "${DC[@]}" run --rm -T --no-deps app sh -c 'npm run typecheck && npm test'
    fi
    want checks || exit $((fails > 0))
    NODE=(docker run --rm --network "$net" -v "$here/mongodb:/work" -w /work "${SOCK[@]}")
    IMG=node:24-bookworm
    step "gate (tsc --noEmit, vitest with Testcontainers: migrations, validator, repository)" "${NODE[@]}" "$IMG" sh -c 'npm ci --no-fund --no-audit && npm run typecheck && npm test'
    step "MongoDB 8.0 container" db mongo:8.0 'mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok"'
    step "migrate-mongo up, down, up" "${NODE[@]}" -e MONGODB_URL=mongodb://db:27017 -e MONGODB_DB=app "$IMG" sh -c 'npm ci --no-fund --no-audit && npx migrate-mongo up && npx migrate-mongo down && npx migrate-mongo up && npx migrate-mongo status'
    ;;
  react)
    if want dev; then
      devcopy react fastapi
      step "dev: compose up (the backend's compose included: PostgreSQL, FastAPI; Vite dev server)" up
      step "dev: the app is served, and /v1 reaches the API through Vite's proxy" sh -c "curl -fsS http://$(hostport web 5173)/ | grep -q '<div id=\"root\">' && curl -fsS http://$(hostport web 5173)/v1/users | grep -q items"
      curl -fsS "http://$(hostport web 5173)/src/i18n/en.json" >/dev/null
      sed -i '' 's/^{/{ "reloadProbe": "reloaded-yes",/' "$work/react/src/i18n/en.json"
      step "dev: a saved change is served by the running container (hot reload)" waitfor "http://$(hostport web 5173)/src/i18n/en.json" reloaded-yes 60
      sed -i '' 's/^{ "reloadProbe": "reloaded-yes",/{/' "$work/react/src/i18n/en.json"
      step "dev: the gate inside the dev container (tsc -b, oxlint, vitest + Testing Library + msw)" "${DC[@]}" run --rm -T --no-deps web sh -c 'npm run typecheck && npm run lint && npm test'
      step "dev: playwright in the e2e container (chromium, firefox, webkit), production build against the running API" "${DC[@]}" --profile e2e run --rm -T e2e
    fi
    want checks || exit $((fails > 0))
    PW=(docker run --rm --network "$net" -v "$here/react:/work" -v "$here/contract:/contract:ro" -w /work -e CI=1)
    IMG=mcr.microsoft.com/playwright:v1.63.0-noble
    step "gate (tsc -b, oxlint, vitest + Testing Library + msw)" "${PW[@]}" "$IMG" sh -c 'npm ci --no-fund --no-audit && npm run typecheck && npm run lint && npm test'
    step "the API client is generated from the contract (openapi-typescript)" "${PW[@]}" "$IMG" sh -c 'npx --yes openapi-typescript@7.13.0 /contract/users.yaml -o /tmp/schema.d.ts >/dev/null && diff -u src/api/schema.d.ts /tmp/schema.d.ts'
    # The real API for the end-to-end tests: the FastAPI sample on PostgreSQL, migrated.
    step "API: FastAPI sample image on PostgreSQL 17" sh -c "docker build -q -t forge-stack-fastapi:test '$here/fastapi' >/dev/null"
    step "PostgreSQL 17 container" db postgres:17-alpine 'pg_isready -U postgres && psql -U postgres -d app -c "select 1"' -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app
    step "API migrated and started" sh -c "docker run --rm --network '$net' -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/app forge-stack-fastapi:test alembic upgrade head && docker run -d --label forge-stack=$net --network '$net' --network-alias api -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/app forge-stack-fastapi:test >/dev/null"
    step "playwright test (chromium, firefox, webkit) on the production build, against the real API" "${PW[@]}" -e API_URL=http://api:8080 "$IMG" sh -c 'npm ci --no-fund --no-audit && npx playwright test'
    step "web image builds" docker build -q -t "forge-stack-react:test" "$here/react"
    step "the web image serves the app and proxies /v1 to the API" sh -c "docker run -d --label forge-stack=$net --network '$net' --name web-$net -e API_URL=http://api:8080 forge-stack-react:test >/dev/null && for i in \$(seq 1 20); do docker run --rm --network '$net' curlimages/curl:8.11.1 -fsS http://web-$net:8080/users/new | grep -q '<div id=\"root\">' && docker run --rm --network '$net' curlimages/curl:8.11.1 -fsS http://web-$net:8080/v1/users | grep -q items && exit 0; sleep 2; done; docker logs web-$net; exit 1"
    ;;
  flutter)
    # No production image and no phone builds here: Android is built in CI, iOS on a Mac (decision 111).
    # Each flow's picture and record (FORGE_SHOTS, decision 100): two PNGs, two JSON records with what, at and test.
    shots() { local d="$1"; ls "$d"/*.png && [[ "$(ls "$d"/*.png | wc -l)" -eq 2 ]] && [[ "$(grep -l '"what":' "$d"/*.json | xargs grep -l '"test":"integration_test/users_test.dart"' | wc -l)" -eq 2 ]]; }
    GATE='dart format --output=none --set-exit-if-changed lib test integration_test && flutter analyze --fatal-infos && flutter test'
    if want dev; then
      devcopy flutter fastapi
      step "dev: compose up (the backend's compose included: PostgreSQL, FastAPI)" up
      step "dev: the API answers GET /v1/users, for the app on a simulator" waitfor "http://$(hostport api 8080)/v1/users" items
      step "dev: the gate inside the dev container (dart format, flutter analyze, flutter test with goldens)" "${DC[@]}" run --rm -T mobile sh -c "$GATE"
      step "dev: integration tests in the integration container (Linux build under Xvfb), against the running API, with FORGE_SHOTS" "${DC[@]}" --profile e2e run --rm -T integration xvfb-run -a flutter test integration_test -d linux --dart-define=API_URL=http://api:8080 --dart-define=FORGE_SHOTS=1
      step "dev: each flow left its picture and record in build/forge-shots" shots "$work/flutter/build/forge-shots"
    fi
    want checks || exit $((fails > 0))
    FL=(docker run --rm --init --label "forge-stack=$net" --network "$net" -v "$here/flutter:/app" -v /app/.dart_tool -v "$here/contract/users.yaml:/contract/openapi.yaml:ro")
    IMG=forge-stack-flutter:test
    step "dev image builds (Flutter 3.47.7 from its tag, the Linux toolchain, Xvfb)" docker build -q -t "$IMG" --target dev "$here/flutter"
    step "gate (dart format, flutter analyze --fatal-infos, flutter test: widget tests and goldens)" "${FL[@]}" "$IMG" sh -c "$GATE"
    step "the API client is generated from the contract (swagger_parser, freezed, retrofit)" "${FL[@]}" "$IMG" sh -c 'cp -r /app /tmp/gen && cd /tmp/gen && rm -rf lib/api && dart run swagger_parser >/dev/null && dart run build_runner build -d >/dev/null && dart format lib/api >/dev/null && diff -ru /app/lib/api lib/api'
    # The real API for the integration tests: the FastAPI sample on PostgreSQL, migrated.
    step "API: FastAPI sample image on PostgreSQL 17" sh -c "docker build -q -t forge-stack-fastapi:test '$here/fastapi' >/dev/null"
    step "PostgreSQL 17 container" db postgres:17-alpine 'pg_isready -U postgres && psql -U postgres -d app -c "select 1"' -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=app
    step "API migrated and started" sh -c "docker run --rm --network '$net' -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/app forge-stack-fastapi:test alembic upgrade head && docker run -d --label forge-stack=$net --network '$net' --network-alias api -e DATABASE_URL=postgresql+asyncpg://postgres:postgres@db:5432/app forge-stack-fastapi:test >/dev/null"
    step "integration tests (Linux build under Xvfb, phone-sized) against the real API" "${FL[@]}" "$IMG" xvfb-run -a flutter test integration_test -d linux --dart-define=API_URL=http://api:8080
    ;;
  monorepo)
    # One repository holding both services (skill dev-environment): backend/ is the FastAPI sample, frontend/ the
    # React sample whose compose.yaml includes ../backend/compose.yaml. The per-file checks run in each service's
    # folder through the edit hook (rules with "dir"), and the gate runs both services' gates from the root.
    work="$(mktemp -d "${TMPDIR:-/tmp}/forge-dev-$stack.XXXXXX")"
    for pair in fastapi:backend react:frontend; do
      rsync -a --exclude node_modules --exclude .venv --exclude dist --exclude '.*_cache' --exclude test-results --exclude playwright-report "$here/${pair%%:*}/" "$work/repo/${pair##*:}/"
    done
    sed -i '' 's#path: ../fastapi/compose.yaml#path: ../backend/compose.yaml#' "$work/repo/frontend/compose.yaml"
    git -C "$work/repo" init -q -b dev && git -C "$work/repo" add -A && git -C "$work/repo" -c user.email=t@e -c user.name=t commit -q -m "chore: both services"
    mkdir -p "$work/repo/.forge/project" && printf '.forge/\n' >> "$work/repo/.git/info/exclude"
    G="docker compose run --rm -T --no-deps"
    cat >"$work/repo/.forge/project/project.json" <<JSON
{ "policy": {
  "edits": { "format": [{ "glob": "backend/**/*.py", "dir": "backend", "command": "$G api uv run --frozen ruff format {file}" }],
             "lint": [{ "glob": "frontend/src/**/*.{ts,tsx}", "dir": "frontend", "command": "$G web npx oxlint {file}" }] },
  "gates": { "full": "cd backend && $G api sh -c 'uv run --frozen ruff check . && uv run --frozen pytest -q' && cd ../frontend && $G web sh -c 'npm run typecheck && npm run lint && npm test'" } } }
JSON
    DC=(env API_PORT=0 DB_PORT=0 WEB_PORT=0 docker compose -p "forge-dev-$stack-$$" --project-directory "$work/repo/frontend" -f "$work/repo/frontend/compose.yaml")
    export COMPOSE_PROJECT_NAME="forge-dev-$stack-$$" API_PORT=0 DB_PORT=0 WEB_PORT=0
    hookrun() { printf '{"hook_event_name":"PostToolUse","tool_name":"Write","cwd":"%s","tool_input":{"file_path":"%s"}}' "$work/repo" "$work/repo/$1" | node "$here/../../core/policy/bin/forge-hook.mjs" post-tool-use; }
    format_backend() { local out; out="$(hookrun backend/app/main.py 2>&1)"; [[ -z "$out" ]] || { echo "hook: $out"; return 1; }
      tail -1 "$work/repo/backend/app/main.py" | grep -qx 'x = 1' || { echo "not formatted:"; tail -2 "$work/repo/backend/app/main.py"; return 1; }; }
    lint_frontend() { local out; out="$(hookrun frontend/src/probe.tsx 2>&1)"; grep -q '\[lint\] docker compose run --rm -T --no-deps web npx oxlint' <<<"$out" && grep -q 'rules-of-hooks' <<<"$out" && grep -q -- '-\[src/probe.tsx:3' <<<"$out" || { echo "hook: ${out:-no output}"; return 1; }; }
    gate_all() { (cd "$work/repo" && sh -c "$(node -e 'console.log(require(process.argv[1]).policy.gates.full)' "$work/repo/.forge/project/project.json")"); }
    printf 'x   =   1\n' >>"$work/repo/backend/app/main.py"
    step "edit hook: ruff format runs in backend/ on the edited file (dir, {file} relative to it)" format_backend
    # A hook called conditionally: the sample's oxlint config makes react/rules-of-hooks an error.
    printf "import { useState } from 'react';\nexport function Probe({ on }: { on: boolean }) {\n  if (on) useState(0);\n  return null;\n}\n" >"$work/repo/frontend/src/probe.tsx"
    step "edit hook: oxlint runs in frontend/ and hands its finding back" lint_frontend
    rm "$work/repo/frontend/src/probe.tsx"; git -C "$work/repo" checkout -q -- backend/app/main.py
    step "the gate runs both services' gates from the root" gate_all
    step "one compose up from frontend/ runs the database, the API and the web app" "${DC[@]}" up -d --build --wait --wait-timeout 600
    ;;
  *) echo "unknown stack $stack" >&2; exit 2 ;;
esac
exit $((fails > 0))
