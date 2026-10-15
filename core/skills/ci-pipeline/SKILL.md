---
name: ci-pipeline
description: Setting up or changing a project's CI from the kit's templates (GitLab CI or GitHub Actions) - the secret scan, the gate run inside the service's dev image, the production image built on every merge request and pushed from dev, tagged with the commit (decisions 72-74). Use when a repository gets its first pipeline, when a service is added, or when the gate command or an image name changes.
---

# CI pipeline

The templates are `core/ci/gitlab/checks.gitlab-ci.yml` and `core/ci/github/checks.yml`. They were run
job by job with `tests/ci/run.sh` (a Docker-in-Docker machine and a local registry standing in for the
host) on every stack sample, and lint clean (GitLab's CI schema, actionlint). Editing CI files asks a
person (decision 6): show them the diff.

## The jobs (required checks)
| Job | Does | Fails when |
|---|---|---|
| `secret-scan` | gitleaks over the whole history | a secret was ever committed |
| `gates` | `docker build --target dev`, then `GATE_COMMAND` in that image, with the Docker socket for Testcontainers | the gate fails, the lock file is out of date, the dev target does not build |
| `build-image` | builds the production image (the Dockerfile's last stage); on `dev` (`PUSH_BRANCH`) logs in to the host's registry and pushes `<registry>/<project>/<IMAGE_NAME>:<commit SHA>` | the Dockerfile is broken |
| `android` (a mobile app; `android.gitlab-ci.yml` / `android.yml`) | builds the Dockerfile's `android` target for `linux/amd64` and the app bundle in it (`android/ci-bundle.sh`): debug-signed on merge requests; on a release tag `vX.Y.Z` signed with the upload key from the protected variables (GitHub: the job `android-release`, in the `release` environment), kept as an artefact | the Android build is broken |

Pipelines run on merge requests and on pushes to `dev`, `staging` and `main`, and with a mobile app on release
tags too. Only `dev` pushes images (decision 73); staging and production deploys come with the next release.
A mobile app has no `build-image` entry: it ships to the stores (decision 111). `forge new` writes all of this.

## Steps
1. Copy the template: GitLab, `include:` it from `.gitlab-ci.yml` (or copy it there); GitHub, to `.github/workflows/checks.yml`.
2. Set `GATE_COMMAND` to the project's gate without the compose wrapper: what follows `sh -c` in `policy.gates.full` (stack guides, `project.json`). Set `CONTEXT` (the folder with the Dockerfile) and `IMAGE_NAME` (`api`, `web`).
3. Several services in one repository: a matrix (GitLab `parallel: matrix`, GitHub `strategy.matrix`) over `CONTEXT`, `IMAGE_NAME` and `GATE_COMMAND`, in both `gates` and `build-image`. Example lines are in the templates' header.
4. Contract repository: add `contract.gitlab-ci.yml` / `contract.yml` as well (skill `api-contract-design`).
5. A mobile app: add the `android` template (`forge new` does), with `CONTEXT` set to the app's folder; in a repository with several parts, GitLab builds it on a merge request only when the app changed.
6. Server side, by a person (`core/server/<host>.md`), with section 4b for the Android signing key: "Pipelines must succeed" / required status checks `secret-scan`, `gates`, `build-image`; GitLab runners with Docker-in-Docker (privileged, `/certs/client` volume); GitHub `packages: write` is in the template.
7. Push the branch and open the MR/PR: the jobs run; fix until green (skill `pipeline-debug`).
8. After the first merge into `dev`: the image `<IMAGE_NAME>:<SHA>` is in the project's registry.

## Rules
- Never weaken a job to get green: no `allow_failure`, `continue-on-error`, `|| true`, skipped tests or removed jobs. A flaky check is a bug: file it (skill `report-issue`).
- No secrets in the YAML. The registry login uses what the host provides (`CI_REGISTRY_PASSWORD`, `GITHUB_TOKEN`).
- Job names stay as in the template: the branch protection lists them. In GitLab a job cannot be called `image` (a reserved keyword).
- Pin images by tag (`docker:29.8.2-cli`, the gitleaks version); updating them asks like any dependency.

## Done when
- the three jobs run on every MR/PR into `dev`, `staging` and `main` and are required checks;
- `gates` runs the same gate as `policy.gates.full`, inside the dev image;
- a push to `dev` puts `<IMAGE_NAME>:<commit SHA>` in the registry; MRs/PRs push nothing;
- the CI diff was shown to and approved by a person.
