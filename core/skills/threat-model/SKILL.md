---
name: threat-model
description: A short STRIDE threat model for a change that adds an entry point, crosses a trust boundary, or stores or exposes personal data - threats, mitigations and the OWASP ASVS Level 2 requirements they map to - written into the plan before code and checked by the security-reviewer.
---

# Threat model (STRIDE)

When: a new or changed endpoint, webhook, file upload, login or session flow, permission rule, a call to an outside service, or personal data stored or exposed. Plans with `Gates: security` always have one.

## Procedure
1. Draw the flow in at most 10 lines: actor → entry point → components → data stores → outside services. Mark each trust boundary (internet → API, API → database, API → third party).
2. For each entry point and boundary, go through STRIDE:
   - **S**poofing: who is the caller, and how is that proven?
   - **T**ampering: can inputs, IDs, prices or states be changed in transit or in the request?
   - **R**epudiation: is the security-relevant action logged with who, what and when?
   - **I**nformation disclosure: what could leak through responses, errors, logs or other users' objects (IDOR)?
   - **D**enial of service: unbounded queries, uploads, loops; is there a rate limit where the plan needs one?
   - **E**levation of privilege: can a user act above their role or on another tenant's data?
3. For each real threat, name the mitigation (existing or planned) and the ASVS Level 2 requirement it satisfies. A threat without a mitigation is a plan question with a recommended default, and the plan gets `Gates: security`.

## In the plan: section "Threat model"
| Entry point / boundary | STRIDE | Threat | Mitigation | ASVS | Status (exists / planned / gap) |
|---|---|---|---|---|---|

Keep it under 25 lines. The security-reviewer checks the code against it.

## Done when
- the plan has the threat model table for every entry point and boundary the change adds;
- every real threat has a mitigation and its ASVS requirement, or is a plan question with `Gates: security`.
