#!/usr/bin/env bash
# Runs the kit's CI templates (core/ci/*/checks*) the way the hosts do, without a host (decision 73):
#   lint                       actionlint (GitHub) and GitLab's CI schema (check-jsonschema) on the templates
#   github <stack> <push|pr>   the workflow's own `run:` steps under bash -e on a Linux machine with Docker,
#                              as a hosted runner runs them (the checkout and the Docker daemon share one
#                              filesystem); GITHUB_* set as GitHub sets them; ghcr.io replaced by a local registry
#   gitlab <stack> <push|mr>   the jobs' own `script:` lines in a docker:cli job container talking to a
#                              privileged docker:dind service over TLS, as GitLab's Docker executor runs them;
#                              the project registry replaced by a local registry
# <stack> is a sample under tests/stacks, copied into a throwaway git repository. push: a push to dev (the
# image is pushed); pr/mr: a merge request (the image is built, not pushed).
# Needs Docker; downloads images (FORGE_CI_SEED=1 loads the base images from this machine instead).
# Usage: tests/ci/run.sh lint | <github|gitlab> <stack> <push|pr|mr>
set -uo pipefail
kit="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
mode="${1:?usage: run.sh lint | <github|gitlab> <stack> <push|pr|mr>}"
stack="${2:-}"
event="${3:-push}"
id="forge-ci-$$"
fails=0
work=""
# -v: dind keeps its engine (gigabytes) in an anonymous volume, which docker rm alone leaves behind.
cleanup() {
  docker ps -aq --filter "label=$id" | xargs -r docker rm -f -v >/dev/null 2>&1
  docker images -q --filter "label=$id" | xargs -r docker rmi -f >/dev/null 2>&1
  docker network rm "$id" >/dev/null 2>&1; docker volume rm "$id-certs" >/dev/null 2>&1
  [[ -n "$work" ]] && rm -rf "$work"
}
trap cleanup EXIT
step() { local name="$1"; shift; local log; log="$(mktemp)"; if "$@" >"$log" 2>&1; then echo "PASS  $mode $stack $event: $name"; else echo "FAIL  $mode $stack $event: $name"; tail -40 "$log" | sed 's/^/      /'; fails=$((fails + 1)); fi; rm -f "$log"; }
# Fails: the step is expected to fail (a broken Dockerfile must fail the image job).
fails_as_expected() { if "$@"; then echo "it passed"; return 1; fi; return 0; }
yq() { docker run --rm -i mikefarah/yq:4 "$@"; }

# The gate each sample's guide gives (as in tests/stacks/run.sh, dev part).
gate_for() {
  case "$1" in
    fastapi) echo 'uv run --frozen ruff format --check . && uv run --frozen ruff check . && uv run --frozen mypy app && uv run --frozen pytest -q -W error::DeprecationWarning' ;;
    nestjs) echo 'npm run build && npm run lint && npx prettier --check "src/**/*.ts" "test/**/*.ts" && npm test && npm run test:e2e' ;;
    dotnet) echo 'dotnet format --verify-no-changes && dotnet build -warnaserror && dotnet test' ;;
    mongodb) echo 'npm run typecheck && npm test' ;;
    react) echo 'npm run typecheck && npm run lint && npm test' ;;
    *) echo "unknown stack $1" >&2; exit 2 ;;
  esac
}

# The sample as a client repository: its own git history (gitleaks reads it), one commit on dev.
repo() {
  work="$(mktemp -d "${TMPDIR:-/tmp}/forge-ci.XXXXXX")"
  rsync -a --exclude node_modules --exclude .venv --exclude dist --exclude bin --exclude obj --exclude '.*_cache' --exclude coverage \
    --exclude test-results --exclude playwright-report "$kit/tests/stacks/$stack/" "$work/repo/"
  git -C "$work/repo" init -q -b dev && git -C "$work/repo" add -A && git -C "$work/repo" -c user.email=ci@example.com -c user.name=ci commit -q -m "feat: sample"
  sha="$(git -C "$work/repo" rev-parse HEAD)"
}

if [[ "$mode" == lint ]]; then
  stack=templates event=-
  step "actionlint: core/ci/github/*.yml" docker run --rm -v "$kit/core/ci/github:/w:ro" rhysd/actionlint:1.7.8 -no-color $(cd "$kit/core/ci/github" && printf '/w/%s ' *.yml)
  step "GitLab CI schema: core/ci/gitlab/*.gitlab-ci.yml" docker run --rm -v "$kit/core/ci/gitlab:/ci:ro" ghcr.io/astral-sh/uv:python3.13-bookworm-slim \
    sh -c 'uvx -q check-jsonschema@0.38.2 --builtin-schema vendor.gitlab-ci /ci/*.gitlab-ci.yml'
  exit $((fails > 0))
