#!/usr/bin/env bash
# The starter's conformance in the kit (decision 81): `forge new` writes the starter into a fresh repository,
# then: the dev Compose setup comes up and answers /health; the gate passes inside the dev container; a new
# migration runs up, down and up; the production image builds, starts and answers /health; the generated CI
# file passes lint (GitLab's CI schema or actionlint). Frontend: the web app is served, its gate and the
# Playwright tests pass in the dev containers, and its image serves the app. Mobile (decision 101): the gate
# and the integration tests (Linux build under Xvfb, against the running API) pass in the dev containers, and
# the gate passes in the dev image as built, as CI runs it. Several folders: they share one Compose project (one
# API, one database), named by the starter; with a web app and a mobile app, forge api generate's command writes
# both clients from a contract.
# Needs Docker; downloads images and packages.
# Usage: tests/starter/run.sh <backend-db | react | flutter | fullstack | mobile-fullstack | all-three> [gitlab|github]
#   backend-db: fastapi-postgresql, nestjs-mysql, dotnet-sqlserver, nestjs-mongodb (core/starter)
#   fullstack:  fastapi-postgresql and react in one repository (backend/, frontend/)
#   mobile-fullstack: fastapi-postgresql and flutter in one repository (backend/, mobile/)
#   all-three:  fastapi-postgresql, react and flutter in one repository (backend/, frontend/, mobile/)
set -uo pipefail
kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
what="${1:?usage: run.sh <backend-db | react | flutter | fullstack | mobile-fullstack | all-three> [gitlab|github]}"
host="${2:-gitlab}"
id="forge-starter-$$"
fails=0
work="$(mktemp -d "${TMPDIR:-/tmp}/forge-starter.XXXXXX")"
# The repository's folder carries the run's id: the starter names a repository's Compose project after it.
repo="$work/$id"
export API_PORT=0 DB_PORT=0 WEB_PORT=0
cleanup() {
  # The production containers first: one on the Compose network keeps down from removing the network.
  docker ps -aq --filter "label=$id" | xargs -r docker rm -f -v >/dev/null 2>&1
  for d in "$repo" "$repo/frontend" "$repo/backend" "$repo/mobile"; do [[ -f "$d/compose.yaml" ]] && (cd "$d" && docker compose --profile e2e down -v --rmi local --remove-orphans >/dev/null 2>&1); done
  docker images -q --filter "label=$id" | xargs -r docker rmi -f >/dev/null 2>&1
  docker rmi -f "$id-prod-api" "$id-prod-web" >/dev/null 2>&1
  rm -rf "$work"
}
trap cleanup EXIT
step() { local name="$1"; shift; local log; log="$(mktemp)"; if "$@" >"$log" 2>&1; then echo "PASS  starter $what ($host): $name"; else echo "FAIL  starter $what ($host): $name"; tail -40 "$log" | sed 's/^/      /'; fails=$((fails + 1)); fi; rm -f "$log"; }
meta() { node -e 'const m=require(process.argv[1]); const v=process.argv[2].split(".").reduce((o,k)=>o?.[k], m); console.log(typeof v==="object"?JSON.stringify(v):v ?? "")' "$kit/core/starter/$1/starter.json" "$2"; }

case "$what" in
  fullstack) backend=fastapi-postgresql; frontend=react; mobile=""; bdir="$repo/backend"; fdir="$repo/frontend"; mdir="" ;;
  mobile-fullstack) backend=fastapi-postgresql; frontend=""; mobile=flutter; bdir="$repo/backend"; fdir=""; mdir="$repo/mobile" ;;
  all-three) backend=fastapi-postgresql; frontend=react; mobile=flutter; bdir="$repo/backend"; fdir="$repo/frontend"; mdir="$repo/mobile" ;;
  react) backend=""; frontend=react; mobile=""; bdir=""; fdir="$repo"; mdir="" ;;
  flutter) backend=""; frontend=""; mobile=flutter; bdir=""; fdir=""; mdir="$repo" ;;
  *) [[ -f "$kit/core/starter/$what/starter.json" ]] || { echo "no starter $what" >&2; exit 2; }; backend="$what"; frontend=""; mobile=""; bdir="$repo"; fdir=""; mdir="" ;;
esac

