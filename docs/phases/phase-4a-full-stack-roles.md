# Phase 4a: full-stack roles, ticket routing, contract first

Branch `phase-4a/full-stack-roles` (local only; nothing pushed). Started 2026-10-07 after phase 3b was merged into `main` and tagged `v0.1.0`.

Decisions taken for this phase (audit section 9):
- 25: Claude Code only, on subscriptions. Phase 7 is dropped.
- 26: the MVP deploys to Docker containers only; no cloud provider. Phase 5 is replanned around containers.
- 27: the planner decides a ticket's areas; tracker labels are a hint.
- 28: the contract lives in the backend repo (in a single repo, at a fixed path).
- 29: a contract change has its own merge request that a person approves; a person tags `api-v<semver>`.
- 30: OpenAPI 3.1 only.
- 31: security reviews against OWASP ASVS Level 2, with STRIDE threat models.
- 32: Redocly CLI and oasdiff check the spec.
- 33: team API style defaults.

## Built

- **Roles.**
  - New: `backend-engineer` and `db-engineer` (lanes, done gate, budgets); `security-reviewer` (ASVS Level 2, spawned with opus), `db-reviewer` and `spec-checker` (read-only).
  - Updated: `planner` (`Areas:` and `Contract:` lines, items db → api → ui, grouped by repo when frontend and backend are separate), `contract-analyst` (owns contract drafts in `.forge/project/contracts/`, never the repo's spec), `frontend-engineer`, `qa-engineer`, `code-reviewer`, `product-analyst`.
- **Routing.** The plan's areas pick the engineers, one after another on the ticket's branch in the order db → api → ui, and the reviewers (code always; db, spec, security and Figma when they apply). `infra` goes to the backend engineer until phase 5 adds a container role. `/ticket`, `/pipeline` and `review-pass` follow it.
- **Contract first, enforced.**
  - The spec of a repo that owns the contract asks a person before an agent edits it, once per branch; unattended, it is refused.
  - Creating, moving or deleting an `api-v*` tag asks a person.
  - `backend-engineer` and `frontend-engineer` start only on a plan whose `Contract:` names a version that is an `api-v` tag here or the version the project pins. `pending` waits; database lanes do not.
- **`forge api`.**
  - `check`: Redocly lint, oasdiff breaking changes against the newest `api-v` tag, and the version rule (a changed spec needs a higher `info.version`, a breaking change a new major). `--spec` checks a draft.
  - `fetch`: the spec at `project.api.pin`, from this repo or the backend repo, bundled to JSON.
  - `generate`: the project's client generator on that spec.
  - Tools pinned: `@redocly/cli@2.59.0` through npx; oasdiff installed or `tufin/oasdiff:v1.33.0`.
- **Client CI.** `core/ci/contract-check.sh` with templates for GitLab CI and GitHub Actions; on an `api-v` tag pipeline the tag must equal `info.version`. Server checklists: protected `api-v*` tags, CODEOWNERS for the spec, fallbacks per plan.
- **Skills.** New: `api-contract-design` (with `style.md`, the team API style), `data-model-design`, `threat-model`, `new-endpoint`, `add-entity`, `db-migration`, `integrate-api`. Updated: `plan-ticket`, `review-pass`, `pipeline`, `ticket`, `api-sync`.
- **Config and facts.** `project.api.{spec, contractRepo, pin}` and `project.db.{image, migrate, rollback, urlEnv}`, injected as project facts; `forge doctor` reports the contract.

## Tested

| What | Result |
|---|---|
| `npm test` on macOS | 333/333, and 1 opt-in test skipped |
| `npm test` on Linux, in the CI image | 331/331, 3 skipped (real `glab`, real `gh`, the opt-in real-tools test) |
| Contract rules | Spec edits ask once per branch and are refused unattended; a consumer repo does not guard a file at the spec's path; `api-v` tag creation, moves and deletes ask, other tags and listing do not; API and UI lanes refused on an untagged or pending contract, allowed once tagged or pinned; database lanes never wait; reviewers may run only `forge api check` |
| `forge api` with stand-in tools | First version, additive change with and without a version bump, breaking change with a minor and a major bump, lint failure, the newest tag as the base (pre-release tags ignored), a draft outside the repo, fetch and generate in a consumer repo from the backend repo's tag (an untagged work-in-progress change is not picked up), clear errors without a pin or with an unknown one |
| `forge api` with the real tools (opt-in) | Two-file YAML spec: Redocly lint and bundle, oasdiff (Docker) finds the removed required field, the version rule asks for 2.0.0 and accepts it |
| CI script, in `node:22-bookworm` with the real tools | Unchanged; additive with a minor bump; breaking with a minor bump (fails); breaking with a major bump; a tag pipeline whose tag differs from `info.version` (fails) |
| Live harness, real Claude Code (Haiku) | New `contract` scenario 3/3: an API lane on an untagged version, an `api-v` tag and a spec edit each refused. `gated` and `lane` rerun after the spawn-check change: 7/7. About $0.19 |

## Proposals to confirm

`style.md` fills in details beyond the six style points you approved. Change any of them, or tell me to drop them:
- kebab-case path segments; non-CRUD actions as `POST /v1/orders/{orderId}/cancel`;
- POST that creates returns 201 with `Location`; PATCH takes JSON Merge Patch;
- IDs are strings; enum values UPPER_SNAKE_CASE;
- validation errors add `errors: [{ field, message }]` to the problem details; 422 for a broken business rule;
- lists: `limit` (default 20, max 100), `cursor`, and `{ items, nextCursor }`; sorting `sort=field,-other`.

Other defaults I chose:
- the `infra` area goes to the backend engineer until phase 5;
- approval of a spec edit is recorded per branch, like the security gate (an ADR still asks every time);
- the security reviewer runs on opus.

## Open

- **No end-to-end full-stack run yet.** The new backend and database skills have not run on a real backend: they are stack-neutral, and 4b brings the stack samples (.NET 8, Node + TS, FastAPI; four databases) to run them on.
- **4b decisions:** the migration tool per backend, the Node framework, how MongoDB migrations are handled.
- **Separate repos** are tested with local repos only (fetch by tag from a local path), like the rest of the kit until the GitLab group exists.
- **GitHub tag protection** needs Team or Enterprise; the fallback is in the checklist.
- **Phase 5** needs a new plan for the Docker-only target.
