# Phase 4b: stack guides, verified samples, test and delivery skills

Branch `phase-4b/stack-references` (local only; nothing pushed). Started 2026-10-07 after phase 4a was merged into `main`.

Decisions taken for this phase (audit section 9):
- 34: .NET 10 instead of .NET 8, whose support ends 2026-11-10.
- 35: .NET uses minimal APIs, EF Core and xUnit.
- 36: NestJS on TypeORM, with the query style per project. Corrected to Vitest, oxlint and Prettier on Node 24, the Nest 12 defaults.
- 37: FastAPI with SQLAlchemy 2, Alembic and uv.
- 38: MongoDB with the official drivers and migrate-mongo.
- 39: Vitest and Playwright for the frontend.
- 40: estimates in hours, as a range.
- 41: the API style details are accepted.

## Built

- **Corrections from the brief.**
  - Every skill now ends with a definition of done.
  - `security-reviewer` and `spec-checker` review every PR/MR; 4a had routed them only by area. The security review runs on opus for gated or sensitive changes, sonnet otherwise.
  - `backend-change` and `bootstrap` follow contract first.
- **Samples that really run** (`tests/stacks/`), all implementing one contract in the team style (`tests/stacks/contract/users.yaml`):

  | Sample | Stack | Database |
  |---|---|---|
  | `fastapi` | Python 3.13, uv, FastAPI, async SQLAlchemy 2, Alembic, pytest + httpx | PostgreSQL 17 |
  | `dotnet` | .NET 10, minimal APIs, EF Core 10, xUnit + WebApplicationFactory | SQL Server 2022 |
  | `nestjs` | Node 24, NestJS 12, TypeORM 1.1 (entities, plus raw SQL for the list), Vitest + Supertest | MySQL 8.4 |
  | `mongodb` | Node driver 7, migrate-mongo 14, Vitest | MongoDB 8.0 |
  | `react` | React 19, Vite 8, Vitest + Testing Library, Playwright 1.63 | none |

  Every backend runs its API tests against a real database through Testcontainers.
- **`tests/stacks/run.sh <stack>`** checks a sample the way its guide says: the gate command, the migrations up, down and up on a fresh database container, the production image build, and the image starting on the migrated database and answering `GET /v1/users`. `stacks.test.mjs` runs all of them (opt-in, `FORGE_TEST_STACKS=1`).
- **Guides.**
  - `stack-dotnet`, `stack-nestjs`, `stack-fastapi`: layout, patterns (problem details with field errors, unknown fields refused, duplicate key → 409, cursor pages, 201 + Location, raw SQL with bound parameters), migration commands, tests, a `project.json` snippet, the Dockerfile.
  - `db-postgresql`, `db-sqlserver`, `db-mysql`, `db-mongodb`: containers, connections, types, constraints, safe migrations on a live database, error codes.
  - Each guide says what was tested and marks the rest "not run". Their `examples/` are copies of the sample files, and a test fails when a copy drifts.
- **Skills:** `spec-writer` (a thin ticket becomes an approved spec with numbered acceptance criteria), `estimate`, `write-unit-tests`, `write-e2e`, `fix-failing-test`, `commit-pr` (with a PR/MR template). `/ticket` and `/pipeline` use the spec and the estimate; `forge init` creates `specs/` and `contracts/`.

## Tested

| What | Result |
|---|---|
| `npm test` on macOS | 365/365, 6 opt-in tests skipped (5 stack runs, the real-tools API check) |
| `npm test` on Linux, in the CI image | 363/363, 8 skipped (also the real `glab` and `gh` checks) |
| `run.sh fastapi` | gate (ruff, mypy --strict, 7 API tests, deprecation warnings as errors) · Alembic up/down/up · image builds · image answers |
| `run.sh dotnet` | gate (format, build -warnaserror, 10 tests incl. raw SQL parameter binding; per-file `dotnet format --include`) · EF update / update 0 / update, idempotent script, migration bundle · image builds · image answers |
| `run.sh nestjs` | gate (build, oxlint incl. per file, Prettier, unit and 7 API tests) · TypeORM run/revert/run from the build · image builds · image answers |
| `run.sh mongodb` | type check and 4 tests (migrations up/down/up, validator, repository) · migrate-mongo up/down/up |
| `run.sh react` | type check, oxlint, 2 component tests · Playwright in Chromium, Firefox and WebKit on the production build |
| Scratch check | Alembic `CREATE INDEX CONCURRENTLY` in `autocommit_block`, up/down/up on PostgreSQL |
| Platform check | SQL Server 2022 (amd64 only) runs under emulation on Apple Silicon |
| CLI flags | `gh pr create --draft --title --body-file`, `gh pr ready`, `glab mr create --draft --title --description`, `glab mr update --ready` (now in the real-CLI tests) |
| Live harness (Haiku) | new `stackguide` 2/2: a FastAPI project's session loads `stack-fastapi` and answers from it. About $0.04 |

## Learned about the platform

- **.NET 10:** `dotnet new sln` writes `.slnx`, and `dotnet new tool-manifest` writes `dotnet-tools.json` at the root.
- **ASP.NET Core:** its validation response has a different `errors` shape, and malformed JSON returns an empty 400 unless `ThrowOnBadRequest` is set and an `IExceptionHandler` answers.
- **SQL Server:** the image is amd64-only. Logins fail for a few seconds after "ready", so wait for a query that succeeds.
- **NestJS 12:** generates ESM with Vitest, oxlint and Prettier, and `nest build` writes `dist/main.js` (no `src` level).
  - npm 10.9 (Node 22) cannot install it (`edgesOut` error); npm 11 (Node 24) can.
  - npm 11 holds back install scripts until they are approved.
- **FastAPI:** answers validation errors with 422 by default; the guide replaces it with 400 and field errors.
- **Python Testcontainers:** the Postgres module moved to `testcontainers.community.postgres`.
- **Vitest without globals:** Testing Library's cleanup must be registered in the setup file.

## Proposals to confirm

- **Default versions in the guides:** Python 3.13, Node 24 LTS (26 becomes LTS on 2026-10-28), PostgreSQL 17, MySQL 8.4, MongoDB 8.0, SQL Server 2022. A project can choose others at its stack stage.
- **My reading of `spec-writer`** (the brief only names it): a thin ticket becomes a feature spec the owner approves before planning, in `.forge/project/specs/`.
- **The PR/MR template:** Ticket, What changed, How to test, Contract and migrations, Screenshots, Risks.

## Open

- **No agent-built full-stack ticket yet.** An agent implementing an endpoint end to end on a sample has not run. The guides were checked by running the samples, and the live check covers loading the guide. It needs a sample client whose gate command runs in Docker, because this machine has no uv or .NET SDK, only Docker.
- **Combinations not run** (D17 asks each database once, which is done): MariaDB; the C# and Python MongoDB drivers; FastAPI on MySQL or SQL Server; .NET on PostgreSQL or MySQL; NestJS on PostgreSQL or SQL Server.
- **Phase 5:** the frontend guide (client generator, data layer, RTL), Docker-only deployment, architecture and design skills.
