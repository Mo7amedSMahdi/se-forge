---
name: stack-nestjs
description: How this team builds a Node backend - NestJS 12 on Node 24, TypeORM with SQL migrations, the query style chosen per project (entities with raw SQL for complex queries, or raw SQL only), Vitest + Supertest + Testcontainers, oxlint and Prettier - including the problem-details shape, cursor pages, the project.json settings and the Dockerfile. Use on any project whose stack is NestJS, when planning, building or reviewing backend work.
---

# NestJS backend

Decisions 36, 41 and 70-73. Checked by running `tests/stacks/run.sh nestjs` (2026-10-07; the dev part 2026-10-08) and `tests/ci/run.sh <gitlab|github> nestjs` in the kit ( Node 24, npm 11, Nest 12, TypeORM 1.1, mysql2, class-validator, Vitest 4, Testcontainers 12, MySQL 8.4). The files in `examples/` are copies of that sample.

## Setup
- `npx @nestjs/cli new <name> --package-manager npm --strict` generates an ESM project (`nodenext`, `.js` import paths), Vitest, oxlint and Prettier. Keep them.
- **Node 24 LTS.** npm 10.9 (bundled with Node 22) fails to install a Nest 12 project (`Cannot read properties of null (reading 'edgesOut')`); npm 11 works.
- npm 11 holds back package install scripts until they are approved (`npm install-scripts ls`); approving one is a dependency change, which asks a person first.
- Add: `@nestjs/typeorm typeorm class-validator class-transformer` and the driver (`pg`, `mysql2`, `mssql`); dev: the `@testcontainers/<database>` module.

## Layout
```
src/main.ts                 NestFactory.create(AppModule); listen on PORT (8080)
src/app.module.ts           TypeOrmModule.forRootAsync({ useFactory: dataSourceOptions }), APP_PIPE, APP_FILTER, feature modules
src/data-source.ts          one DataSource definition for the app and the TypeORM CLI (DATABASE_URL)
src/problems.ts             ProblemError, validationPipe, ProblemFilter (examples/problems.ts)
src/migrations/             <timestamp>-<Name>.ts, SQL in up() and down()
src/<feature>/              <feature>.module.ts, .controller.ts, .service.ts, entity, DTOs, *.spec.ts unit tests
test/*.e2e-spec.ts          API tests on a Testcontainers database
```
`nest build` writes to `dist/` without the `src` level: `dist/main.js`, `dist/data-source.js`.

## Query style (per project, at the stack stage; decision 36)
- **Entities**: TypeORM entities and repositories for everyday CRUD; complex queries as raw SQL through `dataSource.query(sql, params)` (examples/users.service.ts does both).
- **Raw SQL only**: no entities; every query through `dataSource.query` with `?` (MySQL) or `$1` (PostgreSQL) parameters.
Either way: bound parameters only, never string-built SQL; migrations are SQL.

## Patterns (see `examples/`)
- **Controllers** follow the contract: `@Controller('v1/<resource>')`, method names = operationIds, `@HttpCode(201)` and `res.location(...)` on create (`@Res({ passthrough: true })`).
- **Validation**: DTO classes with class-validator; the global `validationPipe` uses `whitelist` and `forbidNonWhitelisted`, and its `exceptionFactory` answers 400 with `errors: [{field, message}]`.
- **Errors**: throw `ProblemError(status, title, detail, errors)`; `ProblemFilter` (`@Catch()`) writes `application/problem+json` and never exposes unknown exceptions.
- **Unique violations**: `QueryFailedError` whose `driverError` is the database's duplicate-key error → 409: MySQL `code === 'ER_DUP_ENTRY'` (tested); PostgreSQL `code === '23505'`; SQL Server `number` 2601 or 2627 (skill `db-*`).
- **Lists**: cursor of the last row's `created_at` and id; `ORDER BY created_at DESC, id DESC LIMIT limit + 1`.
- **Dates**: TypeORM option `timezone: 'Z'` (MySQL); API dates with `toISOString()`.

## Migrations (TypeORM)
The commands below run in the dev container: prefix them with `docker compose run --rm api` (or `docker compose exec -T api` while it is up).
- New: a class in `src/migrations/<unix-ms>-<Name>.ts` with `up`/`down` calling `queryRunner.query(sql)`, listed in `data-source.ts`.
- Run from the build, like production: `npm run build && npx typeorm migration:run -d dist/data-source.js`; back one: `npx typeorm migration:revert -d dist/data-source.js`.

## Tests
- Unit: `*.spec.ts` next to the code, `npm test` (Vitest).
- API: `test/*.e2e-spec.ts`, `npm run test:e2e`. `beforeAll` starts the container, sets `DATABASE_URL`, runs the migrations through a `DataSource`, undoes each of them and runs them again (so every gate run proves they are reversible), then imports `AppModule` (examples/users.e2e-spec.ts).
- Inside a container (the dev container, CI) Testcontainers needs the Docker socket, `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` and the `host-gateway` entry (examples/compose.yaml).

## project.json
```json
"project": { "stack": { "backend": "NestJS 12 (Node 24)" },
  "db": { "image": "mysql:8.4", "migrate": "docker compose run --rm api sh -c 'npm run build && npx typeorm migration:run -d dist/data-source.js'", "rollback": "docker compose run --rm api npx typeorm migration:revert -d dist/data-source.js", "urlEnv": "DATABASE_URL" } },
"policy": {
  "tests": { "sides": [{ "name": "backend", "code": ["src/**/*.ts"], "tests": ["src/**/*.spec.ts", "test/**/*.ts"], "ignore": ["src/migrations/**"] }] },
  "gates": { "full": "docker compose run --rm -T --no-deps api sh -c 'npm run build && npm run lint && npx prettier --check \"src/**/*.ts\" \"test/**/*.ts\" && npm test && npm run test:e2e'" },
  "edits": { "format": [{ "glob": "{src,test}/**/*.ts", "command": "docker compose run --rm -T --no-deps api npx prettier --write {file}" }],
             "lint": [{ "glob": "{src,test}/**/*.ts", "command": "docker compose run --rm -T --no-deps api npx oxlint {file}" }] },
  "commit": { "checks": [{ "glob": "**/*.ts", "command": "docker compose run --rm -T --no-deps api npx prettier --check {files}" }] }
}
```

Everything runs in the dev container (decision 72): the gate, the per-file checks and the migrations go through `docker compose run`. In one repository holding both services, prefix the globs with the service's folder and add `"dir": "<folder>"` to each per-file rule (skill `dev-environment`).

## Containers (skills `dockerize`, `dev-environment`)
- `examples/Dockerfile`: the `dev` target on the full `node:24-bookworm` (`nest start --watch` stops the old server with `ps`, which the slim image lacks), then the production image: `npm ci`, `npm run build`, `npm prune --omit=dev` on `node:24-bookworm-slim`, `dist` and production `node_modules` as the `node` user, `node dist/main.js`, port 8080.
- `examples/compose.yaml`: MySQL 8.4 with a health check; the API from the dev target, built and migrated at start, its own `node_modules` (an anonymous volume), the Docker socket for Testcontainers, healthy once `GET /v1/users` answers.
- Outside local development, migrations run as their own step before the new version starts.

## Done when
- the change follows the layout, query style and patterns above, and the contract's status codes each have a test;
- the gate passes in the dev container (`forge gates`: build, oxlint, Prettier check, unit and API tests);
- a migration, if any, passes the test setup's run → undo all → run (every gate run does it).
