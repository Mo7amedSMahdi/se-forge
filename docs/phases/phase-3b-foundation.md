# Phase 3b: git hooks, light mode, trackers, pacing, kit CI

Branch `phase-3b/foundation` (local only; nothing pushed). Started 2026-10-07 after phase 3a was merged into `main`.

Decisions taken for this phase:
- Install `glab` on the development machine to test the GitLab adapter against the real CLI.
- Light mode is the `/ticket` command; full mode stays `/pipeline`.
- Pacing resumes through a scheduled prompt in the open session.

## Built

- **Cleanup.**
  - The original author's `.omc/` state is removed.
  - The budget paragraph repeated in 9 roles is removed: the hooks and `LANES.md` carry it.
  - `frontend-engineer-complex` is folded into `frontend-engineer`; the lead spawns it with `model=opus` for complex stories.
  - The handover script now creates `.forge/handoffs/` when it is missing.
- **Trackers.**
  - GitLab adapter (`glab`):
    - one `status::<name>` label per issue;
    - Done, Closed and Resolved close the issue;
    - issue links for "relates";
    - board columns are label lists;
    - the dry run writes nothing.
  - GitHub adapter: the bash 3.2 crash and the dry run that created labels are fixed.
  - OpenProject and the Jira stub are removed (decision Q20).
  - `forge tracker help` works without the tracker's CLI.
  - `forge doctor` checks for the tracker's CLI and jq.
- **Git hooks** (`core/githooks/`), for people and agents alike, also in lane worktrees.
  - pre-commit: no kit files (not even with `git add -f`), no secrets, the project's `policy.commit.checks` on the staged files.
  - commit-msg: Conventional Commits. With `project.coAuthor: false` the AI co-author line is removed, and Claude Code's own `attribution` is turned off in the local settings.
  - A hooks path the project already had (husky, lefthook) is remembered and still runs.
- **Light mode, `/ticket`** (skill `ticket`), the default way to work.
  - One agent runs it: understand, plan (`plan-ticket`), branch and build with tests, draft PR/MR, `forge gates`, the review pass with separate read-only reviewers, author fixes (2 rounds at most), ready PR/MR, tracker status, `forge save`.
  - `review-pass` covers both modes: in light mode the author fixes blockers, in full mode a fix lane does.
- **Commands that never worked** (checked with the real CLI):
  - A skill shadows a command of the same name, so the `pipeline`, `backend-change`, `plan-ticket` and `handover` commands never ran. They are removed; the skills run as before.
  - A command cannot make Claude run a skill marked `disable-model-invocation`, so `/bootstrap` and `/review` did nothing. The pipeline's own step 4 failed the same way.
    - `review-pass` can now be loaded by Claude.
    - `bootstrap-project` is renamed `bootstrap`, so `/bootstrap` runs it directly.
    - A test checks every command for both problems.
- **Pacing** (opt-in per developer, subscriptions only).
  - `forge setup --pacing on|off`; `forge sync` adds or removes the kit's status line.
  - `extras/pacing/statusline.mjs` replaces `statusline.sh` and `usage.sh`. It needs no jq and records the usage to `.forge/state/usage.json`; the old scripts wrote to the template's `.claude/state` and `.omc` paths.
  - Same thresholds as the original: amber at 75 % (5-hour) or 80 % (weekly), red at 90 %. A window past its reset counts as empty.
  - Red:
    - the lead may not spawn agents;
    - the pause message gives the exact one-time cron expression for the resume;
    - the lead and each lane get one note per level.
  - The `pacing` skill: hand over, schedule `/resume lead-handover` with `CronCreate`, stop.
  - `forge pacing` shows the level; doctor reports it. Off whenever `ANTHROPIC_API_KEY` is set.
- **The team folder is part of the workspace** (found by the live `/ticket` run).
  - `.forge/project` links to a folder outside the checkout, so Claude Code asked before every plan or report read and write, and refused it in unattended runs.
  - `forge sync` now adds that folder to `permissions.additionalDirectories`.
  - The safety hooks map its real paths back to `.forge/project/...`: `project.json` still asks, and restricted roles keep their limits.
  - Writes to the kit overrides (`.forge/project/kit/**`) now ask a person, like other agent config.