mkdir -p "$repo" && git -C "$repo" init -q -b dev
several=$([[ "$bdir" == "$repo" || "$fdir" == "$repo" || "$mdir" == "$repo" ]] && echo "" || echo yes)
# One folder: Compose names the project after the folder, as it would anyway. Several: the starter's name: line.
[[ -n "$several" ]] || export COMPOSE_PROJECT_NAME="$id"
# The settings proposal is written where forge keeps it, outside git (forge sync excludes .forge/ the same way).
mkdir -p "$repo/.forge/project" && echo "/.forge/" >>"$repo/.git/info/exclude"
args=(--title "Conformance" --host "$host")
[[ -n "$backend" ]] && args+=(--backend "$(meta "$backend" backend)" --db "$(meta "$backend" db)")
[[ -n "$frontend" ]] && args+=(--frontend react)
[[ -n "$mobile" ]] && args+=(--mobile flutter --app-id dev.forge.conformance)
if [[ "$what" == react || "$what" == flutter ]]; then
  # An app alone includes the backend's compose file from a checkout next to it (--backend-dir).
  (cd "$work" && mkdir backend && git -C backend init -q -b dev && cd backend && node "$kit/core/cli/forge.mjs" new --backend fastapi --db postgresql --title "Backend" >/dev/null) || exit 2
  args+=(--backend-dir ../backend)
fi
step "forge new writes the starter" sh -c "cd '$repo' && node '$kit/core/cli/forge.mjs' new ${args[*]}"
if [[ -n "$frontend" && -n "$mobile" ]]; then
  # forge api generate's way: the project's command, run in the repository with {spec} replaced by the quoted file.
  node -e 'const p=require(process.argv[1]); console.log(p.project.api.generate.replaceAll("{spec}", `'"'"'${process.argv[2]}'"'"'`))' \
    "$repo/.forge/project/bootstrap/project.starter.json" "$kit/tests/stacks/contract/users.yaml" >"$work/generate.sh"
  step "forge api generate's command writes the web app's and the mobile app's clients" sh -c "cd '$repo' && sh '$work/generate.sh' && grep -q '\"/v1/users\"' frontend/src/api/schema.d.ts && ls mobile/lib/api/*/*.dart"
fi
git -C "$repo" add -A && git -C "$repo" -c user.email=t@e -c user.name=t commit -q -m "chore: starter" >/dev/null

# Health on a published port, polled.
health() { local dir="$1" svc="$2" port="$3" url; url="http://$(cd "$dir" && docker compose port "$svc" "$port" | sed 's/^0\.0\.0\.0/127.0.0.1/')$4"
  for _ in $(seq 1 120); do curl -fsS "$url" 2>/dev/null | grep -q "${5:-.}" && return 0; sleep 1; done; echo "no answer from $url"; (cd "$dir" && docker compose logs --tail 30); return 1; }

if [[ -n "$backend" ]]; then
  svc="$(meta "$backend" service)"
  up_dir="${fdir:-$bdir}"
  step "dev: docker compose up --wait (database, API migrated, watcher)" sh -c "cd '$up_dir' && docker compose up -d --build --wait --wait-timeout 900"
  step "dev: GET /health answers" health "$bdir" "$svc" 8080 /health ok
  step "dev: the gate inside the dev container" sh -c "cd '$bdir' && docker compose run --rm -T --no-deps $svc sh -c '$(meta "$backend" gate)'"
  # The probe goes through a file in the mounted repository: its commands carry quotes of their own.
  meta "$backend" conformance.migration >"$bdir/.forge-probe.sh"
  step "dev: a new migration runs up, down and up" sh -c "cd '$bdir' && docker compose run --rm -T $svc sh .forge-probe.sh"
  envs=(); while IFS= read -r kv; do [[ -n "$kv" ]] && envs+=(-e "$kv"); done < <(node -e 'const e=require(process.argv[1]).conformance.prodEnv; for (const [k,v] of Object.entries(e)) console.log(`${k}=${v}`)' "$kit/core/starter/$backend/starter.json")
  net="$(cd "$bdir" && docker compose ps -q db | xargs docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}')"
  prod() { docker build -q -t "$id-prod-api" "$bdir" >/dev/null && docker run -d --label "$id" --network "$net" --name "$id-api" "${envs[@]}" "$id-prod-api" >/dev/null || return 1
    for _ in $(seq 1 60); do docker run --rm --network "$net" curlimages/curl:8.11.1 -fsS "http://$id-api:8080/health" 2>/dev/null | grep -q ok && return 0; sleep 2; done; docker logs "$id-api" 2>&1 | tail -20; return 1; }
  step "production image builds, starts and answers /health" prod
