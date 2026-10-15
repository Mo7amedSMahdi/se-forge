---
status: accepted
date: 2026-10-07
decision-makers: the team leads (se-forge decision 33)
consulted: backend and frontend engineers
informed: everyone on the project
---

# Cursor pagination for every list operation

## Context and Problem Statement

Every list in the users API (`GET /v1/users`) can grow without bound, and the web app shows it as an
endless list sorted newest first. Users are created while someone scrolls. How does a client page
through a list without skipping or repeating rows?

## Decision Drivers

* No skipped or repeated rows when rows are added while a client pages (requirement D-007)
* The same query cost for the first page and the thousandth
* One shape for every list in every service (team API style, decision 41)

## Considered Options

* Cursor pagination: `limit` and an opaque `cursor`, the response carries `nextCursor`
* Offset pagination: `limit` and `offset`, with a total count
* Page numbers: `page` and `pageSize`

## Decision Outcome

Chosen option: "Cursor pagination", because it is the only option that neither skips nor repeats rows
while rows are added (D-007), and its cost does not grow with the page's position.

### Consequences

* Good, because a page is one indexed range query (`created_at DESC, id DESC`, `limit + 1` rows)
* Good, because the cursor is opaque, so the sort keys can change without breaking clients
* Bad, because a client cannot jump to page N or show a total without another endpoint
* Bad, because the cursor encoding and the tie-breaking order must be implemented in every service

### Confirmation

The contract (`users.yaml`) declares `limit` (1–100, default 20) and `cursor`, and `nextCursor` in
the list schema; the spec-checker compares every list operation against it. The API tests page through
a list while creating rows and assert no row is missing or repeated.

## Pros and Cons of the Options

### Cursor pagination

* Good, because inserts during paging do not shift the next page
* Good, because the query uses the sort index from any position
* Bad, because there is no random access to a page

### Offset pagination

* Good, because it is simple and allows jumping to any page and showing a total
* Bad, because an insert before the offset repeats a row on the next page (fails D-007)
* Bad, because large offsets scan and discard rows

### Page numbers

* Good, because users understand page numbers
* Bad, because it is offset pagination with the same drift and cost

## More Information

Team API style: `core/skills/api-contract-design/style.md` (cursor = base64url JSON of the last row's
sort keys). Revisit if a screen needs totals or random page access: add a count endpoint rather than
switching lists to offsets.
