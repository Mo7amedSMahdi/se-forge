# System mode: existing systems and change requests (plan)

Branch `plan/system-mode` (local only). 2026-10-15. Phase S1 is built (branch `phase/s1-system-workspace`,
decisions 133-134); S2-S4 are still plans.

Today the kit starts from requirements and builds a new app (`/bootstrap`, then `/pipeline`). This plan adds the
other half of the work: **an existing system the kit did not build**, made of several repositories, databases and
services (Keycloak, MinIO, SigNoz, …), which the kit first understands as if it had built it, and then changes
through **change requests**, at the kit's production standard.

## Decisions (audit section 9)
- **130 One lead across all repos.** One session plans and builds a whole change request. Its agents work in a
  worktree of whichever repository their ticket changes; gates, tests and merges stay per repository.
- **131 One board for the system.** Every epic, story and ticket of the system lives in one GitLab project's
  issues, labelled with the repository it changes (`repo::<name>`).
- **132 New code at the standard; old gaps listed.** Everything a change request writes or touches meets the kit's
  standard (tests per side, gates, security review, UI review, end-to-end flows). The existing gaps go into a
  baseline backlog by risk, and the owner chooses which are fixed and when.
- **133 A merge that deploys is a person's.** When a repository's base branch deploys on merge (for example
  `develop` to a test server), the lead prepares the merge request (gates, reviews and QA passed, marked ready) and
  stops; a person merges. Branches that deploy nothing are merged by the lead as today. (The safe default, taken
  while the owner had not chosen; a setting per repository can change it.)
- Not new, restated: **secrets stay out.** The system description lists environment variable names and who
  provides each value, never the values; the kit keeps refusing to read `.env` files, and nothing secret reaches
  the team repo.

## Words
- **System:** the whole app: its member repositories, databases and services. One folder in the team repo.
- **Member repository:** one Git repository of the system (a backend, a frontend, a worker, an infrastructure repo).
- **Workspace:** the folder on a Mac holding every member repository side by side, set up by forge.
- **As-built baseline:** the kit's documents describing the system as it is, approved once by the owner.
- **Change request (CR):** a change to the system, with its own folder, stories, tickets and review.

## The system description (the input)
The owner fills `inputs/system.md` in the system's team folder from a template the kit provides. Its headings:

1. **What the system is:** who uses it, for what, the main flows, the business words.
2. **Repositories:** for each, its name, Git address, role (backend, frontend, mobile, worker, infra, library),
   stack and versions, base branch and release branches, and who owns it.
3. **Databases:** each with its engine and version, the repositories that use it, and its migration tool.
4. **Services:** Keycloak, MinIO, SigNoz and any other: version, how it runs (container, cloud, shared server), and
   which repositories use it for what (realms and clients, buckets, exporters …).
5. **Environments:** local, test, staging, production: where each runs and how it is reached. Read only: the kit
   never connects to staging or production.
5a. **CI/CD per repository:** which workflows run on which branches and events, and what each deploys where.
6. **Environment variables:** per repository, each variable's name, what it is for, whether it is a secret, and
   who provides it. Never a value.
7. **Documents:** links to existing specifications, API docs, designs and runbooks.
8. **Constraints and wishes:** rules the system must keep (compliance, languages, browsers, performance), and
   what the owner wants from the kit.

`forge system check` turns it into `system.json` (the machine-readable part: repositories, roles, branches,
services, the board) and reports what is missing, the way `forge config check` does for `project.json`.

## Phase S1: the workspace and building across repositories (built)
As built: `forge system check`, `forge system init`, `forge lane open|close`, `forge merge` from the root, the
`repo::<name>` label, the dashboard across repositories, GUIDE.md part F. Two live findings changed the design
(decision 134): an isolated agent may not use git outside its own worktree, so the root's agents are not isolated
and the lead gives each its lane; and the lead's `cd` persists into its agents, so the hooks take the session's
folder, not the current one, as the system's root, and keep agents out of a member's main checkout.

What a change request needs before anything else: one lead that can build in every member repository.

- **Nothing moves.** "Clone" means a local working copy on the Mac, like a developer's `git clone`: each
  repository's `origin` stays the original GitHub or GitLab repository, its pipelines and deploys keep running there,
  and nothing of the kit is committed to it (local files, excluded by `.git/info/exclude`). forge creates and renames
  no branch in an existing repository: it uses the base and release branches the system description names.
- **`forge system init`** reads `system.json`, clones every repository into the workspace
  (`~/code/<system>/<repo>`), runs `forge init` in each against the same team folder, and creates the lead's
  home: the workspace root, a local Git repository holding only the kit's files (never pushed), with the member
  repositories inside it but excluded.
