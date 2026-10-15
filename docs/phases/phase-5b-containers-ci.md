# Phase 5b: local containers, CI, the dev/staging/main branches

Branch `phase-5b/containers-cicd` (local only). 2026-10-08.

Decisions asked this phase (audit section 9):
- 70: this release is **local containers only**. Staging comes next release, and there is no production yet. Decisions 59 and 61–65 (server deploy, HTTPS, server secrets, the production database and backups, the error tracker, rollback) move to that release.
- 71: **everything in Compose with hot reload**.
- 72: **tests and gates run inside the dev containers**, for developers and agents.
- 73: **CI runs the gate in the dev image, builds the production image on every MR/PR, and pushes it from `dev`**, tagged with the commit.
- 74: branches **`dev`, `staging`, `main`** in every project. This replaces decision 21's trunk.
- 75: **the lead agent merges finished tickets into `dev`** (`forge merge`); promotions stay a person's.

## Built
- **Dev containers for every stack sample.** Each sample gets a `dev` Dockerfile target and a `compose.yaml`:
  - the database with a health check and a named volume;
  - the service from the dev target, with the source mounted and its own dependency folders;
  - the Docker socket for Testcontainers;
  - migrations at start, the framework's watcher, and a health check (every second while starting, then every 30 s).

  For .NET, `dotnet watch` uses the polling watcher (the documented setting for mounted folders) and no launch profile. Both were set from the documentation up front, not after a failure.

  React's compose file includes the backend's, so one `up` runs the database, the API and Vite with hot reload on both sides. An `e2e` service runs Playwright on the production build against that API. `tests/stacks/run.sh <stack> dev` runs it on a copy of the sample: up, an answer, a saved change served by the running container, and the gate inside.
