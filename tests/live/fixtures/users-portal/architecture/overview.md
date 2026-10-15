# Architecture overview: Users portal

## Purpose and scope
An internal tool for administrators to list, create and view the portal's users (D-001, D-002).
Suspension (D-002) and the frontend (D-005) come later; authentication is out of scope (D-010).

## Context and containers
See `context.md` and `containers.md` (C4, Mermaid). Release 1 runs the API and the database; the web
app in `containers.md` comes in release 2.

## Main flows
1. Create a user: the API validates the body (D-003, D-004), writes the row, answers 201 with `Location`; a duplicate email is a unique violation answered 409.
2. List users: one indexed range query per page, `created_at DESC, id DESC`, cursor of the last row (ADR 0001).

## Cross-cutting
Errors as RFC 9457 problem details; configuration from the environment (`DATABASE_URL`); English messages (D-009).

## Data
`users`: id, email (unique, lowercase: D-003), display name, status, created at.

## Environments
Local containers in Compose (team decisions 70-72); staging with the next release.

## Risks and open questions
None open.
