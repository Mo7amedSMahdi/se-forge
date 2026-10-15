---
name: debug-issue
description: Fixing a reported bug from its root cause - reproduce it locally with a failing test first, find the cause (logs, the local database, git bisect), make the smallest fix, keep the test as the regression guard. Use for a [Bug] issue, a failing acceptance criterion found by QA, or a behaviour a person reports.
---

# Debugging an issue

Work in the dev containers (skill `dev-environment`) and never against a shared or production database
or service: reproduce locally, with local data.

## Steps
1. **Read the report** (`forge tracker get <id>`): the steps, the expected and the actual behaviour, the version or commit, the story or decision it breaks (the register's D-id). Missing steps: ask the reporter in a comment and stop.
2. **Reproduce** on the branch's base (`dev`, or the release's tag for a bug in a release): `docker compose up -d --build --wait`, then the steps, by the API (`curl` to `localhost`) or the browser. Not reproducible: comment what you tried and with which data, and ask.
3. **A failing test first:** the smallest test at the right level that shows the bug (a unit test for a rule, an API test for an endpoint, a Playwright test only for a flow). Run it; it must fail for the reported reason, not another.
4. **Find the cause**, not only where it shows:
   - logs: `docker compose logs --tail 100 api`;
   - the local database: the stack's client in the db container (`docker compose exec db psql -U app app`, `mysql`, `sqlcmd`, `mongosh`), read-only queries;
   - when it used to work: keep the new test untracked (not added) so it survives the checkouts, then `git bisect start <bad> <good>` and `git bisect run docker compose run --rm -T --no-deps api <the failing test>`; `git bisect reset` after;
   - write the cause in one or two sentences before changing code.
5. **The smallest fix** at the cause, on `fix/<id>-<slug>` from `dev`: no unrelated cleanup, no refactor that is not needed for the fix (file that as a `[Follow-up]`, skill `report-issue`).
6. **Prove it:** the new test passes, the gate passes (`forge gates`); a data fix or a migration goes through `db-migration`.
7. **Close the loop:** in the ticket comment, the cause, the fix, the test that guards it, and whether data already stored is affected (and what to do about it: a person decides).

## Done when
- a test reproduced the bug before the fix and passes after it, and stays in the suite;
- the cause is written in the ticket, and the fix changes only what the cause needs;
- the gate is green on the pushed branch, and stored data affected by the bug is reported.
