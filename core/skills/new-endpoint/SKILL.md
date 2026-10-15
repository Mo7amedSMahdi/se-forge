---
name: new-endpoint
description: Implement one API operation exactly as the approved contract defines it - route, validation, authorization, business rule, data access, errors - with a unit test for the rule and an API test per status code. Used by the backend-engineer for each api item of a plan.
---

# Implement one operation

Preconditions: the plan's `Contract:` line names an approved `api-v` tag that contains the operation, and any schema it needs is already migrated on this branch (db lane first).

1. Read the operation at that version: `git show <tag>:<spec path> | grep -n -A40 "operationId: <id>"`. Note the path, parameters, request schema, every response (status and schema), and security.
2. Find the closest existing endpoint in the same feature or module and copy its structure: routing, handler or controller, service, data access, error mapping.
3. Tests first:
   - an API test per documented status code: the success case, validation (400), unauthenticated (401), forbidden (403), not found (404), and conflict or business rule (409/422) when the contract lists them. Each checks the status and the body shape, problem details included;
   - unit tests for the business rule itself.
4. Implement:
   - validate path, query and body at the boundary, by the contract's schema; reject unknown fields where the stack allows it (no mass assignment);
   - authorize the operation and the specific object (ownership or tenant), through the project's authorization layer;
   - the business rule in the service layer when the project has one;
   - data access through the existing data layer, with parameterised queries only;
   - errors as problem details with the contract's status codes; log the failure without secrets or personal data.
5. `forge gates`. Commit per operation (`feat(<scope>): <operationId>`) with explicit paths, and push.

The code returns exactly what the contract says: no extra fields, no undocumented status codes, no undocumented endpoints. A mismatch you cannot resolve is a contract gap: stop and report it.

## Done when
- the operation matches the approved contract: path, parameters, bodies, status codes, security;
- an API test exists for every status code the contract lists, plus unit tests for the rule;
- `forge gates` is green on the pushed branch, with one commit per operation.
