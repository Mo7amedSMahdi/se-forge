---
name: db-mongodb
description: MongoDB conventions for this team - local containers, the official drivers, migrate-mongo for validators, indexes and data changes, schema validation, the duplicate-key error, transactions, and Testcontainers. Use on any project whose database is MongoDB, with the backend's stack skill.
---

# MongoDB

Decision 38. Tested on the MongoDB sample (`tests/stacks/run.sh mongodb`: MongoDB 8.0, Node driver 7, migrate-mongo 14). The C# and Python drivers were not run. The files in `examples/` are copies of that sample.

## Local and test databases
- Image `mongo:8.0`; ready when `mongosh --quiet --eval "db.runCommand({ ping: 1 }).ok"` succeeds.
- Local development (skill `dev-environment`): `examples/compose.yaml` runs `mongo:8.0` with that health check and a named volume, and the app container applies the migrations at start (`npx migrate-mongo up`); the gate runs in it (`docker compose run --rm -T --no-deps app sh -c '<gate>'`; tested 2026-10-08).
- Tests: Testcontainers' MongoDB module starts a single-node replica set (transactions work); connect with `?directConnection=true` (tested).

## Drivers (official only)
- Node: `mongodb` (tested); .NET: `MongoDB.Driver`; Python: PyMongo's async client (`AsyncMongoClient`). Typed collections; map `_id` (ObjectId) to the contract's string `id` at the boundary.

## migrate-mongo (one tool for every stack)
- `migrate-mongo init -m esm`; the config reads `MONGODB_URL` and the database name from the environment (examples/migrate-mongo-config.js).
- `npx migrate-mongo create <name>`, then `up(db)` and `down(db)`; `npx migrate-mongo up`, `down` (the last one), `status`. It runs with Node, or in a `node` container for non-Node projects.
- Each migration creates or changes one collection's validator, its indexes, or one data change (`updateMany` backfills as their own migration).

## Schema and indexes
- Every collection has a `$jsonSchema` validator with `required`, types, enums and `additionalProperties: false`, and `validationAction: 'error'` (examples/migration-create-users.js; tested).
- Indexes in migrations, never created by the app at start-up: unique ones for natural keys, and one per list order (e.g. `{ createdAt: -1, _id: -1 }`).
- Field renames and type changes: expand → migrate → contract, like SQL (skill `db-migration`).

## Errors and transactions
- Duplicate key: error `code === 11000` (`MongoServerError`, tested). Validation failure: "Document failed validation" (code 121).
- Multi-document transactions need a replica set; keep them short.

## Done when
- each collection has a validator and the indexes its queries need, all created by migrations;
- `migrate-mongo up`, `down` and `up` ran on a `mongo:8.0` container.