fi

[[ -n "$stack" ]] || { echo "which stack?" >&2; exit 2; }
GATE="$(gate_for "$stack")"
repo
ci_gitlab="$kit/core/ci/gitlab/checks.gitlab-ci.yml"
dind="$(yq '.".docker".services[0]' <"$ci_gitlab")"
cli="$(yq '.".docker".image' <"$ci_gitlab")"
docker network create --label "$id" "$id" >/dev/null
docker volume create --label "$id" "$id-certs" >/dev/null
docker run -d --label "$id" --network "$id" --network-alias registry registry:3 >/dev/null
# The Docker machine: a privileged dind named "docker", TLS certificates in a volume the jobs share
# (/certs/client), trusting the local registry over plain HTTP. For GitHub it also holds the workspace at
# the path the job sees, as a runner VM does; GitLab's service never sees the job's clone.
# Its containers and builds resolve names through the DNS server this Docker gives containers (dind's own
# resolver, 127.0.0.11, is not reachable from them; the public fallback fails intermittently here).
machine_mounts=(); [[ "$mode" == github ]] && machine_mounts=(-v "$work:/home/runner/work")
dns="$(docker run --rm alpine:3.20 sed -n 's/^nameserver //p' /etc/resolv.conf | head -1)"
docker run -d --label "$id" --privileged --network "$id" --network-alias docker -e DOCKER_TLS_CERTDIR=/certs \
  -v "$id-certs:/certs/client" ${machine_mounts[@]+"${machine_mounts[@]}"} "$dind" --insecure-registry=registry:5000 ${dns:+--dns "$dns"} >/dev/null
ready() { for _ in $(seq 1 60); do docker run --rm --network "$id" -v "$id-certs:/certs/client:ro" -e DOCKER_TLS_CERTDIR=/certs "$cli" docker info >/dev/null 2>&1 && return 0; sleep 2; done; return 1; }
step "Docker-in-Docker up over TLS ($dind)" ready
# FORGE_CI_SEED=1: load the Dockerfile's base images from this machine into the Docker-in-Docker engine
# first. The jobs run unchanged; only the download is skipped (a slow network stalls multi-gigabyte pulls).
seed() { local engine img stages
  engine="$(docker ps -q --filter "label=$id" --filter "ancestor=$dind" | head -1)"
  stages="$(sed -n 's/^FROM .* [Aa][Ss] \([^ ]*\).*/\1/p' "$work/repo/Dockerfile")"
  for img in $(sed -n 's/^FROM \(--platform=[^ ]* \)\{0,1\}\([^ ]*\).*/\2/p' "$work/repo/Dockerfile" | sort -u); do
    grep -qx "$img" <<<"$stages" && continue
    docker image inspect "$img" >/dev/null 2>&1 || docker pull -q "$img" >/dev/null || return 1
    docker save "$img" | docker exec -i "$engine" docker load -q >/dev/null || return 1
  done; }
[[ "${FORGE_CI_SEED:-0}" == 1 ]] && step "base images loaded from this machine (FORGE_CI_SEED=1)" seed
pushed() { docker run --rm --network "$id" curlimages/curl:8.11.1 -sS "http://registry:5000/v2/$1/tags/list" | grep -q "$sha"; }
not_pushed() { ! pushed "$1"; }

