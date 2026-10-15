#!/bin/sh
# Runs a command in the project's toolchain container (uv, Python 3.13), with Docker access for
# Testcontainers. A DATABASE_URL on localhost or 127.0.0.1 is pointed at the host from the container.
# Usage: sh scripts/dev.sh <command> [args...]
set -eu
url="$(printf '%s' "${DATABASE_URL:-}" | sed 's#@localhost:#@host.docker.internal:#; s#@127\.0\.0\.1:#@host.docker.internal:#')"
exec docker run --rm -i -v "$PWD:/work" -w /work -v /var/run/docker.sock:/var/run/docker.sock \
  -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal ${url:+-e DATABASE_URL=$url} \
  -v forge-uv-cache:/root/.cache/uv ghcr.io/astral-sh/uv:python3.13-bookworm-slim "$@"