- **Smaller live findings:**
  - The pause message named the lead's handover so that the script made `lead-handover-handover.md`.
  - `plan-ticket` ran `forge tracker get` on a plain description.
  - The project facts showed the raw gate command, so agents skipped `forge gates` and no result was recorded.
- **Kit CI** (`.gitlab-ci.yml`): the test suite on Node 22 for merge requests, main and tags; a tag must equal `v<VERSION>`.
- **Docs.** `CHANGELOG.md` (Keep a Changelog 1.1.0), README (commands, commits, pacing, requirements, releases), policy README (commit checks, git hooks, pacing rule, state files; `kit.version` is an exact pin, not a minimum).

## Tested

| What | Result |
|---|---|
| `npm test` on macOS | 318/318 |
| `npm test` on Linux, in the CI image | 316/316 and 2 skipped (the real `glab` and `gh` checks; neither is installed there). The first run found the `forge tracker help` bug. |
| Tracker adapters | Fake `gh`/`glab` that log every call, run under macOS's bash 3.2. Every subcommand and flag is checked against the installed `glab` 1.121.0 and `gh` 2.82.1. |
| Git hooks | Real commits: message format, co-author on and off, a staged secret, `git add -f` of kit files, commit checks, chaining to husky, a commit in a lane worktree |
| Pacing | Thresholds, reset times, the pause on spawns, one note per agent, session start, the status line fed Claude Code's input, opt-in and opt-out through `forge`, a status line of the developer's own kept |
| Live harness: `githooks`, `ticket`, `pacing` (new; real Claude Code, Haiku, about $1.00 in all) | **githooks 4/4** on the first run: a lane's non-conventional commit refused in its worktree, the retry conventional, no AI co-author line with `coAuthor: false`, attribution off. **pacing**: run 1 refused the spawn live with the pause and scheduled the one-time resume at the right time, but found the handover-name bug; after the fix 4/4 (the lead paused on the session-start warning without trying to spawn). **ticket**: run 1 3/7 found the team-folder permission problem; runs 2 and 3 found the raw gate command and a harness prompt that Haiku read as "skip the review"; run 4 7/7 (plan in the team folder, branch pushed, `forge gates` green, separate `code-reviewer` with its report in the team folder, main untouched, nothing visible to git). In none of the runs did Haiku do the last step, `forge save`. |

## Learned about the platform

- **Skills and commands.** Checked with Claude Code 2.1.29x:
  - A skill and a command with the same name: the skill runs.
  - A command cannot make Claude run a skill marked `disable-model-invocation`; only a person typing `/<skill>` can.
  - A project command named `/review` overrides the built-in one.
- **Status line input.** `rate_limits.five_hour` and `seven_day`, each with `used_percentage` and `resets_at` in epoch seconds. Read from the CLI's own code, because the docs host was unreachable. `rate_limits` is null with an API key.
- **Folders outside the checkout.** Claude Code asks before reading or writing outside the working directory, even through a symlink and in `acceptEdits` mode. `permissions.additionalDirectories` (plain absolute path) removes the prompt; checked live.
- **Scheduled prompts.** `CronCreate` is available in headless runs too. Jobs live only in the session and fire only while it is idle.
  - So a pause resumes by itself only if that session stays open; otherwise the developer runs `/resume`.
  - Claude Code also offers a wake-up timer, but it is capped at one hour, too short for a reset hours away.

## Open

- **`v0.1.0` tag**: made locally once this phase is merged into `main`.
  - CHANGELOG link references wait for the GitLab project's URL.
- **`forge doctor` server check**: still needs a real GitLab project.
- **Unsaved plans.** Haiku skipped the final `forge save` in every live `/ticket` run, so plans and reports stayed uncommitted in the team repo. `forge doctor` warns about it. A reminder hook when the lead stops with unsaved changes is a candidate for a later phase.
- **Pacing across sessions**: Claude Code has no durable schedule, so a closed session needs `/resume` by hand after the reset.
- **Windows**: not supported (macOS first, by decision).
- **Next**: phase 4 (backend, database and security agents, ticket routing, contract-first).
