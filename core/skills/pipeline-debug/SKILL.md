---
name: pipeline-debug
description: Finding why a CI pipeline failed and reproducing it locally with the same image and command - reading the failed job's log (glab ci / gh run), matching it to the known causes, fixing the code or the configuration, never the check. Use when a merge request's pipeline is red, when forge merge reports a red pipeline, or when CI and local results disagree.
---

# Debugging a pipeline

## Steps
1. **Find the failed job and its log** (read-only; allowed):
   - GitLab: `glab ci status --compact` (the current branch's pipeline), `glab ci get -s failed -F json` (its failed jobs), then `glab ci trace <job name> > /tmp/job.log 2>&1`. Not `glab ci view`: it is an interactive screen.
   - GitHub: `gh run list --branch <branch> --limit 5`, then `gh run view <id> --log-failed > /tmp/job.log 2>&1`.
   Read the end of the log first (`tail -80 /tmp/job.log`), then search up from the first error.
2. **Name the failing job and step**: `secret-scan`, `gates` (dev image build, or the gate inside it), or `build-image` (production build, or the push).
3. **Reproduce locally with the same image and command** (skill `ci-pipeline` for the commands):
   - `gates`: `docker build --target dev -t gate <CONTEXT>` then `docker run --rm -v /var/run/docker.sock:/var/run/docker.sock --add-host host.docker.internal:host-gateway -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal -e CI=true gate sh -c '<GATE_COMMAND>'`. `docker build` sends the folder as it is, uncommitted files included; to see what CI sees, run it in a clean checkout of the pushed commit (`git worktree add /tmp/ci-check <sha>`, then remove it).
   - `build-image`: `docker build <CONTEXT>`.
   - `secret-scan`: `docker run --rm -v "$PWD:/repo" ghcr.io/gitleaks/gitleaks:v8.30.1 git /repo --redact --no-banner`.
4. **Match the known causes** below; otherwise read the failing test or build step as you would locally.
5. **Fix the cause** in the code, the Dockerfile or the lock file, with a commit of its own (`fix(ci): …` or the area's scope). Push; the pipeline runs again. A rerun without a change (`glab ci retry`, `gh run rerun`) asks a person: use it only for an infrastructure hiccup you can name.
6. A cause outside your ticket (a flaky test elsewhere, a runner without Docker-in-Docker): file it (skill `report-issue`) and tell the lead.

## Known causes
| Log says | Cause | Fix |
|---|---|---|
| Testcontainers cannot find or reach Docker (the message differs per language), or its containers time out | The gate container cannot reach Docker | The template's socket mount, `--add-host … host-gateway` and `TESTCONTAINERS_HOST_OVERRIDE` are missing or changed; GitLab: the runner lacks privileged Docker-in-Docker (a person fixes the runner) |
| `lock file … out of date`, `npm ci` can only install … in sync, `--frozen` | The lock file was not committed with the manifest change | Update and commit the lock file in the dev container |
| `failed to lookup address`, `Temporary failure in name resolution` during a build | DNS on the runner | Rerun once (asks a person); if it repeats, report the runner |
| `cannot connect to the Docker daemon at tcp://docker:2376` | The `docker:dind` service is missing, or the TLS settings differ | Keep the template's `services:` and `DOCKER_TLS_CERTDIR` |
| `denied`, `unauthorized` on push | The registry is off, or the token lacks the scope | GitLab: the container registry enabled for the project; GitHub: `packages: write` (in the template) |
| The pipeline is rejected before any job runs, naming a job such as `image` | GitLab's reserved top-level keywords cannot be job names | Keep the template's job names (`build-image`) |
| gitleaks finding | A secret in the history | Do not just delete the line: the owner rotates the secret, then the history is cleaned; tell the lead |
| Passes locally, fails in CI | Local runs used the mounted tree (uncommitted files) or a host toolchain | Reproduce with step 3 from a clean checkout |

## Done when
- the failing job, step and cause are named in the ticket comment or the report;
- the cause is fixed in code or configuration (never by weakening, skipping or removing a check), or filed as an issue when it is outside the ticket;
- the pipeline is green on the branch's last commit.
