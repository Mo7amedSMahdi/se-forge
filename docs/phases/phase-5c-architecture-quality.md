# Phase 5c: architecture records, performance review, load tests

Branch `phase-5c/architecture-quality` (local only), from phase 5b. 2026-10-08.

Decisions: 66 (MADR, C4 in Mermaid), 67 (the performance reviewer, k6), 69 (the roles), and two asked this phase:
- **76:** architecture records live **in the client repository**. MADR 4.0.0 records go in `docs/adr/NNNN-<title>.md` and the C4 diagrams in `docs/architecture/`. The architect drafts them in the team folder, a person approves, and committing an ADR asks a person.
- **77:** **k6, locally**, on request and on plans marked `Gates: performance`. Scripts live in `perf/` and run in the `grafana/k6` container against the Compose stack, with thresholds from the non-functional targets. Not in CI until staging exists.

## Built
- **Roles:**
  - `architect` (docs-only, deep tier): drafts in `.forge/project/architecture/` and never decides. Every open question goes to the owner as options with a recommendation.
  - `performance-reviewer` (read-only): reviews queries, the request path, payloads and the frontend, plus the QA lane's k6 report. Its report is `performance.md`, with `Verdict:` and `Commit:` lines.
- **Skills:**
  - `architecture-design`: the overview with purpose, C4 diagrams, main flows, cross-cutting concerns, data, environments and risks, plus the ADRs, the non-functional checklist and the evaluations.
  - `adr-writer`: MADR 4.0.0's template, verbatim, and an example record.
  - `c4-diagrams`: Mermaid C4, one level per file, with examples.
  - `nfr-checklist`: targets and capacity math. Every number is sourced, measured or a named assumption, and the accessibility level comes from the register (there's no team default).
  - `tech-evaluation`: weighted criteria, sourced and dated facts, knock-outs, timed spikes.
  - `load-test`: k6 against the local stack, reported in `load.md`.
- **`forge docs check <path>`:** checks MADR's required parts and renders every Mermaid block with mermaid-cli 12.0.1 in Docker. It's read-only, so the architect and reviewers may run it.
- **Flow changes:**
  - bootstrap gets an architecture stage (3), so the single review is now stage 7;
  - after approval, a person merges the records into `docs/` through their own merge request;
  - `Gates: performance` on plans: QA runs k6 and the performance reviewer reviews;
  - `Gates: architecture` brings in the architect.
- **Policy:**
  - k6 may target only the local stack: the allowed and local database hosts, or a one-word Compose service name. `k6 cloud` and `--out cloud` are refused.
  - A container run without a command now passes its `-e` values to the rules. That closes `docker compose run -e DATABASE_URL=<remote> api`.
- **Samples:**
  - `tests/architecture/`: the users sample's ADR and C4 context and container diagrams.
  - The FastAPI sample gains `perf/users.js` and a `k6` Compose service (profile `perf`).

## Tested
| What | Result |
|---|---|
| `npm test` on macOS | 426/426 (6 opt-in skipped) |
| `tests/architecture/run.sh` | 3/3; a broken diagram fails with its parse error |
| Live `architect` (opus) | 4/4, $0.48: one numbered MADR draft, `forge docs check` passes, status `proposed`, at least two options, D-012 cited, nothing written in the client repo |
| `run.sh fastapi dev` with k6 | 6/6: the four dev steps, k6 against the running API with every threshold met (10 virtual users, 30 s steady), and a threshold the API cannot meet failing the run (k6 exit code 99) |

## Proposals (accepted 2026-10-08, decision 89)
- **Plans mark performance-sensitive work with `Gates: performance`.** Unlike security and architecture, it doesn't ask a person; it adds the load test and the performance review.
- **The QA lane runs k6** (the performance reviewer is read-only), and the report is `load.md` in the ticket's review folder.
- **The bootstrap architecture stage writes ADRs for the decisions the register already took** (stack, database, design source), so the reasons stay with the code.

## Open
- GitLab and GitHub render Mermaid with their own versions. The C4 diagrams are checked with mermaid-cli 12 only; Mermaid itself marks C4 as experimental.
- No live run of the bootstrap architecture stage, or of a `Gates: performance` ticket from end to end.
