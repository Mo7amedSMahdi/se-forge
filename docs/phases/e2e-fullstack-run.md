# End-to-end run: one full-stack ticket, built by agents

Branch `e2e/fullstack-run` (local only). 2026-10-07, after phase 4b.

## The run
- **Setup.** The FastAPI sample as a client repo. The contract is `api-v1.0.0`, then `api-v1.1.0`, which adds `POST /v1/users/{userId}/suspend` and `suspendedAt`. Both are tagged on main and pushed to a local bare origin. Set up with `forge init`; the toolchain runs in Docker behind `scripts/dev.sh`, which is declared in `commands.wrappers`.
- **Session.** Claude Code, Sonnet, `/ticket "Ticket 21: Suspend a user …"`, `acceptEdits` mode, with no PR host and no tracker.
- **Judging.** The harness checks the pushed branch from a clone. The hidden acceptance test (`tests/live/fixtures/test_acceptance_suspend.py`) covers 200 with `SUSPENDED` and `suspendedAt`, 409 the second time, 404 for an unknown user, and `suspendedAt` returned by GET. The harness also runs Alembic upgrade, downgrade and upgrade on a fresh PostgreSQL.
- `node tests/live/live-harness.mjs fullstack-dry` checks the setup without Claude: the gate passes on main, and the hidden test fails there.

## Results

| Run | Checks | Cost | Notes |
|---|---|---|---|
| 1 | 14/14 | $1.35 | Found three kit problems (below). The agent built and pushed the work; then the security reviewer stopped it with a real blocker. |
| 2, after the fixes | 16/16 | $1.21 | Reviewers wrote their own reports; the format hook ran in the container. |

What the agents did, both runs:
- **Planning:** a plan with `Areas: db, api` and `Contract: api-v1.1.0`.
- **Database:** migration `0002`, which adds `suspended_at` with a check constraint.
- **API:** the endpoint and its tests, with Conventional Commits, `forge gates` green, and the contract untouched.
- **Reviews:** all four reviewers ran:
  - **db-reviewer:** suggested adding the check constraint as `NOT VALID` and validating it afterwards (live safety).
  - **security-reviewer:** blocked the work, because the contract makes an admin-only action public (`security: []`). Anyone could suspend every user.
- **Stopping:** the agent stopped before closing the work and asked the owner to choose between a new contract version with a security scheme and an ADR naming the gateway control. That is the intended behaviour; the gap was in the test fixture's contract.

## Kit problems found and fixed
1. **Wrapper scripts hid commands from the policy.** `sh scripts/dev.sh uv add x` changed dependencies without asking. Fix: `commands.wrappers`; the rules check the command inside.
2. **Reviewers could not write their reports.** Read-only roles were rendered without the Write tool, so the lead wrote the reports. Fix: Write is allowed again, and the policy still limits it to `paths.reports`.
3. **Edit checks got absolute host paths.** They don't exist inside a toolchain container. Fix: `{file}` is repo-relative.
4. **The agent skipped the migration down check** (the judge's round trip passed). Fix: the samples' test setups migrate up, all the way down and up again, so every gate run proves reversibility. The three backend samples pass every runner step again.

## Still open
- `/pipeline` with several tickets and parallel lanes, unattended: not run yet.
- Separate frontend and backend repos with real remotes: wait for the GitLab group.