- **CI templates** (`core/ci/{gitlab,github}`):
  - `secret-scan`;
  - `gates`: builds the dev target and runs `GATE_COMMAND` in it, with Testcontainers through the socket;
  - `build-image`: the production image on every MR/PR, pushed from `dev` as `<registry>/<project>/<IMAGE_NAME>:<commit>`.

  GitLab uses `docker:dind` over TLS. `tests/ci/run.sh` runs the templates without a host:
  - lint (GitLab's CI schema through check-jsonschema, and actionlint);
  - the GitHub steps under bash -e, and the GitLab jobs in a `docker:cli` container, both on a Docker-in-Docker machine with a local registry.
- **Branches and merging:**
  - `branches.base` (`dev`) and `branches.promote` (`staging`, `main`), all protected.
  - `forge init` creates `dev` and `staging` from `main` and never pushes them. `forge doctor` reports what origin lacks.
  - **`forge merge <ticket>`**, the lead only, merges only when:
    - the gates passed on the branch head;
    - the tests rule holds;
    - every review report (code, security and spec; db, infra, UI and QA when present) has `Verdict:` APPROVE or PASS and a `Commit:` equal to the head, or an earlier commit followed only by test changes;
    - the contract is untouched;
    - one ready MR/PR into `dev` exists at that commit.

    It passes the commit to the host (`glab mr merge --sha`, `gh pr merge --match-head-commit`). Raw merge commands stay refused.
  - The server guides now cover: `dev` as the default branch, mergeable by developers; `staging` and `main` by maintainers with approvals; the Free-tier approval check only on promotions.
- **Roles:** `devops-engineer` (a plan's infra items, local containers only, verified by running them) and `infra-reviewer` (Dockerfiles, compose, CI, configuration; report `infra.md`). The pipeline orders lanes db → api → ui → infra.
- **Skills:** `dev-environment`, `dockerize`, `env-config`, `ci-pipeline`, `pipeline-debug`. The stack guides' `project.json` now runs the gate, the per-file checks and the migrations through `docker compose run`. Their `examples/` hold the new Dockerfile and `compose.yaml`, covered by the drift test.
- **Policy:**
  - commands run in containers are checked like host commands (`docker compose exec|run`, `docker exec|run`, podman, nerdctl, with `-e` values seen by the database and secret rules);
  - changing a container image (`FROM`, compose `image:`) asks;
  - `glab ci get --with-variables` is refused;
  - read-only roles may read CI job details;
  - `forge doctor` reports Docker Compose.

## Found and fixed along the way
- **A policy gap that containers made real.** `docker compose exec api uv add x` changed dependencies without asking, and `docker exec … git push origin main` was invisible to the rules.
- **NestJS hot reload failed on every save** with `EADDRINUSE`. `nest start --watch` stops the old server with `ps`, which `node:24-bookworm-slim` lacks. The dev target uses the full image.
- **`up --wait` returned before the API listened.** The result was a 502 through Vite's proxy, and an "empty reply" from Vite itself. Fixed with health checks on the API and web services, and `depends_on: service_healthy`.
- **Compose recreated the database** when one call used different port values. Every call now gets the same port settings.
- **GitLab rejects a job named `image`**, a reserved top-level keyword (found by the schema). The job is `build-image` on both hosts.
- **Test-only findings in the CI emulation:**
  - macOS bash 3.2 has no `${VAR,,}`, so the template uses `tr`;
  - Docker Desktop's daemon cannot reach a registry on the Mac's loopback, so the GitHub emulation also runs on a Docker-in-Docker machine;
  - nested builds fell back to a public DNS server that failed intermittently, so the emulated machine uses Docker Desktop's resolver.
- **A first GitLab React run failed in `gates` for a network reason.** The 2 GB Playwright download into the empty nested engine stalled for 33 minutes. The template wasn't at fault: the same jobs passed once the base images were loaded from this machine first (`FORGE_CI_SEED=1`, opt-in; the jobs themselves run unchanged).
- **Cleanup:** `docker rm -f` leaves a container's anonymous volumes behind, and dind keeps gigabytes there. Both runners now use `-v`. I removed the seven volumes my runs had left, after checking their contents. Older unlabelled volumes from 7 and 8 October were left alone.

## Tested
| What | Result |
|---|---|
| `npm test` on macOS | 415/415, 6 opt-in skipped |
| `run.sh <stack> dev` | fastapi 4/4, nestjs 4/4, dotnet 4/4, mongodb 3/3, react 5/5 |
| `tests/ci/run.sh lint` | 2/2 |
| `tests/ci/run.sh github\|gitlab <stack>` | FastAPI: GitHub push 8/8, PR 7/7; GitLab push 6/6, MR 6/6. NestJS, MongoDB and .NET: GitHub push 8/8 and GitLab push 6/6 each. React: GitHub push 9/9, GitLab push 7/7, with the base images loaded from this machine (`FORGE_CI_SEED=1`). |
| Live `merge` | 3/3, $0.01 |
| Live `devenv` | 3/3, $0.01: the session ran the tests through the dev container and they passed; nothing ran on the host toolchain |

## Proposals (accepted 2026-10-08, decision 88)
- **The merge method is the host's default (a merge commit).** Feature branches are not deleted after the merge.
- **After the merge into `dev`, the ticket stays "In Testing"** with the merge SHA in a comment. A person moves it to Done after testing on `dev`.
- **In separate repositories, the frontend's compose file includes the backend's from a checkout next to it.** The alternative is the image CI pushes from `dev`.
- **Per-file edit checks run with `docker compose run --rm --no-deps`**, about 1–2 s per edit, so they work whether or not the stack is up. In a single repository with two services, they were first left to the gate; since phase 6 each rule names its folder (`dir`).

## Open
- Staging and production (next release): CD over SSH, the server baseline, HTTPS with Caddy, secrets on the server, the production database and its backups, the error tracker, rollback.
- No real GitLab or GitHub pipeline has run yet. That needs the GitLab group, and the server settings come with it.
- From earlier: the `fullstack` rerun with `policy.tests` (the project setup now pushes `dev`), the stage 7 live run, and the multi-ticket `/pipeline` trial.
