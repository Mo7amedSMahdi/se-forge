---
name: db-postgresql
description: PostgreSQL conventions for this team - local containers, connection strings per stack, column types, constraints, safe migrations on a live database (concurrent indexes, expand/contract), the duplicate-key error, and Testcontainers. Use on any project whose database is PostgreSQL, with the backend's stack skill.
---

# PostgreSQL

Tested on the FastAPI sample (`tests/stacks/run.sh fastapi`, PostgreSQL 17); facts marked "not run" come from the documentation only.

## Local and test databases
- Image `postgres:17-alpine`; env `POSTGRES_PASSWORD`, `POSTGRES_DB`; ready when `psql -U postgres -d <db> -c "select 1"` succeeds (not only `pg_isready`).
- Tests: Testcontainers (`testcontainers.community.postgres` in Python, `Testcontainers.PostgreSql` for .NET, `@testcontainers/postgresql` for Node).

## Connections (by env variable name; never committed)
- FastAPI: `DATABASE_URL=postgresql+asyncpg://user:password@host:5432/db` (asyncpg).
- .NET: `ConnectionStrings__Default=Host=host;Port=5432;Database=db;Username=user;Password=...` with `Npgsql.EntityFrameworkCore.PostgreSQL` (not run).
- NestJS: `DATABASE_URL=postgres://user:password@host:5432/db`, TypeORM `type: 'postgres'` with `pg` (not run).

## Types and constraints
- IDs `uuid`; times `timestamptz`, always (stored in UTC); text with a contract limit `varchar(n)`, otherwise `text`; money `numeric(19,4)`; documents `jsonb`.
- Constraints in the database: `NOT NULL`, `UNIQUE`, `CHECK` (enum-like values), foreign keys `ON DELETE RESTRICT` unless the child is owned.
- Case-insensitive uniqueness: store a normalised value (the samples lowercase emails) or a unique index on `lower(column)`.

## Safe migrations on a live database
- **Indexes on large tables**: `CREATE INDEX CONCURRENTLY` (and `DROP INDEX CONCURRENTLY`), which cannot run in a transaction. Alembic: inside `with op.get_context().autocommit_block():` (tested). EF Core: `migrationBuilder.Sql("...", suppressTransaction: true)` (not run).
- A new column with a constant default is a metadata change (no table rewrite); a new `NOT NULL` column without one needs add-nullable → backfill → `SET NOT NULL` in separate migrations.
- Renames and type changes: expand → migrate → contract (skill `db-migration`). `ALTER TYPE` on a big table rewrites it.
- Long locks: set `lock_timeout` in the migration session for DDL on hot tables.

## Errors
Duplicate key: SQLSTATE `23505` (SQLAlchemy `IntegrityError`, tested; Npgsql `PostgresException.SqlState`; `pg` error `code`). Foreign-key violation: `23503`.

## Done when
- types, constraints and indexes follow this skill, and destructive steps are split;
- the migration ran up, down and up on a `postgres:17-alpine` container.
