# Ticket drafts: Users portal (release 1)

The existing service already covers US-1, US-3 and US-2 AC1; it also lowercases emails, but nothing in the database enforces D-003 and no test covers it. These two tickets finish US-2. Both are
`api` only, on the approved contract version `api-v1.0.0` (no contract change), in this order.

## 1. Emails are unique regardless of letter case
- Story: US-2 AC2 (D-003). Areas: api. Contract: api-v1.0.0, operation `createUser`. Gates: none. E2E: not applicable (no frontend in release 1).
- Acceptance criteria:
  1. Creating `Case.Test@Example.com` then `case.test@example.com` gives 201 then 409 (problem details).
  2. The stored and returned email is lowercase.
- Estimate: 1-2 h. Risk: none.

## 2. Display names must not be blank
- Story: US-2 AC3 (D-004). Areas: api. Contract: api-v1.0.0, operation `createUser`. Gates: none. E2E: not applicable (no frontend in release 1).
- Acceptance criteria:
  1. A display name of only spaces gives 400 with an error for the field `displayName`.
  2. Spaces at both ends are trimmed before saving; a name longer than 100 characters after trimming gives 400.
- Estimate: 1-2 h. Risk: none.

Total: 2-4 h.
