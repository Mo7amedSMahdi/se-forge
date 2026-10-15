---
name: api-contract-design
description: Design or change an API contract (OpenAPI 3.1) in the team API style, as a draft a person approves - resources, operations, schemas, errors, pagination, security, version bump - and check it with forge api check. Used by the contract-analyst, and by the lead in light mode when a ticket needs an API change.
---

# Design a contract change

The contract is the source of truth for every API. It changes only through a draft, a merge request a person approves, and an `api-v<semver>` tag a person creates.

## Procedure
1. Start from the latest approved version: `git fetch --tags`, then `git show <newest api-v tag>:<spec path>` (project facts). In a repo that consumes the contract, `forge api fetch` prints the pinned spec's path.
2. Write the **whole changed spec** to `.forge/project/contracts/<ticket>-<slug>.yaml`. Change only what the ticket needs. Follow `style.md` in this skill's folder, unless the project's rules say otherwise.
3. Version (`info.version`, semver):
   - additive change (new operation, new optional field or parameter): minor;
   - documentation only: patch;
   - anything breaking (removed or renamed operation or field, new required input, narrowed type, changed status code or auth): **major**. Prefer an additive design. A breaking change needs the owner's decision on how consumers move: a new URL major served next to the old one, or a coordinated release.
4. Check it: `forge api check --spec .forge/project/contracts/<ticket>-<slug>.yaml > /tmp/api-check.log 2>&1; tail -30 /tmp/api-check.log`. Fix lint errors. Copy the list of breaking changes into the plan.
5. In the plan: `Contract: pending (.forge/project/contracts/<ticket>-<slug>.yaml, version <x.y.z>)`, plus a short change summary (operations added or changed, breaking or not, consumers affected).
6. Hand over to a person. They copy the draft into the repo's spec on a branch `chore/<ticket>-contract` and open its own merge request. Editing the spec asks a person, so in a session the person approves that edit. After the merge, a person tags `api-v<version>` and, in consumer repos, sets `project.api.pin`. The plan's `Contract:` line then names the tag, and API and UI work can start.

Never edit the repo's spec to make an implementation pass, and never tag.

## Done when
- the draft is in `.forge/project/contracts/` with a raised `info.version`;
- `forge api check --spec <draft>` passes, or its only finding is an expected breaking change with a new major version;
- the plan's `Contract:` line is `pending (<draft>, version <x.y.z>)` and holds the change summary and consumer migration;
- the owner has been told what to approve; nothing was edited in the repo's spec and nothing was tagged.
