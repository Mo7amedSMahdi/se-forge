---
name: db-mysql
description: MySQL and MariaDB conventions for this team - local containers, connection strings, column types and character sets, constraints, online DDL, non-transactional migrations, the duplicate-key error, and Testcontainers. Use on any project whose database is MySQL or MariaDB, with the backend's stack skill.
---

# MySQL / MariaDB

Tested on the NestJS sample (`tests/stacks/run.sh nestjs`, MySQL 8.4). MariaDB was not run: check the differences below on a container before relying on them.

## Local and test databases
- Image `mysql:8.4` (LTS); env `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`; ready when `mysql -uroot -p<pw> -e "select 1" <db>` succeeds. MariaDB: `mariadb:11.4` (LTS, not run).
- Tests: Testcontainers (`@testcontainers/mysql`, `Testcontainers.MySql`, `testcontainers.community.mysql`).

## Connections (by env variable name; never committed)
- NestJS: `DATABASE_URL=mysql://user:password@host:3306/db`, TypeORM `type: 'mysql'` with `mysql2`, `timezone: 'Z'` (tested).
- FastAPI: `mysql+asyncmy://` or `mysql+aiomysql://` (not run). .NET: check which EF Core provider supports the current EF Core version before choosing (not run).

## Types, character sets, constraints
- Tables `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci` (case- and accent-insensitive comparisons and uniqueness).
- IDs as `CHAR(36)` UUID strings (simple; tested) or `BINARY(16)` with `UUID_TO_BIN` (smaller indexes); times `DATETIME(6)` stored in UTC (the session time zone of the driver must be UTC); money `DECIMAL(19,4)`.
- `CHECK` constraints are enforced since MySQL 8.0.16; descending index parts are real since 8.0 (tested). MariaDB has a native `UUID` type (10.7+).

## Migrations
- **DDL is not transactional**: a migration that fails halfway leaves its first statements applied. Keep one DDL statement per migration where possible, and make `down` safe to run after a partial `up`.
- Online changes: `ALTER TABLE ... ADD INDEX ..., ALGORITHM=INPLACE, LOCK=NONE`; many column additions can use `ALGORITHM=INSTANT` (8.0+). Ask for the algorithm explicitly, so MySQL fails instead of silently locking.
- Renames and type changes: expand → migrate → contract (skill `db-migration`).

## Errors
Duplicate key: `ER_DUP_ENTRY` (1062; mysql2 `code`, tested). Foreign-key violation: `ER_NO_REFERENCED_ROW_2` (1452).

## Done when
- types, character set, constraints and indexes follow this skill;
- each migration is one DDL statement where possible, and ran up, down and up on a `mysql:8.4` (or the project's MariaDB) container.
