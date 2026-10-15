---
name: handover-docs
description: The handover package when a project goes to the client's team or another team - how to run, test and change it, its architecture and decisions, configuration, the API, operations, and the open work - written in the client repository's docs/ from what the repository and the team repo already hold. Use at the end of an engagement or when the owner asks for handover documentation.
---

# Handover documentation

Everything is written from the repository, the team repo and the tracker, never from memory; anything
that cannot be checked is marked as such. The result goes into the client repository through a merge
request a person merges.

## The package (`docs/handover/`)
1. **`README.md`:** what the system does (from the stories), who it is for, where everything else is.
2. **`run-and-test.md`:** the toolchain (Docker with Compose), `docker compose up`, the gate and how to run each kind of test, the seed data if any, the common problems (skill `dev-environment`'s table, as it applies).
3. **`architecture.md`:** links to `docs/architecture/` (C4 diagrams) and `docs/adr/`; the main flows; the data model's main entities; what each container does.
4. **`configuration.md`:** every environment variable from `.env.example`, what it does, required or not, and who provides the value; secrets by name only.
5. **`api.md`:** where the contract is, its current approved version (`api-v*` tag), the team style it follows (errors, pagination, versions), how a client is generated.
6. **`operations.md`:** how a release is made (skill `release`), the CI jobs and what they enforce, the branch protection; what deploys and backups exist (none before staging: say so).
7. **`open-work.md`:** open tickets and issues by priority (`forge tracker list json`), known limits, the register's open questions, the last retro's follow-ups.

## Steps
1. Collect the sources: the register, the stories, `docs/architecture/`, `docs/adr/`, `.env.example`, the contract and its tags, `CHANGELOG.md`, the CI files, the tracker, the last retro.
2. Write the seven files; every command in them is run once in the dev containers to check it works as written.
3. Branch `docs/handover`, commit, merge request into `dev`; a person reviews and merges it.

## Done when
- the seven files exist, each statement traceable to the repository, the team repo or the tracker;
- every command in them was run and works;
- no secret value appears, and the merge request is open for a person.
