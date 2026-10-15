---
name: dependency-update
description: The monthly dependency update (decision 83), and the immediate one after a security advisory - list what is outdated or vulnerable in every ecosystem and base image, update in small batches (security first, then patch and minor; a major gets its own ticket), each batch on its branch with green gates. Use when the monthly update ticket is picked, or an advisory names one of the project's dependencies.
---

# Dependency update

Every change of a dependency asks a person (decision 6): say what the batch is and why before running it.
Commands run in the dev container (skill `dev-environment`), so lock files are written for Linux.

## 1. List (read-only)
| Ecosystem | Outdated | Advisories |
|---|---|---|
| npm (NestJS, React) | `docker compose run --rm -T --no-deps <svc> npm outdated --json` | `… npm audit --json` |
| uv (FastAPI) | `… uv tree --frozen --outdated --depth 1` | `… sh -c 'uv export --frozen --no-hashes > /tmp/req.txt && uvx pip-audit -r /tmp/req.txt'` |
| .NET | `… dotnet list package --outdated` | `… dotnet list package --vulnerable --include-transitive` |
| Base images | `FROM` and compose `image:` tags against the image's releases | the image's security notes |

Write the list in the ticket: name, current, wanted, latest, advisory (id and severity).

## 2. Batches, in this order
1. **Security:** every dependency with an advisory, at the lowest version that fixes it, a batch per ecosystem.
2. **Patch and minor:** the rest within the current major, a batch per ecosystem (`npm update`, `uv lock --upgrade` then `uv sync`, `dotnet add package <name> --version <v>` per package).
3. **Majors:** never in this ticket. File each as a ticket of its own with the release notes' breaking changes (skill `report-issue`, `[Follow-up]`).
4. **Base images:** a batch of their own (the Dockerfile `FROM` and compose `image:` changes ask too).

## 3. Each batch
1. Branch `chore/deps-<ecosystem>-<yyyy-mm>` from `dev`; update in the dev container; commit the manifest and the lock file together (`chore(deps): …`, the versions in the body).
2. `docker compose up -d --build --renew-anon-volumes --wait`, then the gate (`forge gates`); a failure is fixed in the same batch or the package is held back and listed.
3. Review pass and `forge merge` as for any ticket.

## Done when
- the ticket lists every outdated and vulnerable dependency, with what was done for each;
- every advisory is fixed or has a written reason and an owner;
- each batch is merged with green gates; majors and held-back packages are tickets of their own.
