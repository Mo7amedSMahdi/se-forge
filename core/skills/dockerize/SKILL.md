---
name: dockerize
description: Writing or changing a service's Dockerfile and .dockerignore the team's way - one Dockerfile with a `dev` target (toolchain, dependencies and source, for Compose and CI) and a production image as the last stage (small, non-root, no secrets). Use when a service gets its first Dockerfile, when its toolchain or base image changes, or when the image build fails.
---

# Dockerfiles

Decisions 72 and 73. Each stack guide's `examples/Dockerfile` is a verified copy (`tests/stacks/run.sh`,
`tests/ci/run.sh`); start from it rather than from memory.

## Shape
1. **`dev` stage first** (`FROM <toolchain image> AS dev`): copy the dependency manifests and lock file, install (`npm ci`, `uv sync --frozen --no-install-project`, `dotnet tool restore && dotnet restore`), then `COPY . .`, and the watcher as `CMD`. Compose mounts the source over it; CI runs the gate in it as built. It may run as root (development only).
2. **Build stage(s)**: the same install with production dependencies only, the build or publish.
3. **Production stage last**, so `docker build .` (no `--target`) gives it: a runtime-only base (`python:3.13-slim-bookworm`, `node:24-bookworm-slim`, `mcr.microsoft.com/dotnet/aspnet:10.0`, `caddy:2-alpine`), copies from the build stage only, a non-root `USER`, `EXPOSE 8080`, an exec-form `CMD`/`ENTRYPOINT`. Migrations are not run here; they are their own step.

## Rules
- Base images by explicit tag (`node:24-bookworm`, `postgres:17-alpine`, `playwright:v1.63.0-noble`), never `latest`. Updating one is a dependency change: it asks a person.
- Order for the layer cache: manifests and lock file, install, then the source.
- `.dockerignore`: `.git`, `.env` and `.env.*`, host dependency and build folders (`node_modules`, `.venv`, `bin`, `obj`, `dist`), tool caches. Not the tests: the dev target needs them; the production stage copies only what it runs.
- No secrets in any layer: no `ARG`/`ENV` with credentials, no `.env` copied, no private registry tokens in `RUN`. Runtime configuration comes from the environment (skill `env-config`).
- The dev target uses a full toolchain image when a watcher needs system tools (NestJS's watch needs `ps`; `node:24-bookworm`, not `-slim`). A frontend's dev target is the Playwright image, so end-to-end tests run in it.
- **A mobile app has no production image** (`stack-flutter/examples/Dockerfile`): the app ships to the stores, not as a container. Its `dev` target runs the gate and the integration tests; its `android` target, built for `linux/amd64`, builds the app bundle in CI. Steps 2 and 4 become: build the dev image and run the integration tests in it against the API (decision 111).

## Steps
1. Copy the stack guide's `examples/Dockerfile` and adapt names and paths; add or update `.dockerignore`.
2. Build both targets: `docker build --target dev -t <name>:dev .` and `docker build -t <name>:local .`.
3. Run the gate in the dev image as CI does: `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock --add-host host.docker.internal:host-gateway -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal <name>:dev sh -c '<gate>'`.
4. Start the production image against a migrated database and call one endpoint (as `tests/stacks/run.sh` does); check `docker run --rm <name>:local id -u` is not 0.
5. Bring the dev setup up (skill `dev-environment`).

## Done when
- `docker build --target dev .` and `docker build .` both succeed from a clean checkout;
- the gate passes in the dev image (step 3), and the production image answers a request as a non-root user;
- `.dockerignore` keeps `.env*`, `.git` and host build folders out; no secret is in any layer.