if [[ "$mode" == github ]]; then
  wf="$kit/core/ci/github/checks.yml"
  run_of() { yq ".jobs.$1.steps[] | select(.name == \"$2\") | .run" <"$wf"; }
  printf 'FROM %s\nRUN apk add --no-cache bash\n' "$cli" | docker build -q --label "$id" -t "$id-runner" - >/dev/null
  : >"$work/github_env"
  if [[ "$event" == push ]]; then ev=push; else ev=pull_request; fi
  # A step as GitHub runs it: bash -e in the checkout, the workflow's env, GITHUB_* as GitHub sets them, and
  # what earlier steps wrote to GITHUB_ENV.
  ghstep() { local script; script="$(run_of "$1" "$2")"
    docker run --rm --label "$id" --network "$id" -v "$id-certs:/certs/client:ro" -v "$work:/home/runner/work" -w /home/runner/work/repo \
      -e DOCKER_TLS_CERTDIR=/certs -e CONTEXT=. -e IMAGE_NAME=app -e REGISTRY=registry:5000 -e PUSH_BRANCH="$(yq '.env.PUSH_BRANCH' <"$wf")" -e GATE_COMMAND="$GATE" \
      -e GITHUB_REPOSITORY=Acme/Users-Portal -e GITHUB_SHA="$sha" -e GITHUB_ACTOR=ci -e GITHUB_EVENT_NAME="$ev" -e GITHUB_REF_NAME=dev \
      -e GITHUB_ENV=/home/runner/work/github_env -e TOKEN=unused -e STEP="$script" \
      "$id-runner" bash -c 'set -a; . "$GITHUB_ENV"; set +a; exec bash -e -c "$STEP"'; }
  step "secret-scan: gitleaks over the history" ghstep secret-scan "Scan the history for secrets"
  step "gates: build the dev image" ghstep gates "Build the dev image"
  step "gates: the gate in the dev image (Testcontainers through the runner's socket)" ghstep gates "Gates in the dev image"
  step "build-image: build the production image" ghstep build-image "Build the production image"
  cond="$(yq '.jobs.build-image.steps[] | select(.name == "Push it (the base branch only)") | .if' <"$wf")"
  [[ "$cond" == "github.event_name == 'push' && github.ref_name == env.PUSH_BRANCH" ]] || { echo "FAIL  the push step's condition is now: $cond (update this runner)"; fails=$((fails + 1)); }
  if [[ "$event" == push ]]; then
    step "build-image: push it (a push to dev)" ghstep build-image "Push it (the base branch only)"
    step "the registry has acme/users-portal/app:<commit> (the repository name lowercased)" pushed acme/users-portal/app
  else
    step "build-image: nothing pushed for a pull request (the push step's condition is false)" not_pushed acme/users-portal/app
  fi
  printf '\nRUN false\n' >>"$work/repo/Dockerfile"
  step "build-image: a broken Dockerfile fails the job" fails_as_expected ghstep build-image "Build the production image"
  exit $((fails > 0))
fi

if [[ "$mode" == gitlab ]]; then
  ci="$ci_gitlab"
  if [[ "$event" == push ]]; then source_vars=(-e CI_PIPELINE_SOURCE=push -e CI_COMMIT_BRANCH=dev); else source_vars=(-e CI_PIPELINE_SOURCE=merge_request_event -e CI_MERGE_REQUEST_TARGET_BRANCH_NAME=dev); fi
  # A job, as the runner runs it: the job image with the clone in /builds, the job's variables, its script
  # lines in order under `set -e`.
  job() { local name="$1" image="${2:-$cli}" script ep=()
    [[ "${3:-}" == clear ]] && ep=(--entrypoint '')
    script="$(yq ".\"$name\".script[]" <"$ci")"
    docker run --rm --label "$id" --network "$id" -v "$id-certs:/certs/client:ro" -v "$work/repo:/builds/acme/users" -w /builds/acme/users \
      -e DOCKER_TLS_CERTDIR=/certs -e CONTEXT=. -e IMAGE_NAME=app -e PUSH_BRANCH="$(yq '.variables.PUSH_BRANCH' <"$ci")" -e GATE_COMMAND="$GATE" \
      -e CI_COMMIT_SHA="$sha" -e CI_REGISTRY=registry:5000 -e CI_REGISTRY_IMAGE=registry:5000/acme/users -e CI_REGISTRY_USER=gitlab-ci-token -e CI_REGISTRY_PASSWORD=unused \
      "${source_vars[@]}" ${ep[@]+"${ep[@]}"} "$image" sh -c "set -e
$script"; }
  step "secret-scan: gitleaks over the history" job secret-scan "$(yq '."secret-scan".image.name' <"$ci")" clear
  step "gates: the dev image built in DinD, the gate in it (Testcontainers through the service's socket)" job gates
  step "build-image: the production image built$([[ "$event" == push ]] && echo ' and pushed (a push to dev)')" job build-image
  if [[ "$event" == push ]]; then
    step "the registry has acme/users/app:<commit>" pushed acme/users/app
  else
    step "build-image: nothing pushed for a merge request" not_pushed acme/users/app
  fi
  printf '\nRUN false\n' >>"$work/repo/Dockerfile"
  step "build-image: a broken Dockerfile fails the job" fails_as_expected job build-image
  exit $((fails > 0))
fi
echo "unknown mode $mode" >&2; exit 2
