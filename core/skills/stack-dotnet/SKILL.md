---
name: stack-dotnet
description: How this team builds a .NET backend - .NET 10, ASP.NET Core minimal APIs grouped by feature, EF Core migrations, xUnit with WebApplicationFactory and Testcontainers - including the problem-details shape, cursor pages, the project.json settings and the Dockerfile. Use on any project whose stack is .NET, when planning, building or reviewing backend work.
---

# .NET backend

Decisions 34, 35, 41 and 70-73. Checked by running `tests/stacks/run.sh dotnet` (2026-10-07; the dev part 2026-10-08) and `tests/ci/run.sh <gitlab|github> dotnet` in the kit ( SDK 10.0.401, EF Core 10.0.12, xUnit 2.9, Testcontainers 4.15, SQL Server 2022). The files in `examples/` are copies of that sample.

## Layout
```
<App>.slnx                         dotnet new sln (.NET 10 writes .slnx)
dotnet-tools.json                  dotnet new tool-manifest; dotnet tool install dotnet-ef (pinned)
src/<App>.Api/Program.cs           services, problem details, exception handler, Map<Feature>() per feature
src/<App>.Api/Problems.cs          the team's problem shape (examples/Problems.cs)
src/<App>.Api/Data/AppDb.cs        DbContext and model configuration
src/<App>.Api/<Feature>/           entity, request/response records, <Feature>Endpoints.cs (route group)
src/<App>.Api/Migrations/          dotnet ef migrations add ...
tests/<App>.Api.Tests/             ApiFactory (WebApplicationFactory + Testcontainers), API tests per feature
```
`public partial class Program;` at the end of Program.cs lets the tests start the app.

## Patterns (see `examples/`)
- **Routes**: one `MapGroup("/v1/<resource>").WithTags(...)` per feature; `.WithName("<operationId>")` as in the contract; handlers return `TypedResults`.
- **JSON**: camelCase by default; `UnmappedMemberHandling = Disallow` (unknown fields are a 400); `JsonStringEnumConverter` for enum names.
- **Errors**: `AddProblemDetails()`, `UseExceptionHandler()`, `UseStatusCodePages()`. Validation returns `Problems.Validation(...)`: 400 with `errors: [{field, message}]`. Malformed JSON and unknown fields: `RouteHandlerOptions.ThrowOnBadRequest = true` plus `ProblemExceptionHandler` (an `IExceptionHandler`) give the same shape. ASP.NET's own validation response has a different `errors` shape, so it is not used.
- **Unique violations**: `DbUpdateException` with `SqlException { Number: 2601 or 2627 }` → 409 (other databases: their skill `db-*`).
- **Lists**: `OrderByDescending(CreatedAt).ThenByDescending(Id)`, cursor of the last row's keys, `Take(limit + 1)`. EF Core translates `Guid.CompareTo` for the tie-break.
- **Raw SQL** for complex queries: `db.Database.SqlQuery<T>($"... {param}")`, which binds interpolated values as parameters; never `SqlQueryRaw` with concatenated input.
- **Created**: `TypedResults.Created($"/v1/<resource>/{id}", dto)`.
- **Configuration**: the connection string from the environment (`ConnectionStrings__Default`), never in `appsettings*.json`.

## Migrations (EF Core)
The commands below run in the dev container: prefix them with `docker compose run --rm api` (or `docker compose exec -T api` while it is up).
- New: `dotnet ef migrations add <Name> --project src/<App>.Api`. Read the generated `Up`/`Down` before committing; one change per migration.
- Run: `dotnet ef database update --project src/<App>.Api`; back to before a migration: `dotnet ef database update <PreviousName>`; all the way: `... update 0`.
- In production, apply migrations as their own deployment step (`dotnet ef migrations bundle`, or a SQL script from `dotnet ef migrations script --idempotent`), not at app start-up.

## Tests
- xUnit; `IClassFixture<ApiFactory>`; `ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime` starts the database container, points `ConnectionStrings:Default` at it and migrates up, all the way down (`GetService<IMigrator>().MigrateAsync("0")`) and up again (examples/ApiFactory.cs), so every gate run proves the migrations are reversible.
- One API test per status code the contract lists; unit tests for rules without the web host.
- Inside a container (the dev container, CI) Testcontainers needs the Docker socket, `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal` and the `host-gateway` entry (examples/compose.yaml).

## project.json
```json
"project": { "stack": { "backend": ".NET 10 (ASP.NET Core minimal APIs)" },
  "db": { "image": "mcr.microsoft.com/mssql/server:2022-latest", "migrate": "docker compose run --rm api dotnet ef database update --project src/<App>.Api", "rollback": "docker compose run --rm api dotnet ef database update <PreviousMigration> --project src/<App>.Api", "urlEnv": "ConnectionStrings__Default" } },
"policy": {
  "tests": { "sides": [{ "name": "backend", "code": ["src/**/*.cs"], "tests": ["tests/**/*.cs"], "ignore": ["**/Migrations/**"] }] },
  "gates": { "full": "docker compose run --rm -T --no-deps api sh -c 'dotnet format --verify-no-changes && dotnet build -warnaserror && dotnet test'" },
  "commit": { "checks": [{ "glob": "**/*.cs", "command": "docker compose run --rm -T --no-deps api dotnet format --verify-no-changes --include {files}" }] }
}
```
Per-file edit checks are left out: `dotnet format` and builds work on the whole project and take seconds each; the gate runs them.

Everything runs in the dev container (decision 72): the gate, the per-file checks and the migrations go through `docker compose run`. In one repository holding both services, prefix the globs with the service's folder and add `"dir": "<folder>"` to each per-file rule (skill `dev-environment`).

## Containers (skills `dockerize`, `dev-environment`)
- `examples/Dockerfile`: the `dev` target (SDK, local tools, restored packages; `dotnet watch` with the polling file watcher, which mounted folders need, restarting on rude edits), then the production image: `dotnet publish -c Release` on `sdk:10.0`, `aspnet:10.0` running as `$APP_UID`, port 8080. `.dockerignore` keeps `bin`, `obj` and `.env*` out.
- `examples/compose.yaml`: SQL Server 2022 (amd64; emulated on Apple Silicon) with a health check; the API from the dev target, migrated at start (`dotnet ef database update`), its own `obj/` and `bin/` per project (anonymous volumes), the Docker socket for Testcontainers, healthy once `GET /v1/users` answers.

## Done when
- the change follows the layout and patterns above, and the contract's status codes each have a test;
- the gate passes in the dev container (`forge gates`: format, build with warnings as errors, tests);
- a migration, if any, passes the test setup's up → down to 0 → up (every gate run does it).
