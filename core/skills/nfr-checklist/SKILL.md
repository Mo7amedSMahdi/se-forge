---
name: nfr-checklist
description: The non-functional requirements of a project as a checklist with targets and the capacity math behind them - load, latency, data growth, connections, availability, security level, accessibility, languages - each target traced to the register or marked as an assumption for the owner. Use in the bootstrap's architecture stage, when a plan is marked `Gates: performance`, and when the expected load or data size changes.
---

# Non-functional checklist and capacity math

Fill `template.md` into `.forge/project/architecture/nfr.md`. The targets feed the k6 thresholds
(skill `load-test`), the performance review, the indexes in the data model and the ADRs.

## Rules
- Every number has a source: a D-id from the register, a story, a measurement (k6, a query plan), or the label **assumption** with who must confirm it. The owner confirms assumptions in the bootstrap's single review; nothing waits silently.
- Show the arithmetic, units included, so anyone can redo it. Round up and state the margin.
- Targets are per operation or flow (`GET /v1/users` p95 < 300 ms at 10 req/s), never "fast".
- Security is OWASP ASVS Level 2 unless the register raises it (decision 31). The accessibility level, the languages and right-to-left come from the register (discovery asks them); no team default exists for accessibility, so a missing answer is a question for the owner.

## Capacity math (the template's section 2)
1. **Users:** registered, daily active (DAU), and peak concurrent, from the register.
2. **Requests:** per active user per day for each main flow (from the stories), then
   `average req/s = DAU × requests per user per day ÷ length of the busy period in seconds` and
   `peak req/s = average × peak factor` (the factor from the register, or an assumption the owner confirms; state it).
3. **Data growth:** per entity, `rows per day × bytes per row`, per year and over the retention period; files and images separately. Bytes per row, indexes included, are measured on the local database after inserting sample rows (PostgreSQL `pg_total_relation_size(table) / count(*)`, the equivalent elsewhere), or marked as an assumption.
4. **Connections:** `API instances × pool size` stays below the database's `max_connections` minus a reserve for migrations and admin.
5. **Result:** what the numbers require (one database instance, an index, pagination limits, a cache, nothing extra) and the k6 thresholds they give.

## Steps
1. Read the register's performance, availability, data, security and language decisions and the stories.
2. Fill every section of the template; mark each value's source.
3. List the assumptions at the end with the person who must confirm each.
4. Turn the per-flow targets into k6 thresholds (skill `load-test`) and the data math into index and retention decisions for the data model (skill `data-model-design`).

## Done when
- every section is filled, every number has a source or is a named assumption, and the arithmetic is shown;
- per-flow latency and throughput targets exist for the main flows and match the k6 thresholds;
- the owner confirmed or changed the assumptions.
