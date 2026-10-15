# Server setup checklist: GitLab

The server is the layer agents cannot switch off. Set this up once per client project, before any agent works in it. Each item says what it enforces and which tier it needs; where a tier cannot enforce an item, the fallback says what still holds.

Tier facts (GitLab docs, checked 2026-10-06):
- Protected branches ("Allowed to merge", "Allowed to push and merge", force push off): Free.
- "Pipelines must succeed": Free.
- Required approvals, approval rules, and the approval settings (prevent approval by the creator, by users who add commits): Premium.
- Code Owner approval on protected branches: Premium.
- Protected environments and deployment approvals: Premium.

## 1. Branches: `dev`, `staging`, `main`  (gates: merge to dev, promotions; decisions 74, 75)

`forge init` creates `dev` and `staging` from `main`; push them once (`git push -u origin dev staging`).

Settings → Repository → Branch defaults:

- [ ] Default branch: **`dev`** (merge requests target it unless told otherwise).

Settings → Repository → Protected branches:

- [ ] `dev`: Allowed to merge: **Developers + Maintainers** (the lead agent merges finished tickets with `forge merge`, as the developer who runs it); Allowed to push and merge: **No one**; Allowed to force push: **off**.
- [ ] `staging` and `main`: Allowed to merge: **Maintainers**; Allowed to push and merge: **No one**; Allowed to force push: **off**.

Settings → Merge requests:

- [ ] Merge checks: **Pipelines must succeed**; **All threads must be resolved**. These hold for `dev` too: `forge merge` cannot merge a red pipeline.
- [ ] (Premium) Approval rules targeting the protected branches **`staging`** and **`main`**: at least **1** approval. None for `dev`: an approval rule there would stop the lead's merge.
- [ ] (Premium) Approval settings: **Prevent approval by merge request creator**, **Prevent approvals by users who add commits**, **Prevent editing approval rules in merge requests**, **Remove all approvals when commits are added to the source branch**.

Agents push as the developer who runs them, so with these settings a second person approves every promotion.

**Fallback (Free):** approvals cannot be required. Include `core/ci/gitlab/approval-check.gitlab-ci.yml`: on merge requests into `staging` or `main`, its job fails until someone other than the author approves, and "Pipelines must succeed" then blocks the merge. Re-run the job after approving.

## 2. Required checks  (gate: done)

- [ ] Include or copy `core/ci/gitlab/checks.gitlab-ci.yml` and set `GATE_COMMAND` (and `CONTEXT`, `IMAGE_NAME`; skill `ci-pipeline`). The `gates` job fails until it is set.
- [ ] "Pipelines must succeed" (1) makes `secret-scan`, `gates` and `build-image` blocking.
- [ ] Runners: the Docker executor with Docker-in-Docker, as GitLab's docs describe (`privileged = true`, a `/certs/client` volume). GitLab.com's hosted Linux runners have it; for a runner in Docker on a Mac, see `GUIDE.md`, A4. Without it, `gates` and `build-image` cannot start Docker.
- [ ] Settings → General → Visibility: **Container registry** on (`build-image` pushes `IMAGE_NAME:<commit>` from `dev`; decision 73).

## 3. Sensitive code  (gate: auth, permissions, payments, personal data)

- [ ] (Premium) If the client allows it, add `CODEOWNERS` naming the people who approve security-sensitive paths (the same globs as `paths.sensitive` in the project's policy config) and turn on "Require approval from code owners" on `dev`, `staging` and `main`: a ticket touching those paths then waits for that person before `forge merge` can merge it.
- [ ] Every merge request gets the security-reviewer's report (kept in the team repo, not on the MR).

**Fallback (Free, or no CODEOWNERS allowed):** the approval rule (or the approval-check job) applies to every promotion; into `dev`, the local hook asks a human before agents edit sensitive paths or implement a security-gated plan, and `forge merge` needs the security-reviewer's approval.

## 4. Production deploys and infrastructure  (gate: production, infra apply)

- [ ] Store production credentials **only** as CI/CD variables that are **protected** (available on protected branches and tags only) and **masked**. Never on developer machines.
- [ ] (Premium) Protect the `production` environment: allowed to deploy = Maintainers; required approvals ≥ 1.
- [ ] Production deploy and `terraform apply` jobs: `environment: production`, `when: manual`, rules limited to `main` (or release tags), from a reviewed plan artefact.

**Fallback (Free):** protected variables plus `when: manual` jobs on `main` only, and Maintainer role kept to the people allowed to release. The local hook denies applies, production deploys and production credentials either way.

## 4b. The Android app's signing key  (a repository with a mobile app; decision 111, skill `mobile-release`)

- [ ] Protect tags `v*` (Settings > Repository > Protected tags): allowed to create = Maintainers. The `android` job signs only on these release tags.
- [ ] CI/CD variables, each **protected** and **masked**: `ANDROID_KEYSTORE_BASE64` (`base64 -i upload.jks`, one line), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; and `API_URL`, the production API. Merge request pipelines never see them, so their bundle is debug-signed.
- [ ] The upload key itself lives in the team's password manager, never in a repository or on a laptop's disk. Google Play App Signing keeps the app signing key.
- [ ] The job builds for `linux/amd64`: an x86-64 runner, or a runner on Apple silicon whose Docker emulates amd64.

## 5. API contract  (gate: contract; in the repo that owns the spec)

- [ ] Copy `core/ci/contract-check.sh` to `ci/contract-check.sh`, include `core/ci/gitlab/contract.gitlab-ci.yml`, and set `SPEC` and the `changes:` path to the spec's folder. "Pipelines must succeed" makes the `contract` job blocking.
- [ ] Protect tags `api-v*` (Settings > Repository > Protected tags, wildcard; all tiers): allowed to create = Maintainers, or on Premium the named people who approve contracts.
- [ ] (Premium) `CODEOWNERS` entry for the spec's folder, with "Require approval from code owners" on `dev`, `staging` and `main` (contract MRs go into `dev`; `forge merge` leaves them to a person anyway).

**Fallback (Free):** `forge merge` never merges a spec change (a person merges it), and the approval rule (or the approval-check job) covers it on promotion; protected tags still keep `api-v*` with Maintainers. The local hook asks a person before agents edit the spec or create an `api-v` tag.

## 6. Project settings

- [ ] CI/CD variables: managed by humans only (agents are denied `glab variable`).
- [ ] Push rules where available: reject unsigned commits if the team signs, prevent pushing secret files.

## Check it

- [ ] A test merge request with a failing `gates` job cannot be merged.
- [ ] A merge request approved only by its author cannot be merged (Premium rule, or the approval-check job on Free).
- [ ] `git push origin dev` (and `staging`, `main`) from a developer machine is rejected by the server (the local hook rejects it first; test with the hook off).
- [ ] A merge request that removes a required response field without a new major `info.version` fails the `contract` job; a Developer cannot push an `api-v*` tag.
