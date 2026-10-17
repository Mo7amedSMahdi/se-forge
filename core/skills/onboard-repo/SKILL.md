---
name: onboard-repo
description: Bringing an existing client repository under the kit - set it up with forge init, take stock of its stack, tests, containers, CI and branches, record its existing choices in the decision register, propose its project settings, and file every gap against the team's decisions as a ticket instead of fixing it during onboarding. Use when the team takes over or joins a repository that was not started with forge new.
---

# Onboarding an existing repository

Onboarding changes nothing in the client's code: it records what is there and files what is missing.

## Steps
1. **Set up** (a person): `forge init --project <slug> --new`, push `dev` and `staging` if they do not exist yet and protect the branches (`core/server/<host>.md`), `forge doctor`.
2. **Take stock** (read-only), each with the files it comes from:
   - stack and versions: manifests and lock files, runtime version files, the database and its migration tool;
   - how it runs: Dockerfiles (a `dev` target?), compose files, `.env.example`, start scripts;
   - tests: frameworks, where they are, how long the suite takes, whether it passes now (run it in a container: skill `dev-environment`);
   - CI: the host, the jobs, which are required, registry use;
   - the API: an OpenAPI spec? Its version and tags (`api-v*`)?
   - conventions in use: error shape, pagination, naming, branches, commit messages.
3. **The register:** write `.forge/project/bootstrap/decisions.md` (skill `discovery`'s format) with the existing choices as decisions marked `existing`, so agents follow them; questions the code cannot answer go to the owner.
4. **Settings:** match the stack to a stack guide (`stack-*`, `db-*`) and write the proposal `.forge/project/bootstrap/project.proposed.json` from its `project.json` snippet, adapted to the repository's paths (folders, `dir` per service); `forge config check` it; applying it asks the owner.
5. **Gaps:** compare with the team's decisions and the guides (dev containers and the gate inside them, the CI template, a `dev` target, health route, problem details, tests per side, contract first, branches). File one ticket per gap, ordered by risk (`[Follow-up]`, `--source ai`, skill `report-issue`); none of them is fixed during onboarding.
6. **Report** to the owner: the stack, what works, the gaps and their tickets in a few lines, then the open questions as choices (skill `ask-owner`); then `forge save`.

## Done when
- `forge doctor` is green or its warnings are listed in the report;
- the register records the existing choices, and the settings proposal passes `forge config check`;
- every gap with the team's decisions is a ticket, and the client's code is unchanged.
