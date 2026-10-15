---
name: db-sqlserver
description: SQL Server conventions for this team - local containers (including Apple Silicon), connection strings, column types, constraints, safe migrations, the duplicate-key errors, and Testcontainers. Use on any project whose database is SQL Server, with the backend's stack skill.
---

# SQL Server

Tested on the .NET sample (`tests/stacks/run.sh dotnet`, SQL Server 2022); facts marked "not run" come from the documentation only.

## Local and test databases
- Image `mcr.microsoft.com/mssql/server:2022-latest`, **amd64 only**: on Apple Silicon it runs under Docker Desktop's emulation (`--platform linux/amd64`, tested). Env `ACCEPT_EULA=Y`, `MSSQL_SA_PASSWORD` (8+ characters with three character classes).
- "Ready for client connections" in the log is not enough: logins fail for a few seconds after it. Wait until `/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P <pw> -C -Q "select 1"` succeeds. Testcontainers (`Testcontainers.MsSql`) waits this way.

## Connections (by env variable name; never committed)
- .NET: `ConnectionStrings__Default=Server=host,1433;Database=app;User Id=...;Password=...;TrustServerCertificate=true` (`TrustServerCertificate` for local containers only).
- NestJS: TypeORM `type: 'mssql'` with the `mssql` driver (not run). Python: `aioodbc` with ODBC Driver 18 (not run).

## Types and constraints
- IDs `uniqueidentifier`; times `datetime2` in UTC (`SYSUTCDATETIME()`) or `datetimeoffset`; text `nvarchar(n)`; flags `bit`; money `decimal(19,4)`.
- `uniqueidentifier` sorts by its last bytes first: never page or order by a GUID alone; order by a time column, then the id (as the sample does).
- The default collation is case-insensitive (`SQL_Latin1_General_CP1_CI_AS`), so `UNIQUE` on text is case-insensitive.
- Constraints in the database: `CHECK` for enum-like values, unique indexes, foreign keys with `NO ACTION` unless the child is owned.

## Safe migrations on a live database
- `CREATE INDEX ... WITH (ONLINE = ON)` needs Enterprise or Developer edition (or Azure SQL); on Standard and Express index builds lock the table: schedule them (not run).
- New `NOT NULL` columns: add with a default constraint, or nullable → backfill → `ALTER COLUMN ... NOT NULL`.
- EF Core runs each migration in a transaction; `migrationBuilder.Sql(sql, suppressTransaction: true)` for statements that cannot (not run).
- Deploy migrations with `dotnet ef migrations script --idempotent` or `dotnet ef migrations bundle` (both tested).

## Errors
Duplicate key: error number `2601` (unique index) or `2627` (unique constraint), `SqlException.Number` (tested). Foreign-key violation: `547`.

## Done when
- types, constraints and indexes follow this skill, and destructive steps are split;
- the migration ran up, down and up on a SQL Server 2022 container.
