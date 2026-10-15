---
name: db-migration
description: Write and test one database migration with the project's migration tool - new migration only, reversible where possible, safe on a live database, backfills separate - tested up, down and up on a throwaway local container. Used by the db-engineer.
---

# One migration

1. Generate the migration with the project's tool (skill `stack-*` for the backend, `db-*` for the database), never by hand-numbering files. One logical change per migration; a data backfill is a migration of its own.
2. Write up and down. If down cannot restore the data (a drop), say so in the migration and in the plan.
3. Live safety, as the db-reviewer will check:
   - a new NOT NULL column on existing rows: add it nullable, backfill, then add the constraint in a later migration;
   - a rename or a type change: expand (add the new column), migrate (dual-write and backfill), contract (drop the old one) over separate releases;
   - index builds on large tables: the database's online or concurrent option, outside a transaction where it requires that;
   - no long-running data updates inside a schema migration.
4. The API tests' setup runs every migration up, all the way down and up again (skill `stack-*`), so the gate proves reversibility. For a migration that moves data, also test it by hand on a throwaway container with realistic rows (the database image and the migrate and roll-back commands from the project facts):
   ```
   docker run --rm -d --name forge-db-<ticket> -p 127.0.0.1:<port>:<db port> <image env and options>
   <migrate command> > /tmp/migrate.log 2>&1   (dev's migrations, then this branch's: up)
   <rollback command> > /tmp/rollback.log 2>&1  (down)
   <migrate command> > /tmp/migrate.log 2>&1   (up again)
   docker rm -f forge-db-<ticket>
   ```
   Give the connection to the commands through the variable the project facts name (`DATABASE_URL` by default), pointing at `127.0.0.1`. Quote only the summary lines of the logs.
5. Commit the migration and the model change together (`feat(db): <what>`), with explicit paths, and push.

Never edit a migration that is already on dev (the hook refuses it); write a new one. Never run a migration against a database that is not a local container.

## Done when
- one new migration per logical change, generated with the project's tool, with up and down (or a stated reason for no down);
- it ran up, down and up on a throwaway container, and the container is removed;
- the migration and its model change are committed together and pushed.
