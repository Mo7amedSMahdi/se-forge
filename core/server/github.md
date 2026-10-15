# Server setup checklist: GitHub

The server is the layer agents cannot switch off. Set this up once per client repository, before any agent works in it. Each item says what it enforces and what is available on which plan; where a plan cannot enforce an item, the fallback says what still holds.

Plan facts (GitHub docs, checked 2026-10-06):
- Branch protection: public repositories on every plan; private repositories need GitHub Pro (personal accounts) or GitHub Team / Enterprise Cloud (organizations).
- Rulesets: GitHub Team and Enterprise.
- Environments in private repositories: GitHub Pro and Team. Required reviewers and wait timers on Free, Pro and Team: public repositories only.

## 1. Branches: `dev`, `staging`, `main`  (gates: merge to dev, promotions; decisions 74, 75)

`forge init` creates `dev` and `staging` from `main`; push them once (`git push -u origin dev staging`).

- [ ] Settings → General → Default branch: **`dev`** (pull requests target it unless told otherwise).
- [ ] A protection rule for **`dev`** (or a ruleset on Team/Enterprise): require a pull request, with **0 approvals** (the lead agent merges finished tickets with `forge merge`, as the developer who runs it, and GitHub never lets that person approve their own pull request); require the status checks below; require review from Code Owners when the project has a `CODEOWNERS` file (3), so a ticket touching security-sensitive paths or the spec waits for that person; allow force pushes **off**, deletions **off**.

A protection rule for **`staging`** and one for **`main`** (or one ruleset for both):

- [ ] Require a pull request before merging, with **at least 1 approval**.
- [ ] Dismiss stale approvals when new commits are pushed.
- [ ] Require approval of the most recent push (the person who pushed last cannot approve).
- [ ] Require review from Code Owners, if the client allows a `CODEOWNERS` file (see 3).
- [ ] Require status checks to pass: `secret-scan`, `gates` and `build-image` from `core/ci/github/checks.yml`; require branches to be up to date.
- [ ] Require conversation resolution.
- [ ] Do not allow bypassing the above settings (applies to admins too).
- [ ] Allow force pushes: **off**. Allow deletions: **off**.

GitHub never lets authors approve their own pull request. Agents push as the developer who runs them, so a second person approves every promotion.

**Fallback (private repository on GitHub Free):** no branch protection exists. The local policy hook still denies agent merges (except `forge merge` into `dev`, which checks gates and reviews itself) and pushes to `dev`, `staging` and `main`, but a human can merge anything. Recommend Pro/Team to the client; record the gap in the project's config notes.

## 2. Required checks  (gate: done)

- [ ] Copy `core/ci/github/checks.yml` to `.github/workflows/checks.yml` and set `GATE_COMMAND` (and `CONTEXT`, `IMAGE_NAME`; skill `ci-pipeline`). The `gates` job fails until it is set.
- [ ] Mark `secret-scan`, `gates` and `build-image` as required (1).
- [ ] Settings → Actions → General → Workflow permissions: the default token may stay read-only; the workflow asks for `packages: write` on `build-image` only, to push `IMAGE_NAME:<commit>` to ghcr.io from `dev` (decision 73).

## 3. Sensitive code  (gate: auth, permissions, payments, personal data)

- [ ] If the client allows it, add `.github/CODEOWNERS` naming the people who approve security-sensitive paths (the same globs as `paths.sensitive` in the project's policy config) and turn on "Require review from Code Owners" (1).
- [ ] Every pull request gets the security-reviewer's report (kept in the team repo, not on the PR).

**Fallback (no CODEOWNERS file allowed):** the 1-approval rule applies to every promotion; into `dev`, the local hook asks a human before agents edit sensitive paths or implement a security-gated plan, and `forge merge` needs the security-reviewer's approval.

## 4. Production deploys and infrastructure  (gate: production, infra apply)

- [ ] Create an environment `production`; under "Deployment branches and tags" allow only `main` (and release tags if used).
- [ ] Store production credentials **only** as `production` environment secrets. Never as repository secrets, never on developer machines.
- [ ] Add required reviewers to `production` and turn on "Prevent self-review". Available for private repositories only on GitHub Enterprise.
- [ ] Run `terraform apply` only in a job bound to that environment, from a reviewed plan.

**Fallback (private repository on Free, Pro or Team):** keep the branch restriction and environment secrets, make production deploy and apply jobs `workflow_dispatch` only, and limit who has write access. The local hook denies applies, production deploys and production credentials either way.

## 4b. The Android app's signing key  (a repository with a mobile app; decision 111, skill `mobile-release`)

- [ ] Create an environment `release`; under "Deployment branches and tags" allow only tags matching `v*`. The `android-release` job uses it on release tags.
- [ ] Its secrets: `ANDROID_KEYSTORE_BASE64` (`base64 -i upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`; its variable `API_URL`, the production API. Never repository secrets: the pull request job `android` has no access to them and builds debug-signed.
- [ ] (Team or Enterprise) A tag ruleset for `v*`: restrict creations to the people who release.
- [ ] Mark `android` as a required status check, next to the others (1).
- [ ] The upload key itself lives in the team's password manager, never in a repository or on a laptop's disk. Google Play App Signing keeps the app signing key.

## 5. API contract  (gate: contract; in the repo that owns the spec)

- [ ] Copy `core/ci/contract-check.sh` to `ci/contract-check.sh` and `core/ci/github/contract.yml` to `.github/workflows/contract.yml`; set `SPEC` and the `paths` filter to the spec's folder; mark `contract` as a required status check (1).
- [ ] (Team or Enterprise) A tag ruleset for `api-v*`: restrict creations, updates and deletions to the people who approve contracts.
- [ ] If the client allows it, a `.github/CODEOWNERS` entry for the spec's folder, with "Require review from Code Owners" (1).

**Fallback (no tag rulesets):** limit write access to the repository; the `contract` job still checks every spec change and every `api-v*` tag against `info.version`. The local hook asks a person before agents edit the spec or create an `api-v` tag.

## 6. Repository settings

- [ ] Secrets and variables: managed by humans only (agents are denied `gh secret` and `gh variable`).
- [ ] Merge button: prefer squash or rebase merges for a linear history.
- [ ] Turn on secret scanning and push protection where the plan offers them.

## Check it

- [ ] A test pull request with a failing `gates` job cannot be merged.
- [ ] A pull request approved only by its author cannot be merged.
- [ ] `git push origin dev` (and `staging`, `main`) from a developer machine is rejected by the server (the local hook rejects it first; test with the hook off).
- [ ] A pull request that removes a required response field without a new major `info.version` fails the `contract` job.