fi

if [[ -n "$frontend" ]]; then
  [[ -n "$backend" ]] || step "dev: docker compose up --wait (the backend's compose included, Vite)" sh -c "cd '$fdir' && docker compose up -d --build --wait --wait-timeout 900"
  step "dev: the web app is served and /v1 reaches the API through Vite" sh -c "$(declare -f health); health '$fdir' web 5173 / 'id=\"root\"'"
  step "dev: the frontend gate inside the dev container" sh -c "cd '$fdir' && docker compose run --rm -T --no-deps web sh -c '$(meta react gate)'"
  step "dev: Playwright in the e2e container (three browsers, production build, the running API)" sh -c "cd '$fdir' && docker compose --profile e2e run --rm -T e2e"
  webprod() { docker build -q -t "$id-prod-web" "$fdir" >/dev/null && docker run -d --label "$id" -p 127.0.0.1::8080 --name "$id-web" -e API_URL=http://127.0.0.1:9 "$id-prod-web" >/dev/null || return 1
    local url="http://$(docker port "$id-web" 8080 | head -1 | sed 's/^0\.0\.0\.0/127.0.0.1/')/"; for _ in $(seq 1 30); do curl -fsS "$url" 2>/dev/null | grep -q 'id="root"' && return 0; sleep 1; done; docker logs "$id-web" 2>&1 | tail -10; return 1; }
  step "production web image builds and serves the app" webprod
fi

if [[ -n "$mobile" ]]; then
  gate="$(meta flutter gate)"
  [[ -n "$backend" ]] || step "dev: docker compose up --wait (the backend's compose included)" sh -c "cd '$mdir' && docker compose up -d --build --wait --wait-timeout 900"
  step "dev: the mobile gate inside the dev container (dart format, flutter analyze, widget and golden tests)" sh -c "cd '$mdir' && docker compose run --rm -T --no-deps mobile sh -c '$gate'"
  step "dev: the integration tests in their container (Linux build under Xvfb, the running API), with a picture" sh -c "cd '$mdir' && docker compose --profile e2e run --rm -T integration xvfb-run -a flutter test integration_test -d linux --dart-define=API_URL=http://api:8080 --dart-define=FORGE_SHOTS=1 && ls build/forge-shots/*.png && grep -q '\"what\":' build/forge-shots/*.json"
  # CI's gates job: the dev image as built, with nothing mounted.
  cigate() { docker build -q --label "$id" --target dev -t "$id-mobile-dev" "$mdir" >/dev/null && docker run --rm --init --label "$id" -e CI=true "$id-mobile-dev" sh -c "$gate"; }
  step "the gate in the dev image as built, as CI runs it" cigate
  docker rmi -f "$id-mobile-dev" >/dev/null 2>&1
fi

if [[ -n "$several" ]]; then
  # Every container Compose started from this repository is in its one project: one database, one API.
  oneproject() { local rows; rows="$(docker ps -a --format '{{.Label "com.docker.compose.project"}} {{.Label "com.docker.compose.service"}} {{.Label "com.docker.compose.project.working_dir"}}' | grep -F "/$id")"
    echo "$rows"; ! echo "$rows" | awk '{print $1}' | grep -vqx "$id" && [[ "$(echo "$rows" | awk '$2 == "db"' | wc -l)" -eq 1 && "$(echo "$rows" | awk '$2 == "api"' | wc -l)" -eq 1 ]]; }
  step "one Compose project for the repository: one database and one API for every folder" oneproject
fi

if [[ "$host" == github ]]; then
  step "the generated CI file passes actionlint" docker run --rm -v "$repo/.github/workflows:/w:ro" rhysd/actionlint:1.7.8 -no-color /w/checks.yml
else
  step "the generated CI file passes GitLab's CI schema" docker run --rm -v "$repo:/r:ro" ghcr.io/astral-sh/uv:python3.13-bookworm-slim sh -c 'uvx -q check-jsonschema@0.38.2 --builtin-schema vendor.gitlab-ci /r/.gitlab-ci.yml'
fi
exit $((fails > 0))
