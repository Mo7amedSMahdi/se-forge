# Phase 3a: structure, copy-mode delivery, forge CLI, team repo

Branch `phase-3a/structure` (local only; nothing pushed). Started 2026-10-06 after phase 2 was merged into `main`.

Decisions taken for this phase:
- Both repos live in a GitLab group (name to come); the kit's CI runs on GitLab CI.
- `forge` is installed with `npm install -g` from a git tag.
- `forge save` commits plans and reports straight to the team repo's main branch.
- The phase 2 defaults are accepted.

## Built

- **Structure.**
  - `core/` holds the knowledge: rules, roles, skills, policy engine, CLI, tracker, server checklists, CI jobs.
  - `adapters/claude/` holds the Claude Code wiring: the renderer, commands, and the local settings template.
  - `extras/pacing/` holds the optional pacing scripts.
  - `template/` is empty until the starter (phase 6).
  - Content moved with `git mv`.
- **Delivery by copy, not by plugin** (decided after review, see below).
  - `forge init` / `forge sync` write the project's pinned kit version into the checkout: the engine to `.forge/kit/`, generated agents, skills and commands to `.claude/`, hooks and permissions to `.claude/settings.local.json`.
  - Every written path is listed exactly in `.git/info/exclude`, so the client's own `.claude/` files stay visible and untouched.
- **Per-project versions.**
  - `project.json` `kit.version` is an exact pin. forge fetches the pinned version once by tag from the kit repo and caches it.
  - `forge upgrade --to <version>` moves a project and removes files the new version dropped.
  - A checkout whose kit differs from the pin leaves agents read-only until `forge sync`.
- **Per-project overrides** in the team repo: `<project>/kit/roles`, `skills`, `commands` and `rules.md` replace or add whole files and are layered over the kit.
  - Generated files edited in place, or client files with the same name, stop `forge sync` instead of being overwritten.
  - Agents may not edit generated files.
- **Roles.**
  - `core/roles/*.md` are tool-neutral.
  - `adapters/claude/render.mjs` (from the pinned version) turns them into Claude agents.
  - `forge sync` records each role's access, so roles added by overrides are enforced too.
  - Tool access is expressed as `disallowedTools`, so Figma tools are not pinned to one connector's names (decision Q23).
- **Rules without committed files.**
  - SessionStart injects `core/AGENTS.md` (5 KB, was 15 KB), the project's `kit/rules.md` and the project facts.
  - SubagentStart adds `core/LANES.md` for every lane.
- **`forge` CLI:** setup (`--team-repo`, `--kit-repo`), init, sync, upgrade, doctor, save, gates, tracker, handover, version.
  - `gates`, `tracker`, `handover` and `save` run with the checkout's own kit version.
- **Docs-only roles:** planner, analysts, designer and tracker clerk write only under `.forge/` and run only inspection and `forge` commands.
- **Content.**
  - Skills, roles and commands refer to the project facts instead of baked-in values.
  - Review and QA reports go to `.forge/project/reviews/<ticket>/`.
  - `backend-change` is a skill.
- **Removed:** `init.sh`; the plugin manifests that existed briefly in this phase.

### Why copy instead of a plugin
A plugin is Claude Code's documented distribution path, and this phase first built one. Review raised two limits:
- A plugin installs per user, with one marketplace per name. Every project on a machine therefore runs the same kit version.
- A plugin can't be customized per project beyond its config.

A live probe confirmed that git-excluded files in a checkout's `.claude/` load as usual:
- skills, commands and agents all appear;
- a lane defined only in an excluded file spawns in its own worktree;
- hooks from an excluded `.claude/settings.local.json` fire inside that worktree.

So the kit is copied per checkout. Codex and Copilot (phase 7) read project files the same way.

## Tested

| What | Result |
|---|---|
| `npm test` | 286/286 on macOS and Linux (Node 22) |
| `forge` CLI tests | 13/13: init copies the kit and leaves the client's `git status` clean and its own files untouched; overrides win and override roles are enforced; edits in place and same-name client files stop sync; upgrade fetches a tagged version from a kit repo, regenerates and removes dropped files, and back; a teammate's newer pin makes agents read-only until sync; doctor; save; handover |
| Injection size | lead and lane injections under 9,500 characters with a fully filled project |
| Live harness, real Claude Code on sample clients set up with `forge init` only (copy mode) | 35/35 checks over 12 scenarios (about $0.66). Covers the injected rules reaching the lead and lanes, every earlier phase 2 check, and a new one: nothing from the kit is visible to git after a full lane run |

## Learned about the platform

- **Excluded files load.** Claude Code reads a checkout's `.claude/` regardless of git: excluded agents, skills, commands and local settings work, including for lanes in worktrees (verified live).
- **Plugins.** A plugin's `CLAUDE.md` is not loaded. Plugins install per user (one marketplace name per user), so they cannot pin versions per project.
- **Rules.** Excluded rule files don't reach lanes: a lane worktree has no untracked files. Hence the hook injection, capped at 10,000 characters per hook.
- **`AGENTS.md`.** A `CLAUDE.local.md` would stop Claude from reading a client's `AGENTS.md`; hook injection avoids that.

## Open (phase 3b and later)

- **Phase 3b:**
  - git hooks (secret scan, staged lint/format, commit message), with the per-project co-author setting, which also covers Claude Code's own attribution;
  - light and full modes as skills;
  - GitHub adapter fixes and the GitLab adapter;
  - removing the OpenProject adapter, the Jira stub, the original author's committed `.omc/state`, the duplicated budget text in the roles, and `frontend-engineer-complex`;
  - opt-in pacing extras;
  - CHANGELOG and the `v0.1.0` tag;
  - the kit's own GitLab CI.
- **`forge doctor` server check:** it doesn't check server gates yet. That needs a real GitLab project to test against.
- **Install commands** in the README use a placeholder group name until the GitLab group exists, and `--kit-repo` fetching is tested against a local repo only.
- **One gap from the Q8 decision:** a client's existing `.claude/settings.json` (committed by the client) still applies alongside the kit's local settings. Claude Code merges both, and deny rules always win.
