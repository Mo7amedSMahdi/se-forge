---
status: proposed
date: 2026-10-08
decision-makers: the owner
consulted: the team leads
informed: everyone on the project
---

# FastAPI and PostgreSQL for the users service

## Context and Problem Statement

The users portal needs an API and a database for release 1 (D-002, D-005). Which backend stack and
database does it use?

## Decision Drivers

* The owner's choice in discovery (D-005)
* The team's supported stacks (stack guides) and local containers (D-006)

## Considered Options

* FastAPI with async SQLAlchemy and PostgreSQL
* NestJS with TypeORM and MySQL

## Decision Outcome

Chosen option: "FastAPI with async SQLAlchemy and PostgreSQL", because the owner chose it (D-005) and
the team's FastAPI guide covers it end to end.

### Consequences

* Good, because the stack guide, its samples and the CI templates are verified for it
* Bad, because the frontend in release 2 uses another language (TypeScript)
