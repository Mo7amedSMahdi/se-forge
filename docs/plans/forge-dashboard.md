# Plan: `forge dashboard`

Status: built 2026-10-10 (decision 98) with the recommended answers to a–d; the estimate step (c) is its own change.

## Goal
One local page that answers six questions about a project: where each ticket's time goes, what each
ticket costs, who spends the tokens, what rework costs, where agents hit walls, and when the project will
finish. It combines the timeline (decisions 96, 97) with what the project already records, without
calling any server.

## The command
```
forge dashboard                 the whole project; writes .forge/state/dashboard.html and opens it
forge dashboard --days 14       only the last 14 days
forge dashboard --ticket 11,12  only these tickets
forge dashboard --out <file>    write somewhere else; --no-open to only write it
forge timeline import           once per checkout: history from Claude Code's session logs (see "History")
```

## Where the data comes from
All local: the client checkout, the team repo folder, and Claude Code's session logs on this Mac.

| Source | What it gives | Example (clinic-booking) |
|---|---|---|
| `.forge/state/timeline-*.jsonl` | every action: who, when, how long, waits, refusals, gates, tokens and models per reply | from 0.2.6 (tokens from 0.2.7) |
| `bootstrap/user-stories.md` | the stories (`### E1-S1 …`) and epics (`## E1 …`) | 26 stories in 6 epics |
| `bootstrap/tickets.md` | each planned ticket (`### T-01 …`) with its `**Story:**` and `**Areas:**` | 33 tickets |
| `bootstrap/tickets-created.md` | T-id → issue number, epic | T-01 → #10 |
| `plans/<id>-*.md` | `Areas:`, `Gates:`, `Sources:` (stories), the Estimate section | 5 plans |
| `metrics.md` | Estimate, Actual (people's hours), Bugs after release, Rework, AI cost | rows for #10, #11 |
| team repo history of `reviews/<id>/*.md` | each review round's verdict and time (every `forge save` is a commit) | #11: 3 rounds |
| client repo: `git log origin/dev --merges` | when each ticket was merged ("Merge branch 'feat/12-…' into 'dev'") | #10 Oct 9 10:22, #12 Oct 10 11:51 |
| `project.json` `prices` | dollars per million tokens (decision 97) | not set yet |

The tracker is not read: a merge on `dev` means done, and the board's other states add little here.

## The six charts

### 1. Where each ticket's time goes
- **Chart:** one horizontal stacked bar per ticket, from its first line to its merge.
- **Parts, each moment counted once, in this order:** agents working (any of the ticket's agents between `agent.start` and `agent.stop`) → gates running (`gates.*` lines, `ms` before `at`) → waiting for you (the lead's turn ended and no agent or gate runs; permission prompts; open questions) → the lead working alone → nobody working (session closed, laptop asleep).
- **Under the chart:** the five longest waits with what was asked, and total waits including those while agents worked.
- **Answers:** how much of the delay is people, not AI.

### 2. Cost per ticket, by model, against its size
- **Chart:** stacked bar per ticket (Opus, Sonnet, Haiku), in dollars when prices are set, else tokens. Dots for the estimate's middle and for the people's actual hours (second axis); area labels under each bar.
- **Answers:** which tickets cost far more than others of their size and areas; whether the model mix is right.

### 3. Who spends the tokens
- **Chart:** Pareto bars by role (lead, planner, each reviewer, each engineer, QA, project manager), with the running share as a line.
- **Plus:** a small table per role: number of spawns, average tokens per spawn, share on Opus.
- **Answers:** which role to make cheaper first (clinic-booking: the lead took 45%).

### 4. Rework
- **Chart:** per ticket, two segments: first pass (start to the first review round with a blocker) and rework (from there to the merge), in tokens/dollars and in hours; the number of review rounds and of engineers sent back by the gates on top.
- **Rounds:** from the team repo history of `reviews/<id>/`: a round is a set of reports saved together; a round with a verdict outside APPROVE/PASS has a blocker (the same reading as `forge merge`). Without that history: the first engineer spawned after the first reviewer finished.
- **Answers:** what a blocker really costs, and whether the rework rules help (clinic-booking #11: one real blocker, about 21M tokens and 12 review runs after it).

### 5. Friction map
- **Chart:** heatmap, rows = refusal rules (`output:heavy`, `roles:read-only`, `models:tier`, …) and failing commands (`Bash npm test`), columns = roles; each cell = count, colour = tokens of the replies that made those calls.
- **Under it:** the ten most frequent refusal reasons, word for word, to spot false refusals.
- **Answers:** which role or skill text to fix, and which kit rules refuse what they should allow.

### 6. Progress and forecast
- **Burn-up:** tickets and stories done over time against the totals from the bootstrap catalogue. A story is done when every ticket naming it is merged.
- **Gantt underneath:** one row per ticket, start to merge, its agents as thin bars inside: shows overlap and idle gaps.
- **Forecast:** the remaining tickets times the median time and cost per merged ticket of the same areas, with a range from the faster and slower half; with fewer than 3 merged tickets, it says "too early".
- **Answers:** when the project will be done and what it will cost.

### Also on the page
A table, one row per ticket: story, areas, gates, estimate, actual, wall time, waits, agents, review rounds,
tokens by model, cost, merged on. Sortable; the same data as CSV next to the page (`dashboard.csv`).

## The page
- One self-contained HTML file: the charts are SVG drawn by the kit's own code, no chart library and no network, so it works offline and keeps to the CLI's no-dependency rule.
- Light and dark from the system setting; hovering a bar shows its numbers (SVG titles); fits a laptop screen.
- Written to `.forge/state/` (not committed, never pushed). Sharing it is a separate decision (d).

## History: `forge timeline import`
Tickets before 0.2.6 have no timeline. Claude Code's session logs (`~/.claude/projects/<checkout>/`, with each
agent's log under `subagents/` and its description in `agent-*.meta.json`) still hold most of it, as long as
Claude Code keeps them (`cleanupPeriodDays`, 30 days by default):
- tool calls with their start and end times, errors and refusal reasons (`[rule] …` in the result);
- agents with their role, description (so their ticket) and start and end;
- every reply's model and tokens, exactly;
- your messages and the lead's turn ends.

Written to `timeline-import.jsonl` with `source: "import"`, once per reply and call; running it again adds
nothing twice. Limits, shown on the page: a call's time includes any permission prompt (the logs do not
split them), and gate runs before 0.2.6 come only from `gates.json` (pass/fail and time, no duration).

## Gaps to close first
- **Estimates.** clinic-booking's plans have no Estimate section and `metrics.md` has empty Estimate cells: the pipeline does not run the `estimate` skill. Charts 2 and 6 need it: make the pipeline run it after `plan-ticket` (small change, separate branch).
- **People's hours.** `Actual` in `metrics.md` stays empty unless the person closing a ticket fills it; chart 2 shows "no actual" until then.

## Build steps (each its own commit, tested)
1. **Data:** `core/cli/dashboard/data.mjs`: readers for each source, joined into one record per ticket (story, areas, estimate, actual, merge time, rounds, lines); unit tests on fixture folders shaped like clinic-booking's.
2. **Measures:** time split, waits, rework segments, friction cells, forecast: pure functions, unit tests with hand-computed answers.
3. **Charts:** SVG bar, stacked bar, Pareto, heatmap, Gantt, burn-up: small functions with tests on their output (sizes, labels, totals in titles).
4. **Page and command:** `forge dashboard`, the ticket table and CSV; a test builds the page from fixtures.
5. **History import:** `forge timeline import`; tested on a copy of real session logs (tokens must match `forge metrics`).
6. **On clinic-booking, read-only:** build the page from the real data, check totals against `forge metrics` and the merge dates against `git log`; screenshots for the guide.
7. **Docs:** `docs/metrics.md` (reading each chart), GUIDE part D row, cheat sheet, changelog, decision 98.

## Open decisions
- **a. Charts:** the kit's own SVG (recommended: offline, no dependency) or a chart library from a CDN (nicer interaction, needs internet).
- **b. History import:** build it (recommended: #10–#15 are most of clinic-booking's history so far) or start from 0.2.7 only.
- **c. Estimates:** make the pipeline run `estimate` after planning (recommended), or leave charts 2 and 6 without estimates.
- **d. Sharing:** local only for now (recommended: the page names the client's code and tickets); later, a team version from a `--record` summary in the team repo.

## Limits
- One machine: the timeline and the session logs stay on the Mac that ran the work. A teammate's tickets appear only on their own dashboard until (d) is decided.
- Cost is an API estimate from your prices, not your subscription bill.
- Times are as good as the clock: a laptop asleep counts as "nobody working", which is the point.