- **Team folder layout:** `<system>/system.json`, `<system>/repos/<repo>/project.json` (each repository's own
  settings: gates, tests, paths, containers), and the shared `bootstrap/`, `changes/`, `plans/`, `reviews/`,
  `progress/` folders.
- **Lanes in any repository:** a plan names its repository (`Repo:`), and the lead gives each lane a worktree of
  that repository. The hooks already apply each repository's own rules in its folder (0.2.18); the lane rules,
  hand-over copying, gates and limits learn the repository too.
- **One ticket, one repository.** A change request becomes several tickets, ordered across repositories (contract,
  then database, then services, then screens). `forge merge <ticket>` merges in the ticket's repository and closes
  the issue on the system board.
- **The board:** `forge tracker` uses the system's GitLab project for every repository; labels `repo::<name>`.
- **The dashboard** covers the system, with a repository column and filter.
- **Test bed:** a sample system built for this, on local Git remotes: two APIs in two repositories (NestJS with
  PostgreSQL, FastAPI with MinIO), a React frontend, and Keycloak in front of both APIs. A fake GitLab board, as in
  the live harness.

## Phase S2: `/onboard`, understanding the existing system
Stages, like the bootstrap's, each writing to `<system>/bootstrap/`:

1. **Intake:** the system description checked, the workspace set up, `forge doctor` in every repository, and a
   cost estimate from the size of the code before the deep read starts (the owner says go).
2. **Inventory per repository** (scripted where it can be): the file tree, manifests and versions, how it runs
   (Dockerfiles, compose), the tests and whether they pass now (in a container), CI, API routes, migrations and
   the data model, environment variable names read in the code, calls to other services.
3. **Deep read:** every file read once, by area agents per repository (one per module), each writing
   `as-built/<repo>/<area>.md`: the features, their rules, the data they touch, the endpoints, the permissions, the
   tests, and the risks.
4. **The as-built documents,** the same set the bootstrap writes, describing the system as it is:
   - the decision register, every existing choice marked `existing`;
   - user stories as built, with acceptance criteria from the code and its tests, and a traceability table from
     each story to its files and tests;
   - the authorization matrix, including Keycloak's realms, clients and roles;
   - the architecture across all repositories (C4 context, containers and components), ADRs for the existing
     choices;
   - an API contract per service (its own OpenAPI file, or one drafted from the code and marked as such);
   - the data model per database, and the map of services (buckets, realms, exporters);
   - the design system and the screens (from the code, and pictures once phase S4 runs the system);
   - the non-functional facts that can be observed, and those that are unknown.
5. **Baseline report:** the gaps against the kit's standard (tests, gates, security, UX, operations), by risk. Each
   becomes a backlog issue labelled `baseline`, not ready: the owner chooses (decision 132).
6. **The panel** (the requirements panel's seats) checks that the understanding is right and complete.
7. **The owner's single review** approves the baseline. From then on, every merged ticket updates the as-built
   documents it touched, so the baseline stays true.

## Phase S3: `/change`, change requests
Each change request gets `<system>/changes/<CR-id>/` with the owner's request and screens in `inputs/`.

1. **Discovery** against the baseline's register: questions only for what is new or unclear.
2. **Impact:** which repositories, services, contracts, migrations (expand and contract), permissions and screens it
   touches; the risks; how it rolls out without breaking what runs.
3. **Stories:** new ones and changed as-built ones; epics.
4. **Architecture, contract and design changes:** ADRs, versioned contract changes per API, new or changed screens.
5. **Tickets per repository,** in order, each with its estimate, areas and gates.
6. **The panel**, then **the owner's single review**, then the tickets on the system board, ready for `/pipeline`.

## Phase S4: the whole system on a Mac
- One Compose setup for the system: each repository's own services plus the shared ones (Keycloak with a seeded
  realm, MinIO with its buckets, SigNoz if the owner wants it), on one network, with health checks.
- `forge app up` starts the system; end-to-end tests run across services; QA takes the screens' pictures.

## The quality bar (decision 132)
- A repository without a gate (no tests, no container) gets one in the first ticket a change request puts there:
  nothing in it can be "done" without one.
- New and changed code: the kit's gates, tests per side, the security review (OWASP ASVS level 2, or the level the
  register sets), the UI review against the screens, and end-to-end flows; the per-ticket limits apply.
- Old code is not rewritten on the way: its gaps stay in the baseline backlog until the owner picks them.

## Order and checks
S1, S2, S3, S4, one branch each, each tested on the sample system with live sessions before the owner's review,
the way earlier phases were. S2 needs S1 (it reads every repository); S3 needs S2's baseline; S4 can move earlier if
the owner wants screens in the baseline.

## Not decided yet (asked when their phase starts)
- How deep the security baseline goes (static checks only, or dependency audits and secrets scanning of history).
- Whether SigNoz is part of the local system, or only described.
- How large a system can be before the deep read is split across several sessions.
