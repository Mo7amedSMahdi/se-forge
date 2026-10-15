---
name: load-test
description: Load testing with k6 against the local Compose stack (decision 77) - a script per plan flow with thresholds taken from the non-functional targets, run in the grafana/k6 container, the result written as a report the performance reviewer reads. Use on plans marked `Gates: performance`, when asked to measure an endpoint or flow, and before and after a performance fix.
---

# Load tests with k6

`examples/users.js` is the kit's verified script (the FastAPI sample: `tests/stacks/run.sh fastapi dev`
runs it against the running stack, and checks that a threshold the API cannot meet fails the run).

## Where and when
- Scripts live in the repository's `perf/`, one per flow (`perf/<flow>.js`), committed with the code.
- They run locally against the Compose stack (skill `dev-environment`), in the `k6` service (profile `perf`, image `grafana/k6:2.3.0`, `./perf` mounted). Never against a shared, staging or production URL: the hook refuses a k6 run aimed at a host outside the local stack, and `k6 cloud`.
- Not in CI until staging exists (decision 77).

## Script (see the example)
- `BASE_URL` from the environment, default `http://api:8080` (the compose service).
- `options.scenarios`: a ramp up and a steady stage sized from the NFR checklist's peak req/s (users × iterations); `options.thresholds` copied from its targets, per flow tag (`http_req_duration{name:<flow>}`: `p(95)<…`), plus `http_req_failed` and `checks`. Cite the D-ids in a comment.
- Tag each request with its flow name; `check` the status and the shape the contract promises; unique data per virtual user and iteration (`__VU`, `__ITER`).
- Seed what the flow needs (users, products) in `setup()` through the API, never by writing to the database.

## Steps
1. Read the plan's flows and the targets (`.forge/project/architecture/nfr.md`, or the register's performance decisions). No target: ask; do not invent one.
2. Write or update `perf/<flow>.js` from the example.
3. `docker compose up -d --build --wait` (the branch's code), then `docker compose --profile perf run --rm -T k6 run /perf/<flow>.js > /tmp/k6.log 2>&1`. Exit code 0: every threshold met; 99: a threshold failed; other: the script failed.
4. Read the end-of-test summary (`tail -60 /tmp/k6.log`): each threshold's result and the p95 per flow.
5. Write `.forge/project/reviews/<ticket>/load.md` in your worktree (the hook copies it to the main checkout when you finish), starting with `Verdict: PASS` or `Verdict: FAIL` and `Commit: <git rev-parse HEAD>` (`forge merge` reads both): the script, the scenario, a table flow → target → measured p95 → error rate, and the machine (local Docker; numbers compare only with runs on the same machine).
6. A failed threshold is a finding for the engineer (the performance reviewer names the cause); never relax a threshold to pass. A target that proves unrealistic goes to the owner with the numbers.

## Done when
- the script covers the plan's flows, with thresholds equal to the targets and checks on every response;
- it ran against the branch's commit on the local stack, and `load.md` records the verdict, the commit and the numbers;
- every threshold passed, or the failure is with the engineer or the owner.
