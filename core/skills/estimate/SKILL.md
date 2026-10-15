---
name: estimate
description: Estimate one planned ticket in hours, as a range per plan item and in total, with the main risk that would push it to the top - compared with similar tickets' actuals in the project's metrics.md, and recorded so actuals can be compared later. Use after plan-ticket, before the work starts.
argument-hint: "<plan path>"
---

# Estimate a ticket

Unit: hours, as a range (decision 40). The estimate is for the whole ticket as this team delivers it with agents: plan items, tests, review fixes and QA.

## Steps
1. Read the plan's items and areas, the bootstrap draft's estimate for this ticket (`**Estimate:**` in `.forge/project/bootstrap/tickets.md`) when there is one, and `.forge/project/metrics.md` for tickets with similar areas and size: their estimates and actuals.
2. Per plan item: a low and a high number of hours. Low = it goes as planned; high = the main risk happens. Name that risk.
3. Add the fixed parts: review round(s) and fixes, QA, contract or migration steps when the plan has them.
4. Total = sums of lows and highs. A range wider than about 3× means the plan is unclear: say which question would narrow it.
5. Write the "Estimate" section into the plan (table below, with its **Total** row: the dashboard and the retro read it), and add the ticket's row to `metrics.md` as `| #<id> | <low>-<high> h | | | | |` (`Actual` stays empty until the ticket closes).
6. When the ticket closes, the person closing it fills `Actual` in `metrics.md`: people's hours on the ticket, not the agents' time (decision 86), with a note when it is outside the range; `forge metrics <id> --record` fills `AI cost` (guide: docs/metrics.md in the kit).

## In the plan: section "Estimate"
| Item | Low (h) | High (h) | Main risk |
|---|---|---|---|
| … | | | |
| **Total** | | | |
Based on: <similar tickets from metrics.md, or "no comparable ticket yet">

## Done when
- every plan item and the fixed parts have a range and a named risk;
- the plan has the Estimate section, and metrics.md has the ticket's row with the estimate.
