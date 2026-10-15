# Phase 1: audit of the AI-orchestration template and migration plan

Date: 2026-10-06 · Status: **decisions recorded (section 9); waiting for approval to start phase 2** · Scope: no changes to the template

Source audited: `ai-orchestration-template-main.zip` (94 files, 157 KB), extracted to a scratch directory. `se-forge/` was empty and is not a git repository yet; this file is the only thing written to it.

**How it was verified**
- Every file was read.
- The installer was run under bash 5 in a container and under macOS bash 3.2.
- Every hook was replayed with crafted inputs and with real hook payloads captured from Claude Code.
- Four short headless Claude Code sessions (`claude -p`, Haiku, v2.1.291, about $0.24 in total) checked the live harness. They ran in throwaway repos with a local bare remote and fake secrets.
- Documentation came from the Claude Code docs (code.claude.com), the Copilot and VS Code docs, agents.md and agentskills.io.
  - The OpenAI Codex docs host refused connections, so the Codex facts come from the `openai/codex` source (commit 404cd42) plus search snippets. They are marked as such.
  - Where the docs were unreachable or unclear, the claim was tested instead (sections 3 and 4).

---

## 1. Summary

1. **The core idea is sound and worth keeping.** That covers the lead/lane model, plan before code, separate author and reviewer, handovers, conflict tasks, no sub-agents from lanes, and the tracker adapter interface.
2. **Most of the hard guarantees the README claims do not hold in practice.**
   - The context cap never fires for a lane.
   - The "done" gate never runs for a lane, and when it does run it ignores tests.
   - All 7 guard bypasses you listed get through `guard.sh`. Claude Code's own Read deny rule catches only one of them (`sed -n p .env`); the other 6 executed in a live session.
3. **Parallel lanes in one working tree corrupt each other's branches.** Reproduced: lane A's commit landed on lane B's branch. Claude Code's documented `isolation: worktree` fixes this; verified live.
4. **The deny rule `git add .*` blocks all dotfile paths.** Agents cannot commit `.gitignore`, `.github/workflows/*`, `.env.example` or `.claude/*` (verified live).
5. **The installer is copy-once.** It needs bash 4, which macOS does not ship. On an existing project it keeps the old `CLAUDE.md`, so the kit's rules never reach the agents.
6. **Plans, reviews and QA verdicts live in `.omc/`, which is gitignored.** They never leave the developer's machine, and a lane worktree would not see them.
7. **Two plugin facts verified live shape the redesign.**
   - A plugin cannot carry permission rules. Its `settings.json` deny rule was ignored.
   - A plugin agent's own `hooks:` block does not run.

   Hooks therefore ship in the plugin's shared `hooks.json`, and permissions are written by the `forge` CLI into each developer's local, git-excluded `.claude/settings.local.json`.
8. **Recommendation, as updated by the decisions in section 9.**
   - Distribute a versioned Claude Code plugin from this repo, plus a small `forge` CLI (Node.js).
   - The CLI sets up only local, git-excluded files in a client checkout: permissions, git hooks, rules, and the project config pulled from the private team repo `se-forge-projects`. Nothing from the kit is committed to client repos.
   - Rewrite the hooks as one tested policy engine (Node.js).
   - Put the "cannot be switched off" gates on the server: protected branches, approvals by a non-author, CODEOWNERS, protected environments.
   - Local hooks give fast feedback and force a human click at the gates.

---

## 2. What each part does, and its state

| Part | What it does | Verified | Verdict |
|---|---|---|---|
| `init.sh` | Copies `template/` into a repo once and fills 14 `{{PLACEHOLDERS}}` with `sed`. Merges an existing `.claude/settings.json` with `jq` and never overwrites. | Fresh install OK on bash 5. A re-run skips all 58 files, so there is no upgrade path. On an existing project, settings merge correctly, but the existing `CLAUDE.md` is kept, so the kit's rules are not loaded. On macOS bash 3.2 it refuses to start. | Replace |
| `CLAUDE.md` (15 KB, ~3.7k tokens) | Standing rules, model routing, agent/skill index, lead checklist, lane rules, OMC section. | Loaded by the lead and by every lane. | Split: a lean core `AGENTS.md`, with details moved into skills. Remove OMC. |
| `.claude/settings.json` | 22 deny rules, 5 hook wirings, status line. | See section 3. | Rebuild as allow / ask / deny |
| 11 agents | scout, tracker-clerk, planner, contract-analyst, product-analyst, designer, frontend-engineer(+complex), code-reviewer, figma-ui-reviewer, qa-engineer. | 10 of them carry the same context-budget block. Reviewers have Bash and write into the plan, so they are read-only by prompt only. 4 tool entries are pinned to the claude.ai Figma connector's tool names. | Keep the roles and fix the wiring |
| 10 commands | Thin wrappers that invoke skills. | n/a | Fold into skills |
| 9 skills | pipeline, bootstrap-project, plan-ticket, figma-align, review-pass, api-sync, handover, token-watcher, tracker | The skill content is mostly good. token-watcher is broken (section 3.3). | Keep the content and restructure; replace token-watcher |
| `session-start.sh` | Startup briefing and the list of pending handovers. | Works. Prints "cap 250k, hand over at 200k" and passes `200000` to the watcher even when the env says 100k/120k (hard-coded). | Rewrite as a health check |
| `guard.sh` | Regex guard on Bash, Edit and Write. | Catches the basic forms. Misses all 7 cases you listed plus 16 more (section 3.2). | Rewrite |
| `output-guard.sh` | Blocks heavy commands whose output is not redirected. | Works. Trivially bypassed (`cmd; true > /dev/null`), which is acceptable for a feedback-only hook. | Keep and drive from config |
| `no-subagents.sh` | Blocks Agent/Task/Workflow calls made from a lane. | **Works:** blocks when `agent_id` is present, allows the lead. The docs say subagents can spawn subagents (up to 5 levels), so this hook is still needed. | Keep |
| `context-budget.sh` | Warns and "blocks" a lane by its context size. | **Never fires for a lane, and cannot block** (section 3.3). | Replace |
| `task-gate.sh` | Refuses "done" when work is uncommitted or unpushed. | Wired to `TaskCompleted`, which never fires when a lane finishes. Passes with a failing test suite (section 3.5). | Replace |
| `statusline.sh`, `usage.sh` | Plan usage pacing (5-hour and weekly windows). | Subscription-only. RED tells the lead to "run the pause skill", which does not exist. | Move to optional extras |
| Tracker: dispatcher plus a 6-function adapter interface | `tr_get`, `tr_list`, `tr_create`, `tr_status`, `tr_comment`, `tr_statuses` | The interface is good. | Keep |
| Tracker: OpenProject adapter | API v3 via curl | Implemented. The token is passed in curl's argv (`-u apikey:$TOKEN`), so it is visible in `ps`, which breaks the template's own rule. | Remove (decision Q20) |
| Tracker: GitHub adapter | `gh` with labels | Crashes on macOS bash 3.2 whenever `GH_REPO` is unset (`_R[@]: unbound variable`). With `TRACKER_DRY_RUN=1` it still creates labels for real. | Keep and fix |
| Tracker: GitLab and Jira adapters | Stubs that exit 3. | n/a | GitLab: implement; Jira: remove (decision Q19) |
| `handover.sh` | Scaffolds a handover in the **main** worktree with git facts. | Already worktree-aware. | Keep |
| `.omc/state/*` (committed) | n/a | The original author's local session data: home path, session id, cost, rate limits. | Remove |

---

## 3. Results of the checks you asked for

### 3.1 Parallel lanes sharing one working tree on different branches: broken

Reproduced with plain git:

```
lane A: git checkout -b feat/1-login;   echo … > login.ts          (not committed yet)
lane B: git checkout -b feat/2-invoice; echo … > invoice.ts        (same tree)
lane A: git add login.ts && git commit -m "feat(login): …"         (explicit path, as the rules say)
→ lane A's commit landed on: feat/2-invoice
→ feat/1-login tip: still the base commit
```

`HEAD` is shared, so the "explicit paths only" rule cannot protect a lane. Every `checkout` also carries the other lane's uncommitted files along.

**Fix, verified live:** an agent with `isolation: worktree` ran in `.claude/worktrees/agent-<id>`, and the worktree and its branch were removed automatically because the lane left them clean.

### 3.2 Guard bypasses

Three layers were tested separately: `guard.sh` alone (replayed), Claude Code's deny rules, and the full harness in a live session with Bash pre-allowed.

| Command | guard.sh | Live harness | Note |
|---|---|---|---|
| `git push origin x:main` | allowed | **ran** | Tested as `feat/x:develop`; develop is the protected branch in the test |
| `git push -fu origin x` | allowed | **ran** | `-f` combined with other flags is not recognised |
| `git push origin +x` | allowed | **ran** | A `+` refspec is a force push |
| `sed -n p .env` | allowed | blocked | Blocked by Claude Code's `Read(**/.env)` rule, which also applies to `sed`/`cat`/`head` in Bash. The guard missed it. |
| `cat .env.staging` | allowed | **ran, printed the fake secret** | Only `.env`, `.local`, `.production`, `.development` and `.visual` are listed |
| `rm -rf src` | allowed | **ran, `src/` deleted** | Only paths outside the repo are checked |
| `git reset --hard` | allowed | **ran** | Not covered at all |

Other bypasses found while reading `guard.sh`, all allowed:
- **Pushes:** `git push origin main:main`, `git push origin x:refs/heads/main`, `git -C . push origin main`, `git push --mirror`
- **Discarding work:** `git clean -fdx`, `git checkout -- .`
- **Reading secrets:** `nl .env`, `cat .env.test`, `cat config/.env.prod`, `python3 -c 'open(".env")…'`
- **Generated client:** `echo x > <generated dir>/client.ts`, which is a Bash redirect into the generated client
- **Merges and hook skips:** `gh api -X PUT …/pulls/1/merge`, `git commit -n` (the short form of `--no-verify`)
- **Not in the original scope at all:** `terraform apply`, `psql -c "DROP TABLE …"`
- **File tools:** `MultiEdit` and `NotebookEdit` are not handled; `Write .env.staging` is allowed.

**What it does catch, verified:** `git push origin main|develop`, `--force`, `-f`, `cat .env`, `cat .env.local`, `--no-verify`, `gh pr merge`, `rm -rf` outside the repo, `curl … | bash`, `printenv`. No false positives on `git push -u origin feat/…`, `cat .env.example`, `rm -rf node_modules`, or redirected test runs.

**Root cause:** the guard matches regexes against the whole command string, so any spelling it does not anticipate passes. The fix is to tokenise the command and reason about git's actual arguments (refspecs, combined flags, `-C`), with every case above kept as a regression test.

### 3.3 Context-budget hook: it does not detect lanes and cannot block

- **Detection.** Inside a lane, the hook's `transcript_path` is the **lead's** transcript. This was checked against real payloads, not the docs. The hook only acts when the path contains `/subagents/`, so it exits early for every lane. In a live run with warn = 3k and block = 5k, a lane at about 11k ran all of its commands.
  - The real lane signals are `agent_id` and `agent_type` on every tool event, and `agent_transcript_path` on `SubagentStop`.
- **Blocking.** The hook runs on `PostToolUse`, after the tool has already run. Per the docs, `decision: "block"` there only sends a message back to the model.
  - Live check: a hook that always returned "block" made a lane stop after its first call. The lane's own words were "I've hit the context budget limit and can no longer make tool calls".
  - So the model complied voluntarily, and nothing would refuse the next call. A real block has to come from `PreToolUse` (deny).
- **No token count in the hook input.** None of the documented hook payloads carries a token count; this was checked against real payloads. The only documented context figure is the status line's `context_window`, and only for the main session.
- **The token watcher is fragile.**
  - It guesses the transcript folder as "repo path with `/` → `-`", but Claude Code also converts `_` and `.`. For `/Users/me/code_repos/…` it looks for `-Users-me-code_repos-…`, while the real folder is `-Users-me-code-repos-…`. Result: "no subagents directory", i.e. it never sees a lane on the paths this team uses.
  - It also reads `~/.claude-vscode/…` and undocumented `.meta.json` files.

### 3.4 Does the deny rule `git add .*` block committing dotfiles? Yes

Live: `git add .gitignore` and `git add .github/workflows/ci.yml` were both denied with "Permission to use Bash with command … has been denied". Under this rule an agent can never commit CI pipelines, `.gitignore`, `.env.example`, `.claude/` config or `.github/` files.

The intended target, `git add .` and `-A`, should instead be blocked by the policy hook, which can tell a bulk add from an explicit dotfile path.

### 3.5 Does "done" require passing tests? No, and for lanes not even a commit

- **The gate never runs for lanes.** `task-gate.sh` is wired to `TaskCompleted`. That event belongs to task lists and agent teams, and it fired **0 times** when a lane finished in the live run. A lane finishing fires `SubagentStop`, which carries `agent_type`, `cwd`, `agent_transcript_path` and `last_assistant_message` (verified).
- **It ignores tests.** In a repo with everything committed and pushed and a failing test suite (exit 1), `task-gate.sh` exited 0 and allowed completion.
- **Tests run only by instruction.** They run only if the qa-engineer agent follows its prompt.

### 3.6 A session started without the "start script"

The template has no start script. The closest things are:
- the token watcher, which the lead is told to start by hand;
- the `SessionStart` hook, which runs automatically.

Without the watcher, nothing monitors lanes, and nothing else limits them either (section 3.3). The `SessionStart` hook only reminds the lead, and it shows hard-coded thresholds.

---

## 4. Documented platform facts that shape the design

Claude Code. ✔ = verified by running it, 📄 = from the docs.

- ✔ Plugin `hooks/hooks.json` hooks fire for the lead **and inside lanes**.
- ✔ A plugin's `settings.json` **cannot carry permissions**: a plugin deny rule was ignored. 📄 Only the `agent` and `subagentStatusLine` keys take effect.
- ✔ A plugin agent's `hooks:` frontmatter does **not** run. 📄 For plugin agents, `hooks`, `mcpServers`, `permissionMode` and `initialPrompt` are ignored.
- ✔ Lane payloads carry `agent_id` and `agent_type`; `SubagentStop` adds `agent_transcript_path`, `last_assistant_message` and `stop_hook_active`.
- 📄 A `PreToolUse` deny (exit 2 or `permissionDecision: "deny"`) is a real block. A `PostToolUse` "block" is feedback only.
- 📄 Rule precedence is deny > ask > allow. A hook's "allow" does not skip deny or ask rules. Hook handlers accept an `if` field written in permission-rule syntax.
- 📄 `Stop` and `SubagentStop` can refuse to stop (`decision: "block"`), and the agent keeps working. The docs require a loop limit, via `stop_hook_active`.
- ✔/📄 Read and Edit deny rules also cover Bash file commands Claude Code recognises (`cat`, `head`, `tail`, `sed`, `tee`, redirections), but not arbitrary subprocesses such as `python -c`. The sandbox (`sandbox.enabled`) is the operating-system-level option.
- 📄 Subagent frontmatter includes `isolation: worktree` (✔), `maxTurns`, `disallowedTools` (accepts `mcp__server__*`), `model` (alias or full ID), `skills`, `background` and `effort`.
- 📄 Agent teams are experimental and off by default; `TaskCompleted` and `TeammateIdle` belong to them.
- 📄 Managed settings can enforce deny lists that projects cannot remove (`allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `disableBypassPermissionsMode`).
- 📄 `CLAUDE.md` can import `@AGENTS.md`. `.claude/rules/*.md` with `paths:` load only for matching files.
- 📄 Plugin skills are namespaced (`/se-forge:plan-ticket`). Plugins auto-update from their marketplace.

Codex (from the openai/codex source and doc search snippets; the official pages were unreachable):
- It reads `AGENTS.md` from the repo root down to the current directory, within a **32 KiB total** budget.
- Skills live in `.agents/skills` (Agent Skills format).
- MCP servers go in `.codex/config.toml` and are used only in trusted projects.
- Command rules are `.codex/rules/*.rules` (`prefix_rule`, with decisions allow, prompt or forbidden).
- Hooks go in `.codex/hooks.json` and include `PreToolUse`, `PostToolUse`, `Stop`, `SubagentStart` and `SubagentStop`.
- Custom agents are TOML files under `.codex/agents/`.

Copilot (official docs):
- **Instructions:** reads `AGENTS.md` (nearest file wins); the cloud agent and the CLI also read `CLAUDE.md`.
- **Skills:** read from `.github/skills`, `.claude/skills` or `.agents/skills`.
- **MCP:**
  - VS Code: `.vscode/mcp.json` (`servers`)
  - CLI: `.mcp.json`
  - cloud agent: repository settings
- **Hooks:**
  - cloud agent and CLI: `.github/hooks/*.json`
  - VS Code: in preview
- **Custom agents:** `.github/agents/*.agent.md`.

**Consequence:** one `AGENTS.md` and one `.agents/skills/` folder serve both Codex and Copilot. Only MCP files, rules and hooks need per-tool wiring.

### Things you asked for that are not supported, with the closest alternative

| Asked | Status | Closest alternative (recommended) |
|---|---|---|
| A supported way to read a lane's token usage | Not documented | Read the lane's own transcript at the path the harness provides (lead `transcript_path` → `subagents/agent-<agent_id>.jsonl`; `agent_transcript_path` at stop) instead of guessing folders. Enforce in `PreToolUse` (real deny). Backstop with the documented `maxTurns` and a per-lane tool-call count. The transcript format is still undocumented, so the parser is isolated, tested, and falls back to the call count if it breaks. |
| Plugin ships the permissions | Not supported (verified) | The project CLI writes a managed permissions block into `.claude/settings.json` and refreshes it on upgrade. Optional: managed settings for an org-wide deny list. |
| Per-agent hooks in plugin agents | Not supported (verified) | One plugin hook dispatcher applies a per-`agent_type` policy (e.g. reviewers: no writes). |
| Gates that "cannot be switched off" | A developer controls their own machine's settings, so no local mechanism is absolute | The server is the unswitchable layer. Locally, hooks deny or force a human prompt (`ask`). In unattended runs a prompt resolves to deny. |

---

## 5. Keep, change, remove

**Keep, as written by the original author:**
- the lead/lane model;
- plan before code, with questions and recommended defaults;
- author ≠ reviewer;
- `[Story conflict]` / `[Backend request]` tasks;
- no sub-agents from lanes (its hook works);
- the tracker adapter interface (the OpenProject adapter itself is removed by decision Q20);
- `handover.sh` (worktree-aware);
- the Figma "build what has no design, list it" rule;
- the api-sync "never hand-edit generated code" flow;
- the output-guard idea;
- the model routing table.

**Removals, and why:**

| Removed | Why |
|---|---|
| OMC section, `.omc/` naming (77 references) | A personal tool. The local state folder gets a kit name. |
| `.omc/state/*` in the repo | The original author's local session data, committed by accident. |
| token-watcher skill, `ctx*.sh`, transcript-folder helpers in `lib.sh` | They read internal folders by a guessed name and miss every path containing `_`. Replaced by hooks; no start script needed. |
| Context-budget paragraph in 10 agents | Duplicated. One line in `AGENTS.md`; hooks deliver the messages. |
| `frontend-engineer-complex` | Identical to `frontend-engineer` except `model: opus`. The lead passes `model` when it spawns. |
| `statusline.sh`, `usage.sh` | Personal, subscription-only pacing. Moved to `extras/pacing` (opt-in). |
| Jira stub; OpenProject adapter | Not on the team's tracker list (Q19, Q20). The GitLab stub gets implemented instead. OpenProject stays in the `original` commit for reference. |
| `task-gate.sh` on `TaskCompleted` | The event never fires for lanes. Replaced by a `SubagentStop`/`Stop` gate that runs tests. |
| Deny `Bash(git add .*)` and `Bash(git add -A*)` | Blocks every dotfile path. Replaced by a hook rule for bulk adds only. |
| "Otherwise proceed with the defaults" in pipeline step 2 and every bootstrap stage; "unless running unattended" in `/next-ticket` | These let the lead pass through approval gates. Defaults stay allowed only for questions outside the gates. |

---

## 6. Target structure (updated with the decisions in section 9)

### 6.1 The kit repo: `se-forge`

```
se-forge/
├── core/                          # knowledge and logic, tool-neutral
│   ├── AGENTS.md                  # lean standing rules (< 8 KB)
│   ├── roles/                     # 19 role bodies + roles.json (tier, read-only?, tags) → generated per adapter
│   ├── skills/<name>/             # Agent Skills format: SKILL.md ≤150 lines + references/ (per stack) + templates/
│   ├── policy/                    # the hook policy engine (Node.js, no npm dependencies)
│   ├── cli/                       # `forge`: init | sync | doctor | gates | report (Node.js)
│   ├── tracker/                   # dispatcher + adapters: github, gitlab
│   ├── githooks/                  # pre-commit (secret scan, staged lint/format, block kit files), commit-msg
│   ├── ci/github/ · ci/gitlab/    # standard CI jobs (build, test, lint, secret scan, plan/apply with approval)
│   ├── server/                    # server setup checklists for GitHub and GitLab, full vs fallback per plan tier
│   ├── mcp/                       # MCP templates (Figma MCP server, GitHub/GitLab)
│   └── config/schema.json         # project config schema
├── adapters/
│   ├── claude/                    # plugin: .claude-plugin/plugin.json, agents/ (generated), hooks/hooks.json,
│   │                              #   settings.local.template.json (allow / ask / deny)
│   ├── codex/                     # minimal: rules, skills, MCP
│   └── copilot/                   # minimal: rules, skills, MCP
├── template/                      # starter = spec + per-stack recipes + conformance tests
│   ├── spec.md                    #   what every starter must have
│   ├── recipes/                   #   backend: dotnet8, node-ts, fastapi · db: postgres, sqlserver, mysql, mongo
│   │                              #   cloud: aws, azure, gcp, vps · frontend: react-vite
│   └── conformance/               #   automated checks a generated starter must pass
├── extras/pacing/                 # status line, usage pacing, opt-in auto pause/resume (subscriptions only)
├── tests/                         # policy tests (every bypass in this audit), CLI and installer tests
├── docs/                          # audit/, adr/ (kit decisions), cheatsheet.md, metrics-template.md
├── .claude-plugin/marketplace.json
└── CHANGELOG.md · VERSION · README.md
```

### 6.2 The private team repo: `se-forge-projects`

It lives on our own host and is never visible to clients.

```
se-forge-projects/
└── <client>-<project>/
    ├── project.json               # stack per area, folders, gate commands, generated paths, tracker, Figma file,
    │                              #   branches, sensitive paths, co-author on/off, kit version
    ├── bootstrap/                 # stories, ADRs, data model, design map: one approved artefact per stage
    ├── plans/<ticket>-<slug>.md   # committed plans
    ├── reviews/<ticket>/          # reviewer and QA reports (instead of PR comments)
    └── metrics.md                 # delivery time vs estimate, bugs after release, rework, AI cost
```

Approval of a bootstrap stage or an ADR is a merged PR in this repo. Its `main` is protected and needs a non-author approval.

### 6.3 A client repo after `forge init`

- **Committed by the kit:** nothing. The project's CI pipeline (build, test, lint, secret scan) and, where the client allows it, a CODEOWNERS file are ordinary project files with no kit or AI references. Branch protection, approvals and protected environments are host settings, not files.
- **Local only, listed in `.git/info/exclude`:**
  - `.forge/` (project config pulled from the team repo, plan cache, handovers, lane state)
  - `.claude/settings.local.json` (allow / ask / deny and the enabled plugin)
  - `.claude/worktrees/`
  - the rules files the AI tools need
  - git hooks via a local `core.hooksPath`

  `.git/info/exclude` is used instead of `.gitignore` because `.gitignore` is itself committed and would reveal the kit.
- **Client files are never touched.** If the client already has its own `AGENTS.md` or `CLAUDE.md`, the kit leaves them alone and adds its rules locally. How this works is designed and verified in phase 3.
- **Leak protection:** the pre-commit hook and the policy hook refuse to stage or commit any kit file (`git add -f` included).

---

## 7. Design decisions

| # | Decision | Status |
|---|---|---|
| D1 | Hooks and CLI in **Node.js**, no npm dependencies, Node 22 LTS or newer (Node 20 reached end of life in April 2026). One dispatcher process per hook event. The same command (`node …`) everywhere, so a later Windows port needs no rewrite. macOS has no Node by default, so `forge doctor` checks for it. A small, tested shell-command tokenizer for the guard. | Decided (Q4); macOS-first (Q3) |
| D2 | Project config is **JSON** with a JSON Schema. Node parses it natively, and editors validate it through `$schema`. | Proposal, follows from D1 |
| D3 | **Distribution:** a Claude Code plugin from this repo (marketplace, version tags, CHANGELOG), plus the `forge` CLI for the local project files and the team-repo link. `forge sync` upgrades; `forge doctor` checks health. How the CLI is installed (npm from a git tag vs. run from the plugin) is settled in phase 3. | Recommended |
| D4 | **Context budget:** lanes are detected by `agent_id`. Tokens come from the lane's own transcript, found through harness-provided paths. Warn at **100k** with a handover instruction. Hard **deny at 120k** in `PreToolUse`. Backstops: `maxTurns` and a tool-call count. No watcher and no start script. `SessionStart` runs `forge doctor` and the policy denies write tools while the project is unhealthy. | Recommended |
| D5 | **Gates.** Server side: protected `main`, required CI, approval by a non-author, protected production environments, CODEOWNERS where the client allows it. Stage and ADR approvals are merged PRs in the team repo. Local side: deny merges, applies and production deploys; force a human `ask` at gated actions. `forge doctor` reports each gate as **full** or **fallback** per project, because plan tiers vary by client. | Recommended |
| D6 | **Lanes** are subagents with `isolation: worktree`. Branch `feat/<ticket>-<slug>` is cut from `main`. | Verified (worktree) |
| D7 | **Done = gates green.** `SubagentStop` and `Stop` hooks require a clean tree, the branch pushed, and the affected tests passing. A failing agent gets at most 3 retries, after which it is marked `GATES-FAILED`. | Recommended |
| D8 | **Modes.** Light (default): one agent plans and builds, then **separate read-only reviewers** check the work. Full: lead plus worktree lanes. | Decided (Q5) |
| D9 | **Artefacts.** Plans, reviewer reports and QA reports are committed in the team repo; PRs stay clean. Handovers stay local in `.forge/handoffs/`. | Decided (Q9, Q10) |
| D10 | **Phase order:** phase 2 builds the policy engine in `core/policy/` and wires it temporarily, so phase 3 only moves wiring. | Recommended |
| D11 | **Nothing from the kit is committed to client repos** (section 6.3). | Decided (Q8) |
| D12 | **Starter = spec + per-stack recipes + conformance tests.** Generated only after the project's stack stage is approved. | Decided (Q16) |
| D13 | **Stack decided per project**, with no team default. The bootstrap stack stage covers frontend, backend, database and other components (cache, queue, identity, storage, email, search, observability, hosting), with a human-approved ADR per choice. | Decided (Q24) |
| D14 | **AI co-author trailer per project** (`project.json`); the commit-msg hook adds or removes it. | Decided (Q11) |
| D15 | **Pacing extras** for subscription users only, auto pause/resume opt-in, and automatically off when an API key is in use. | Decided (Q22) |
| D16 | **Figma via Figma's MCP server.** Tool names come from config instead of being hard-coded, and `forge doctor` warns when no Figma tools are present. | Decided (Q23) |
| D17 | **Kit testing:** each recipe is tested on its own: each backend once, each database's migrations on one backend, each cloud with `terraform validate` + `plan` only (no account, nothing created), each Git host on a sample repo. The first full end-to-end run is a sample project going through its own stack stage. | Decided (Q24) |

---

## 8. Migration plan

One branch and one PR per phase, with small commits. All branches stay local until a remote exists.

**Setup.**
- `git init` in `se-forge`.
- Commit 1 is the original template verbatim, tagged `original`.
- Then branch `phase-2/safety`.

**Phase 2: Safety fixes**
- Node.js policy engine in `core/policy/`, wired into the current layout:
  - git-aware command guard: refspecs (`x:main`, `+x`, `--mirror`), combined flags (`-fu`), `-C`, discards (`reset --hard`, `clean`, `checkout -- .`);
  - `rm -r` inside the repo goes to `ask`;
  - secret reads: any `.env*` except `.env.example`, key files, script-based reads;
  - file-tool guard (Edit, Write, MultiEdit, NotebookEdit): secrets, generated dirs, protected docs, applied migrations, Terraform state and lock files;
  - bulk `git add` block that still allows explicit dotfile paths;
  - kit files can never be staged;
  - the ask-first categories from Q6;
  - deny for merges, `terraform apply`/`destroy`, production deploys, dropping or truncating tables, production credentials.
- Engineer agents with `isolation: worktree`.
- Lane budget as in D4. Done gate as in D7.
- Remove every "proceed on defaults" path through a gate.
- Server checklists for GitHub and GitLab, plus a minimal required-checks CI job for each.
- **Tests:** every bypass in this audit and more, about 60 cases. They run on macOS and, because it costs nothing, in a Linux container. Windows is out of scope for now. A manual live-harness script (`claude -p`, about $0.25 per run) checks the real wiring.

**Phase 3: Restructure**
- `core/` + `adapters/claude` plugin + marketplace.
- `project.json` + schema, and the `se-forge-projects` layout.
- `forge init|sync|doctor` for fresh and existing projects, with the invisible footprint and `.git/info/exclude`.
- Local git hooks: secret scan, staged lint/format, commit-msg with the co-author setting.
- Plans and reports in the team repo.
- Light and full modes.
- GitHub adapter fixes and the GitLab adapter. OpenProject and Jira removed.
- Personal items removed. `extras/pacing`.
- CHANGELOG, `v0.1.0`.

**Phase 4: Full stack**
- Agents: backend-engineer, db-engineer, security-reviewer, spec-checker, db-reviewer, plus updates to planner, contract-analyst, qa-engineer and product-analyst.
- Ticket tags ui/api/db/infra drive which engineers and reviewers the lead picks. Ordered lanes db → api → ui.
- Contract first: spec approved → backend implements → frontend generates its client. Separate repos pin the approved contract version.
- Skills: plan-ticket, spec-writer, estimate, api-contract-design, data-model-design, threat-model, new-endpoint, add-entity, db-migration, integrate-api, api-sync, write-unit-tests, write-e2e, fix-failing-test, commit-pr.
- Per-stack references for .NET 8, Node + TS and FastAPI, and for the four databases.

**Phase 5: Design, CI/CD and Terraform**
- Agents: architect, devops-engineer, infra-reviewer, performance-reviewer, plus updates to designer and figma-ui-reviewer.
- Design skills: architecture-design, adr-writer, c4-diagrams, nfr-checklist, tech-evaluation.
- Frontend skills: figma-to-component, new-page, form-builder, rtl-i18n-check.
- CI/CD skills, for both GitHub Actions and GitLab CI: ci-pipeline, cd-pipeline, dockerize, env-config, rollback-plan, pipeline-debug.
- Terraform skills, for AWS, Azure, GCP and VPS: tf-module, tf-environment, tf-review, tf-security-scan, infra-baseline, observability-setup, backup-dr, cost-estimate.

**Phase 6: Starter, bootstrap, documentation**
- `template/` spec, recipes and conformance tests. Each backend recipe is generated once and must pass.
- Bootstrap stages: stories → stack and architecture (ADRs) → data model → Figma → API contract → infra baseline → tickets → pipeline. Each stage is approved by a merged PR in the team repo.
- Skills: release, deploy-check, handover-docs, debug-issue, onboard-repo, dependency-update, retro.
- Docs: README, cheat sheet, metrics template.

**Phase 7: Minimal Codex and Copilot adapters**: dropped on 2026-10-07 (decision 25, Claude Code only).

Every phase ends with: what was built, what was tested (with output), what is open.

---

## 9. Decisions recorded (2026-10-06)

| Q | Topic | Decision |
|---|---|---|
| 1 | Git host and CI | **GitHub + Actions and GitLab + GitLab CI, chosen per project** |
| 2 | Plan tiers | Vary by client → each gate reported as full or fallback per project |
| 3 | Developer OS | **macOS is the target.** Windows is deferred; a teammate may fork and port it later. The test suite also runs in a Linux container. |
| 4 | Hook and CLI language | Node.js (22+), no npm dependencies. It keeps a later Windows port cheap, and nothing depends on bash. |
| 5 | Light-mode review | Separate read-only reviewers; the author never reviews its own work |
| 6 | Ask first | Dependency changes · outside network and non-local containers · non-local databases · deleting folders, editing CI, config and ADRs · remote-write actions (ssh/scp/rsync writes, kubectl/helm changes, cloud CLI create/update/delete) |
| 7 | Kit repo | Local git repo; original imported as commit 1 (tag `original`); no remote yet |
| 8 | Client-repo footprint | **Nothing from the kit is committed to client repos**; local files go in `.git/info/exclude` |
| 9 | Sharing config and plans | Private team repo `se-forge-projects`, one folder per client project |
| 10 | Review and QA verdicts | Team repo only; PRs stay clean |
| 11 | AI co-author trailer | Per-project setting |
| 12 | Names | Plugin/kit `se-forge`, CLI `forge`, local folder `.forge/`, team repo `se-forge-projects` |
| 13 | Frontend | React + TypeScript (Vite) for examples; the real choice is per project |
| 14 | Backends | .NET 10 (was .NET 8; see 34), Node.js + TS (NestJS), Python (FastAPI) |
| 15–16 | Starter | Generated at init for the approved stack: spec + recipes + conformance tests |
| 17 | Databases | PostgreSQL, SQL Server, MySQL/MariaDB, MongoDB |
| 18 | Clouds | AWS, Azure, Google Cloud, on-prem/VPS (Terraform throughout) |
| 19–20 | Trackers | GitHub Issues/Projects and GitLab Issues/Boards; OpenProject adapter and Jira stub removed |
| 21 | Branch model | ~~Trunk: `main` only~~ replaced by decision 74 (dev, staging, main); `feat|fix|chore/<ticket>-<slug>`, Conventional Commits (as in the original) |
| 22 | Billing | Subscriptions |
| 23 | Figma | Figma's MCP server |
| 24 | Stack | Decided per project at the bootstrap stack stage; no team default |
| 25 | AI tools | **Claude Code only, on subscriptions** (decided 2026-10-07). No Codex or Copilot adapters: phase 7 is dropped. |
| 26 | Deployment (MVP) | **Docker containers only** (decided 2026-10-07). No cloud provider is used or deployed to; phase 5's Terraform work for AWS, Azure and GCP is replaced by container work. Details are settled in phase 5. |
| 27 | Ticket areas | ui, api, db, infra. **The planner decides** and writes an `Areas:` line in the plan; tracker labels (`area::ui` on GitLab, `area:ui` on GitHub) are input when present. |
| 28 | Contract home | Single repo: a fixed path in it. Separate repos: **the backend repo**, released by tag; the frontend pins the tag. |
| 29 | Contract approval | **Its own merge request, approved by a person** (CODEOWNERS on the spec where the plan allows it); a person tags the approved version `api-v<semver>`; agents ask before editing the spec and never tag on their own. |
| 30 | Contract formats | **OpenAPI 3.1 only**; others when a project needs them. |
| 31 | Security review | **OWASP ASVS Level 2**, only the requirements relevant to the change; threat models use STRIDE; a project may raise it to Level 3. |
| 32 | Spec tools | **Redocly CLI** (lint) and **oasdiff** (breaking changes against the pinned `api-v*` tag). |
| 33 | API style | **Team defaults**, overridable per project: camelCase JSON fields; RFC 9457 problem details (`application/problem+json`) for errors; cursor pagination; major version in the URL (`/v1/...`); ISO 8601 dates in UTC; plural resource names. |
| 34 | .NET version | **.NET 10** (LTS until 2028-11-14) replaces .NET 8, whose support ends 2026-11-10 (decided 2026-10-07). |
| 35 | .NET stack | ASP.NET Core **minimal APIs** grouped by feature; **EF Core** with its migrations; **xUnit**, API tests through WebApplicationFactory, databases through **Testcontainers**. |
| 36 | Node stack | **NestJS** on **Node 24 LTS**. Every project uses **TypeORM**'s connection and migrations (written in SQL); per project, at the stack stage: entities and repositories with raw SQL for complex queries, or raw SQL only. **Vitest** and Supertest, Testcontainers, **oxlint** and Prettier: what the Nest 12 CLI generates (corrected 2026-10-07; first recorded as Jest, which I had wrongly called Nest's default). |
| 37 | Python stack | **FastAPI** with async **SQLAlchemy 2** (ORM with raw SQL for complex queries, or Core/raw SQL only, per project) and **Alembic**; pytest with httpx, Testcontainers; **uv** for dependencies. |
| 38 | MongoDB | MongoDB's **official drivers** in each backend; indexes, validators and data changes as versioned up/down scripts run by **migrate-mongo**. |
| 39 | Frontend tests | **Vitest** with Testing Library for units; **Playwright** for end-to-end. |
| 40 | Estimates | **Hours, as a range**, per plan item and in total, with the main risk; compared with actuals in `metrics.md`. |
| 41 | API style details | The details in `core/skills/api-contract-design/style.md` are accepted (kebab-case paths, 201 + Location, JSON Merge Patch, string IDs, UPPER_SNAKE_CASE enums, `errors: [{field, message}]`, 422 for business rules, `limit` 20/100, `sort=field,-other`). |
| 42 | Bootstrap | **Discovery first** (decided 2026-10-07). The leader interviews the owner until the picture is complete: users and roles, scope, business rules, data, integrations, dependencies, security and privacy, performance, languages and RTL, stack, hosting, priorities. Every answer goes into a decision register (`bootstrap/decisions.md`); agents answer their plan questions from it, and only what it does not cover goes back to the owner. |
| 43 | Checkpoints during the build | Still a person's: promotions to staging and main (was: merging PRs/MRs to main; see 75), production deploys, anything outside the register (a new library, a contract change, an undecided security rule), and security-sensitive code (once per branch). |
| 44 | Artefact approval | After discovery the stages (stories, screens, contract, tickets) run one after the other without stopping; the owner reviews all of them once; then the contract is tagged `api-v1.0.0` and the build starts by itself, tickets one after the other. |
| 45 | Order | The discovery-first bootstrap is built next, before phase 5. |
| 46 | Agents file issues | Any agent that finds a problem outside its own task files an issue instead of fixing or dropping it: `[Bug]` (engineers, QA), `[Follow-up]` (reviewers' non-blocking findings), plus the existing `[Story conflict]` and `[Backend request]`. Labelled `source::ai`, checked for duplicates first, linked to where it was found. Reviewers stay read-only in code but may file issues. |
| 47 | Project manager | A `project-manager` agent reads the board, triages new and changed issues (areas, type, priority, acceptance criteria, duplicates), reports a digest to the leader and a daily summary to the owner. The leader picks only issues labelled `ai::ready`; the PM may add it to a bug that breaks an approved acceptance criterion or contract; everything else new needs a person. |
| 48 | PM trigger | In the open session: the leader calls the PM before picking each next ticket and every 30 minutes (a session timer). No external job or webhook for now. |
| 49 | Design source | Asked in discovery, per project: the kit designs the UI in Figma (designer agent), or the screens come with the requirements as a **Figma file**, a **PDF** or **image files**. Provided screens are implemented in their exact style: from Figma by exact values; from PDF or images through a design-intake step that measures the design tokens (approved once, in the single review) and maps stories to screens; the UI reviewer compares the built pages with the screens. |
| 50 | Done needs tests | A task is done only when every side whose code changed (frontend, backend) has new or changed unit tests that pass, and, when the plan's `E2E:` line names a user flow, an end-to-end test changed and passes; "not applicable" needs a reason. Enforced by the done check (lanes finishing, ready PRs/MRs, done ticket states) through `policy.tests`. |
| 51 | Models per project | Roles keep their tier (fast, standard, deep); `project.models` in `project.json` maps tiers to models per project (default haiku, sonnet, opus), so a new model can be tried on one project with `forge sync`, without a kit release. |
| 52 | API client (frontend) | **openapi-typescript** types and **openapi-fetch** client, generated from the pinned contract (decided 2026-10-08, phase 5 defaults; discovery may override per project). |
| 53 | Data fetching | **TanStack Query** around the generated client. |
| 54 | Routing | **React Router**. |
| 55 | Forms | **react-hook-form + zod**. |
| 56 | UI components | **shadcn/ui + Tailwind**, CSS logical properties for right-to-left. |
| 57 | Languages | **i18next + react-i18next**, `dir` switching for Arabic. |
| 58 | Client state | None by default; **Zustand** when a feature needs shared client state. |
| 59 | Deployment | **Docker Compose on one server**, updated from CI over SSH. |
| 60 | Image registry | **The Git host's registry** (GitLab or GitHub). |
| 61 | Reverse proxy | **Caddy** (automatic HTTPS). |
| 62 | Secrets on the server | **Protected CI variables**, written to an env file at deploy. |
| 63 | Production database | **A container with a named volume and scheduled backups**. |
| 64 | Observability | **Health checks, Docker logs and an error tracker** (self-hosted GlitchTip or Sentry). |
| 65 | Rollback | **Images tagged by git commit, the previous one kept; migrations forward-compatible (expand → contract)**. |
| 66 | ADRs and diagrams | **MADR** decision records; **C4 diagrams in Mermaid**. |
| 67 | Performance | The **performance-reviewer** on request and on plans marked performance-sensitive; **k6** for load tests. |
| 68 | Image colours | A small read-only **`forge design sample`** command for provided images (decision 49). |
| 69 | New roles | **architect**, **devops-engineer**, **infra-reviewer**, **performance-reviewer** (from the brief). |
| 70 | Environments (this release) | **Local containers for development only** (decided 2026-10-08). Staging is added in the next release; there is no production environment for now. Decisions 59 and 61–65 (server deploy, HTTPS, secrets on the server, the production database and backups, the error tracker, rollback) move to that release; 60 (the registry) is used now for images pushed from main. |
| 71 | Local development | **Everything in Compose with hot reload**: the database, the API and the web app run as containers, with the source mounted and each framework's own watcher. |
| 72 | Where tests and gates run | **Inside the dev containers**, for developers and agents alike; Testcontainers reach Docker through the mounted socket. |
| 73 | CI images | CI runs the gate inside the same dev image, **builds the production image on every MR/PR** (a broken Dockerfile blocks merging), and **pushes it from `dev`** (amended by 74; first recorded as main) to the Git host's registry, tagged with the commit. |
| 74 | Branches | **`dev`, `staging` and `main` in every project** (decided 2026-10-08; replaces decision 21's trunk). Tickets branch `feat|fix|chore/<ticket>-<slug>` from `dev` and merge back into it; `dev` is tested locally (decision 70); promotions `dev` → `staging` → `main` (production) are merge requests a person merges. `forge init` creates `dev` and `staging` from `main` when missing; a person pushes and protects them. The policy setting is `branches.base` (was `branches.main`). |
| 75 | Merging into dev | **The leader agent merges a ticket's MR/PR into `dev` itself** (`forge merge`), only when the gates passed on the branch head, every review report (code, security, spec, and db, UI and QA when present) passes for that commit (later commits may only change tests), the MR/PR targets `dev`, and the branch does not change the API contract. Raw merge commands stay refused; merges into `staging` and `main` stay a person's (decision 43 amended: "merging to main" becomes "promotions to staging and main"). |
| 76 | Architecture records | **In the client repository** (decided 2026-10-08): MADR 4.0.0 decision records in `docs/adr/NNNN-<title>.md`, C4 diagrams in Mermaid in `docs/architecture/`, versioned and reviewed with the code. The architect drafts them in the team folder (`.forge/project/architecture/`); a person approves; committing an ADR asks a person. |
| 77 | Load tests | **k6, locally, on request and on plans marked `Gates: performance`**: scripts in the repo's `perf/`, run in the `grafana/k6` container against the running Compose stack, thresholds from the register's non-functional requirements. Not in CI until staging exists (shared runners give noisy numbers). |
| 78 | Starter contents | **A working skeleton, no features** (decided 2026-10-08): configuration from the environment, problem-details error handling, one health route with its test, migrations set up, Dockerfile (dev and production), compose.yaml, CI, the project's settings and `.env.example`. The gate, the migrations and the image pass on day one; the first ticket adds the first feature. |
| 79 | Starter generation | **`forge new`** writes the skeleton from templates kept in the kit; the kit's own tests generate every supported starter and run it on every change. Bootstrap runs it after the stack is approved. |
| 80 | Starter stacks | **The verified pairs**: FastAPI + PostgreSQL, NestJS + MySQL, .NET + SQL Server, NestJS + MongoDB, and React as the frontend. Other pairs when a project needs one, verified before they are offered. |
| 81 | Starter conformance | **Kit checks and style tests**: the kit generates each starter and runs its gate, migrations up/down/up, image build and start, and the dev Compose setup; each skeleton carries API tests that hold the team style (an unknown route and a wrong method answer RFC 9457 problem details; the health route), which agents keep green. |
| 82 | Client releases | **SemVer tags and a changelog**: a release is the promotion to `main` (a person merges it), tagged `vX.Y.Z`; the version and the CHANGELOG section come from the Conventional Commits since the last tag. The `release` skill prepares the promotion MRs, the version and the notes; a person merges and tags. |
| 83 | Dependency updates | **A monthly ticket, run by an agent**, and at once for a security advisory: outdated and vulnerable dependencies updated in small batches (security first, then patch and minor; a major gets its own ticket), each batch on its branch with green gates; every change still asks a person (decision 6). |
| 84 | AI cost in metrics | **Tokens per ticket**: `forge metrics` adds up the lead's and the lanes' tokens for a ticket from Claude Code's local session logs, by model. |
| 85 | Retrospectives | **After each release**: the `retro` skill drafts it from metrics.md, the review and QA reports and the filed issues. |
| 86 | "Actual" in metrics | **People's hours** on the ticket (answering questions, reviewing, merging, fixing by hand), entered by the person who closes it; compared with the estimate. |
| 87 | Frontend test defaults | Accepted 2026-10-08 (phase 5a's proposals): **msw** mocks the API in component tests, each test stating its own responses; shadcn/ui's **nova** style on **Radix**; **end-to-end tests run against the production build** (`vite preview`), with `/v1` proxied to a real API. |
| 88 | Merging and dev containers | Accepted 2026-10-08 (phase 5b's proposals): `forge merge` uses the **host's default merge commit**, and ticket branches are kept; after the merge into `dev` a ticket **stays "In Testing"** with the merge SHA in a comment until a person moves it to Done (revised by 118: `forge merge` moves it to Done); in separate repositories the frontend's compose file **includes the backend's from a checkout next to it** (`forge new --backend-dir`, default `../backend`); per-file checks run with **`docker compose run --rm --no-deps`**, and in a repository holding several services each rule names its folder (`dir`). |
| 89 | Architecture and performance details | Accepted 2026-10-08 (phase 5c's proposals): **`Gates: performance`** marks performance-sensitive plans and does not ask a person (it adds the load test and the performance review); **the QA lane runs k6** and reports `load.md`; bootstrap's architecture stage **writes ADRs also for the decisions the register already took**. |
| 90 | Starter details | Accepted 2026-10-08 (phase 6's proposals): the skeleton's **`/health`** route is a liveness check answering `{"status": "ok"}`, without touching the database; **the first release's version is the owner's choice**: `v0.1.0` before launch, `v1.0.0` at launch. |
| 91 | MCP servers | Accepted 2026-10-09: the forge uses **one MCP server, Figma's plugin**, and only for projects whose screens are in Figma; GitLab stays on `glab`, which the hook checks. **Client projects turn off the person's claude.ai connectors** (`disableClaudeAiConnectors`, written by `forge init`/`sync`), and **the hook refuses every other MCP tool** unless the project adds its prefix to `policy.mcp.allow`. `forge doctor` checks both, and Figma's login for Figma projects. |
| 92 | Documents from lanes | Accepted 2026-10-09: since Claude Code 2.1.295 an agent isolated in a worktree may not write the main checkout, so **lanes write their documents at the usual `.forge/…` path inside their own worktree, and the `subagent-stop` hook copies them to the main checkout** (the team repo through `.forge/project`): handovers from every lane, reports from reviewers and QA, `.forge/project/` documents from docs-only roles; never `project.json`, the kit overrides, review reports from other roles, or over a newer copy. The verdict files `forge merge` reads are the reviewers' own words, not the lead's. The lead updates the plan's Done/Remaining from the lanes' reports. |
| 93 | The lead keeps going | Accepted 2026-10-09, from the clinic-booking run (about 83 minutes waiting on `/clear` and restarts in one day): **the lead does not stop for `/clear`**. At its handover line (`budget.leadWarn`) it brings `lead-handover.md` up to date and keeps working; `forge sync` sets Claude Code's `autoCompactWindow` 100k past that line (Claude Code compacts well before the window's end: at about 66k of a 100k window and 94–101k of a 120k window, measured), and the `compact` session briefing points it back to the handover. **The project manager runs only before each pick**; the 30-minute timer is gone. |
| 94 | Engineers on their tier | Accepted 2026-10-09, from the same run (the lead put 20 agents on Opus; Opus agents took 43% of the tokens): **the engineers always run on the model forge sync rendered for their tier** (Sonnet by default), also on security plans, where the planner and the security reviewer bring Opus judgment. The hook refuses a different `model` on their spawn. A project that wants otherwise maps its `standard` tier in `project.models`. |
| 95 | Pausing safely | Accepted 2026-10-09: before the laptop closes or goes offline, the owner types **`/pause`**: no new agents, running agents finish and hand over, the lead's handover is brought up to date, `forge save`, and a confirmation. **`forge worktrees`** gives that confirmation deterministically: Claude Code locks an agent's worktree with its process id while it works, so a live process means running and a dead one means cut off (seen after a sleep); clean with every commit on the remote means done; otherwise unfinished, unless its handover exists. `--clean` removes only what is done. `git worktree remove --force` asks a person. |
| 96 | Timeline | Accepted 2026-10-10: to see where a ticket's time and the people's waits go, **the hooks append one JSON line per event to `.forge/state/timeline-<YYYY-MM>.jsonl`**. That covers every tool call's start, end (with Claude Code's `duration_ms`, which starts after the permission decision, so the gap is the person's answer time) or failure; the kit's refusals and asks with rule and reason; agents starting, stopping and being sent back; gate runs; prompts (length and slash command only); turn ends; compaction; API errors; sessions; and `forge` commands run in a terminal. The hooks and the CLI write it, never an agent (`.forge/state` is closed to them). Nothing reaches an agent's context; prompts, contents and output are never logged; text is cut and secrets masked; a write failure never fails a hook. **`forge timeline`** turns it into waits, agent time, gates, refusals and failures per ticket, or CSV/JSON. The file stays local; a team summary (`--record`) is left for later. |
| 97 | Tokens and cost in the timeline | Accepted 2026-10-10: **each model reply is recorded once in the timeline with its model and its token counts** (input, 5-minute and 1-hour cache writes, cache read, output; the lead's session writes the 1-hour cache and agents the 5-minute one, priced differently), read from Claude Code's session log. Corrected the same day (0.2.8): Claude Code writes a reply while it streams, so only the line with the stop reason has the final output count (314 of 3,469 clinic-booking replies differ), and a reply's first call can start before the reply is logged. A reply's numbers therefore go on the first line that finds it complete (an exclusive marker per reply), and each turn's and agent's end counts any finished reply still missing; `reply` names it. Totals match Claude Code's own logs exactly, live and on clinic-booking's 3,465 replies. **Cost is optional and computed when the timeline is read**, from `project.prices` (dollars per million tokens per model family or name, both cache-write prices), which a person copies from the provider's price list. The kit holds no prices: they change, and on a subscription they are what the API would charge, not what the team pays. |
| 98 | Dashboard | Accepted 2026-10-10: **`forge dashboard`** draws six charts on one local page from what the project already keeps: the timeline (with **`forge timeline import`** for the history, from Claude Code's session logs), the bootstrap's stories and tickets, the plans, `metrics.md`, the review rounds in the team repo's history and the merges into the base branch. The owner chose: the kit's own SVG (no library, works offline), the history import, the pipeline running the estimate step, and the page kept on the Mac (it names the client's code and tickets). Rules: each moment of a ticket counted once (agents, gates, waits, lead, nobody); 15 silent minutes are nobody working; the project manager is overhead; a forecast needs three merged tickets. Added the same day at the owner's request: cost charts by stage, by role and model, by token kind and per day (nine charts in all). |
| 99 | Dashboard tabs and the project over time | Accepted 2026-10-11 at the owner's request: the dashboard's charts go into **five tabs** (Overview, Time, Cost, Quality, Tickets) with the totals above them, and a new first chart shows **the project over time**: one row per day, the AI's lane above a lane of every wait for you, by kind (your reply after the lead stopped, a question, a forge rule's approval, a permission prompt). Rules: the lead does not work while it waits for you; blank in both lanes is nobody working; the hours across are those anything happened in, at least two. The "Waiting for you" total counts each wait once for the whole project instead of adding up the tickets'. Still the kit's own SVG and no network; without script every tab shows. |
| 100 | Screenshots of the app on the timeline | Accepted 2026-10-11 at the owner's request: pictures of the app are kept with **`forge shot`**, each with its time, ticket, branch, commit and what it shows, in the project's folder in the team repo (`shots/`, a JSON record next to each picture), so the team sees the same ones. The owner chose when: **when QA passes a UI ticket**, plus whenever someone runs `forge shot`. QA runs that ticket's end-to-end specs once more in Chromium with `FORGE_SHOTS=1` (the starter's Playwright config then takes a picture of each test's last screen) and `forge shot --playwright` records one per passed test, named after it; not on every frontend commit (many near-identical pictures, and the app must run). Pictures over 1280 px wide or 300 KB become a JPEG 1280 px wide (macOS's sips), at most 1 MB. The dashboard marks each with a camera on the project over time, linked to it in a new Screens tab, with the pictures inside the page so it stays one file. Checked on the kit's React sample against the real API in the Playwright 1.63 container. |
| 101 | Mobile apps: Flutter | Accepted 2026-10-11 at the owner's request: **mobile apps are built with Flutter**, by a new `mobile-engineer` agent. **Flutter 3.47.7 with Dart 3.13.5**, pinned like every toolchain. The kit builds its **own dev image from Flutter's release tag** on Ubuntu 24.04, for arm64 and amd64: the community image stopped at 3.44.0, and Flutter's Linux download is x64 only. |
| 102 | Where the mobile app lives | **`mobile/` next to `backend/` (and `frontend/`) in one repository, or a repository of its own** that uses the contract version a person pins (`project.api.pin`), like the web app. A new plan area **`mobile`**; the lanes run db → api → ui → mobile → infra. |
| 103 | Mobile API client | **swagger_parser**: a Retrofit client on Dio with freezed models (`use_freezed3: true`), generated from the approved contract by `forge api generate` in the dev container, committed in `lib/api/`, never edited. Checked on the kit's OpenAPI 3.1 sample contract. |
| 104 | Mobile state | **Riverpod 3**: `Provider` for services, `Notifier` / `AsyncNotifier` for state, written by hand (no riverpod_generator). Server data lives in providers only. |
| 105 | Mobile navigation | **go_router**, one route per screen, the router in a provider. |
| 106 | Mobile UI | **Material 3**, themed from the project's design tokens. `package:flutter/material.dart` for now, as `flutter create` 3.47.7 still generates; the move to the standalone **`material_ui`** package comes in a kit release once Flutter deprecates the framework copy. |
| 107 | Mobile languages | **Flutter's gen-l10n with ARB files** (`lib/l10n/app_<lang>.arb`, the same keys in each), English and Arabic, right-to-left from the locale; Arabic first, like the web sample. |
| 108 | Mobile forms | **Flutter's `Form`** with validators that repeat the contract's limits; the API's field errors (400) and conflicts (409) shown on their fields with `forceErrorText`. No form package. |
| 109 | Mobile tests | **Unit and widget tests** with mocktail; **golden tests** of the key screens per language, made and compared in the dev image only; **integration tests on the Linux desktop build, headless under Xvfb, in a phone-sized window, against the real API** in containers. With `FORGE_SHOTS=1` each flow keeps its last screen for `forge shot` (decision 100). A person checks a release on a real phone or simulator. |
| 110 | Mobile lint | **`dart format` check and `flutter analyze --fatal-infos`**, with flutter_lints plus strict casts, inference and raw types. |
| 111 | Mobile builds | **The local "done" check builds neither Android nor iOS**: an Android build in the Mac's Docker ran out of memory and stalled Docker for about 30 minutes (2026-10-11). **CI builds the Android app; a person builds and signs iOS on a Mac with Xcode** and uploads to the stores. Signing keys never enter the repository. The app's API address is fixed at build time (`--dart-define=API_URL`). On a phone simulator or emulator, a person runs `flutter run` on the Mac against the API in containers. |
| 112 | On the device | **Tokens in flutter_secure_storage; crash reports with sentry_flutter** (it reports to GlitchTip too, like the web app). |
| 113 | The lead's progress report | Accepted 2026-10-12 at the owner's request: **the lead reviews the dashboard and reports progress to the owner after each merge into `dev` and on `/progress-report`** (skill `progress-report`). It reads **`forge dashboard --text`**, the dashboard's numbers as text from the same model as the page, which writes no file. The report is shown in the session and saved as `progress/<YYYY-MM-DD-HHmm>.md` in the project's folder in the team repo. |
| 114 | The requirements panel | Accepted 2026-10-14 at the owner's request: **before the owner's single review, the bootstrap's drafts are read by a panel** (bootstrap stage 7, skill `requirements-panel`), so the tickets the owner approves are the ones that get built instead of new issues turning up mid-build. Seats: backend, frontend, mobile, database, QA and devops (a new read-only role, `requirements-reviewer`, one spawn per seat: the engineers cannot sit, since their hooks expect code, green gates and an edit within 25 calls), security (`security-reviewer`), architecture (`architect`), tickets (`project-manager`) and performance (`performance-reviewer`); mobile, devops and performance only when they apply. The seats read at once and never edit; the lead decides each finding (apply, owner, reject), reruns only the affected stages once, and opens the owner's review (now stage 8) with the panel's result. One round, no new scope through the panel. Lunch-pool (2026-10-13) planned 3 tickets and ended with 22; about 8 of the 19 added were requirements a panel would likely have caught. |
| 115 | Follow-ups | Accepted 2026-10-14 at the owner's request (revised by 119: P1 and P2 follow-ups inside the register join after the build, once): **review findings that are not blockers do not grow the build's queue.** In code the branch changed, they are fixed in a blocker round's fix lane, or stay in the report; elsewhere they become a `[Follow-up]` issue; from the review of a ticket that is itself a follow-up, they are never filed. Follow-ups join the build only when the owner names them, from one line in the lead's progress report, never one by one; the rest wait until the build's own tickets are merged. In lunch-pool, one finding grew into five follow-up tickets this way. Skill rules (review-pass, report-issue, pipeline, progress-report), not a hook. |
| 116 | Accepting tickets in the session | Accepted 2026-10-14 at the owner's request (revised the same day by 118, tickets close on merge, and 120, no-branch work closes on its reviews; the hook's checks below stand), revising 88 (the owner of lunch-pool found 21 tickets In Testing after 3 days, and every step left to them pointed at GitLab): **the owner accepts a ticket by saying so in the lead's session** ("accept #12", "accept #2-#22"), and the lead moves it to Done with `forge tracker status <id> Done --comment "Accepted by the owner on <date>"`, one command per ticket; it never accepts on its own. The hook (`gates:done`) allows a done status from the base branch when **the ticket's own branch passed the gates on a commit merged into `dev`**, refuses it otherwise, and **asks the person** for a ticket with no branch at all (team-repo work, such as lunch-pool #19 and #24) instead of refusing; an agent is still refused, and auto mode turns the question into a refusal. Every done status in one command is checked. The lead's "waiting on you" list (pipeline step 7), the progress report and the project manager's digest carry one line of tickets waiting for acceptance; each item is a question answered in the session, and only a step a person must take outside it (a contract merge, a promotion, a tag, a refused command) says where. In Testing is no longer "stuck". |
| 117 | Released tickets close | Accepted 2026-10-14 at the owner's request: **what the owner has not accepted closes with the release.** The `staging` → `main` merge request ends with one `Closes #<id>` line per open ticket of the release, so the host closes them on the merge into the default branch (merges into `dev` never close an issue: GitLab and GitHub close only on the default branch), and after the tag the release skill moves each ticket to Done (`--comment "Released in vX.Y.Z"`). The tracker adapters change only the label of an issue that is already closed. |
| 118 | Tickets close on merge | Accepted 2026-10-14 at the owner's request, revising 88 and the acceptance step of 116 the same day ("why can't the lead do those without me?"): **once `forge merge` has merged a ticket into `dev`, it moves the ticket to Done** with a comment naming the merge, which closes the issue; a tracker failure is printed and the merge stands. QA still moves the ticket to "In Testing" before the merge. The owner checks the app when promoting `dev` to `staging` and `main` (decision 43); a merged ticket that doesn't work becomes a `[Bug]`. At start-up the lead moves tickets still "In Testing" after their merge to Done. `forge tracker status` now fails when the tracker does. |
| 119 | Follow-ups join by priority | Accepted 2026-10-14 at the owner's request, revising 115: **when `forge tracker list ready` has nothing left to pick, the lead takes one round of follow-ups**: those the project manager's digest rates P1 or P2 and the decision register covers (D-ids), not new scope and not a fix to the kit itself. The round is noted in `lead-handover.md`; a follow-up filed later, a P3, new scope and kit fixes wait for the owner, one line in the progress report. A follow-up's review never files more (115), so the build ends. |
| 120 | No-branch work closes on its reviews | Accepted 2026-10-14 at the owner's request, revising part of 116: **a ticket with no branch (only the team repo or a setting changed) moves to a done status when every review report in `.forge/project/reviews/<ticket>/` approves**, for the lead and agents alike; with no report, or one that does not approve, the lead's move asks the person and an agent's is refused. |
| 121 | Resuming after a kit upgrade | Accepted 2026-10-14 (a fix; lunch-pool's lead, upgraded to 0.2.18, resumed from a handover that still said "never move or close them" and asked its owner to accept 21 merged tickets): **rules come from the current kit, not from a handover.** The lead's handover starts with `Kit: <version>`; when it is missing or not the active kit, the session briefing says the kit changed, points to `.forge/kit/CHANGELOG.md` (now copied with the kit) and the skills the lead follows, and has the lead follow them where the handover disagrees, keep the owner's own orders, and stamp the new version. `/resume` for the lead re-reads the pipeline skill and runs its start-up checks before the handover's Remaining list. |
| 122 | Issues over time on the dashboard | Accepted 2026-10-14 at the owner's request ("show the open/in progress/closed issues chart over time"): **chart 3 on the Overview tab stacks every tracker issue by status from its creation to now**: open, in progress, In Testing (its own band, so merged work waiting for acceptance shows, as lunch-pool's three days of it did) and closed (a Done, Closed or Resolved status counts as closed). Epics are left out. The history comes from each issue's label and state events (GitLab resource events, GitHub issue events), fetched eight at a time and kept in `.forge/state/issues.json`; a later build fetches only the issues whose `updated_at` changed, and a failed read draws the last one with the reason. Building the page now calls the tracker (`--offline` does not); the page itself still needs no network. The colours pass the palette checks (lightness, chroma, colour-blind separation, contrast) on the light and the dark card. `forge dashboard --text` gains an `Issues:` line, which the progress report copies. |
| 123 | Run the app from the dashboard | Accepted 2026-10-14 at the owner's request ("a tab with the steps or a button to build and start the containers"), the owner's choice of steps plus a command over a button: **the dashboard's Run the app tab and `forge app`.** A page opened from a file cannot start programs, and a button would need a local server listening while the dashboard is open, started from a terminal anyway; so the tab gives the steps with Copy buttons and checks the app's address every 5 seconds (an opaque no-cors request: an answer means it runs). `forge app up` finds the top Compose file (the one no other includes; the root first, then `frontend/`, `web/`, `client/`, `backend/`, `api/`, `server/`, `mobile/`), runs `docker compose up -d --build --wait` there (`--fresh` adds `--renew-anon-volumes`) and opens the web service's address; `forge app down` runs `docker compose down` and keeps the volumes; `forge app` shows the services' state. Ports of databases, caches and brokers are addresses, not links. Nothing pulls the checkout: the tab and `forge app up` say which branch and commit run, and how far behind upstream. |
| 124 | The Architecture tab | Accepted 2026-10-14 at the owner's request, after reviewing the list of documents with them: **a dashboard tab with the architecture documents, the standards and the components.** Sections: the components as designed (the overview's C4 diagrams) and as they run (the Compose file); the requirements, as an SRS view: the client's inputs, the authorization matrix and the user stories, with **Download the SRS** putting every part into one Markdown document in the usual order (client's requirements, users and roles, functional requirements, interfaces, non-functional requirements, constraints), each part naming its source (the owner chose this over a new SRS written in the bootstrap); the architecture overview, the decision records, the non-functional requirements and the evaluations, the approved copies on the base branch, a team-repo draft changed after its approval or never approved marked as such; the API's operations at the pinned contract (the owner chose these and the as-it-runs diagram from the optional parts; the decision register and the design system were left out); the standards from `project.json`, the kit's rules and the register's overrides (the ASVS level: lunch-pool's D-020 sets Level 1). Each document is readable in the page and downloads as Markdown (the owner's choice over PDF too). Mermaid diagrams are drawn by mermaid-cli in Docker at build time, all new ones in one run, cached by their text, put inline with their own ids and no scripts, and trimmed to what they draw when they show. |
| 125 | Screens for older projects | Accepted 2026-10-14 at the owner's request (lunch-pool's dashboard had no screenshots: its UI tickets were built on kit 0.2.10, before `forge shot`, and its Playwright config has no `FORGE_SHOTS` switch): **`forge doctor` checks that the end-to-end tests can keep pictures** (a Playwright config at the root, `frontend/`, `web/`, `client/` or `app/` with `FORGE_SHOTS`; a Flutter app's `integration_test/` with `keepScreen`), and counts the pictures kept. **The lead's start-up check 5:** on that warning it files `chore(test): keep pictures of the screens for the dashboard` once, ready, with the doctor's line, and builds it like any ticket; its plan's E2E line names every flow, so its QA records every screen. When the tests can take pictures but none were kept although a UI or mobile ticket is merged, the lead spawns the QA engineer once for a screens backfill on `dev`. QA reports a run that recorded nothing and never changes the test setup in a ticket that is not about it. Projects from `forge new` have the switch from the start. |
| 126 | The dashboard stays current | Accepted 2026-10-15 at the owner's request (a refresh of the page showed the same snapshot): **`forge dashboard --watch` makes a new page every 5 minutes** (`--every <minutes>`, at least 1; not with `--text`) until Ctrl+C, and the open page reloads itself. A page opened from a file cannot ask for files, but it may load a script from its own folder: after each build forge writes `dashboard.stamp.js` (the build's time), the page loads it every 10 seconds and reloads for a newer stamp, keeping its tab (the address), its open sections and its scroll position (session storage), once per stamp so an older copy never loops. Ctrl+C removes the stamp and the page says it is no longer watched. A build that fails is reported and tried again next round. Checked in a real Chrome driven over the DevTools protocol: the page went from one build to the next on the same tab and scroll position. |
| 127 | The circuit breaker | Accepted 2026-10-15 at the owner's request ("build the circuit breaker with your recommended limits", from the first question of 2026-10-13: how to be sure the build never loops): **per ticket at most 4 engineer lanes, 2 review rounds with blockers and 2 QA fails** (`policy.limits`, whole numbers of 1 or more), **and at a limit the ticket is parked while the build goes on** (Blocked with the reason; the owner told; the next ticket taken). The hook counts, for the ticket an engineer spawn names (the description, else the plan its prompt names, else a #N in it): the engineer lanes in `.forge/state/spawns/` (QA and reviewers not counted), the review rounds with a blocking verdict other than QA's and the QA FAIL rounds in the team repo's `reviews/<ticket>/` history plus what is on disk. It refuses the next engineer lane (`[ticket:limit]`), and asks the person for an engineer lane that names no ticket (`[ticket:none]`). **Only a person lifts a limit:** `forge limits lift <ticket>` gives one more allowance of each (the hook refuses it from Claude, lead included; `!` in the session is the owner's). `forge limits` shows each open ticket's use; the dashboard's Look at names a ticket at its limit. Calibrated on lunch-pool: 19 of 21 tickets stayed within 4 lanes; #2 (5) and #3 (10) would have stopped for the owner. Not decided: a time cap per ticket, and the build-wide limit, the fixed scope, the end state and the stall alarm from the same question. |
| 128 | Tickets link to their issues | Accepted 2026-10-15 at the owner's request: **in the dashboard's Tickets tab a ticket's number opens its issue**, at the address GitLab or GitHub gave for it (`web_url`, `html_url`, kept with the issue history) or else one made from `origin` (`git@host:group/app.git` → `https://host/group/app/-/issues/<n>` on GitLab, `/issues/<n>` on GitHub); no address, no link. |
| 129 | A ticket's agents one by one | Accepted 2026-10-15 at the owner's request (tokens per ticket and per agent): **in the Tickets tab, ▸ opens a ticket's agents**: each spawned agent with its role, the job its spawn named (the lead's spawn line), its main model, its tokens and cost (each reply once), its time and start, oldest first; the lead's own turns for the ticket come last. The rows add up to the ticket's total. Per ticket the Cost tab (charts 6 and 7) and the table already showed tokens, and chart 8 per role; `forge timeline <ticket>` shows them by agent in a terminal. |
| 130 | System mode: one lead across all repos | Accepted 2026-10-15 at the owner's request (an existing system of several backend and frontend repositories, databases and services such as Keycloak, MinIO and SigNoz, understood first and then changed by change requests): **one session plans and builds a whole change request**; its agents work in a worktree of whichever member repository their ticket changes, and gates, tests and merges stay per repository. Plan: `docs/phases/system-mode-plan.md` (phases S1 workspace, S2 `/onboard`, S3 `/change`, S4 the whole system locally). |
| 131 | System mode: one board | Accepted 2026-10-15: **every epic, story and ticket of a system lives on one GitLab project's issues**, labelled `repo::<name>` with the repository it changes; one ticket changes one repository. |
| 132 | System mode: new code at the standard, old gaps listed | Accepted 2026-10-15: **everything a change request writes or touches meets the kit's standard** (tests per side, gates, security review, UI review, end-to-end flows); the existing gaps go into a baseline backlog by risk (`baseline` issues, not ready) and the owner chooses which are fixed and when. A repository without a gate gets one in the first ticket a change request puts there. |
| 133 | System mode: a merge that deploys is a person's | Accepted 2026-10-15 as the safe default while the owner had not chosen (a repository's GitHub Actions or GitLab CI may deploy on a merge into its base branch, for example `develop` to a test server): **`forge merge` merges into a branch that deploys only when the system description allows it** (`"merge": "lead"` on that `deploys` entry). Otherwise it checks everything as usual and stops with `READY FOR A PERSON` (exit 3): the lead comments on the ticket and lists it for the owner, a person merges, and the lead then moves the ticket to Done. "Clone" is a local working copy: each repository's `origin`, branches, pipelines and deploys stay as they are, and nothing of the kit is committed to them. |
| 134 | System mode: lanes in member repositories | Accepted 2026-10-15 with phase S1 (found by live runs): Claude Code keeps a worktree-isolated agent's git inside its own worktree, so **the workspace root's agents are not worktree-isolated; the lead opens each one's lane with `forge lane open <ticket>`** (a worktree of the repository the plan's `Repo:` line names, its branch from that repository's own base branch; `--review` checks out the pushed commit, detached, for reviewers and QA; `forge lane close` removes it) and names its path in the spawn prompt. The hooks judge each call by the repository it acts on (after `cd`, for `git -C`, for a file's path), refuse an engineer spawn without a lane in the plan's repository, and refuse an agent's writes, commits and branch switches in a member's main checkout. A finishing lane's gates run in its lane with its repository's gate command. `forge tracker create --repo <name>` labels a ticket `repo::<name>`; the dashboard at the root reads every repository's merges and shows a Repo column and filter. |

**Still open, deferred to the phase that needs them:**
- Which Node framework the Node + TS recipe uses (NestJS vs. Fastify/Express). Phase 6.
- Deployment tooling for on-prem/VPS where no Terraform provider exists. Phase 5.
- ~~Which host and organisation will hold `se-forge` and `se-forge-projects`.~~ Decided 2026-10-06: a **GitLab group** (name to come); the kit's CI runs on GitLab CI. Nothing is pushed until the group exists and the owner says so.
- ~~How `forge` itself is installed.~~ Decided 2026-10-06: `npm install -g git+ssh://git@gitlab.com/<group>/se-forge.git#vX.Y.Z`; upgrade with the new tag.
- Phase 2 defaults (sensitive paths, `maxTurns`, tag pushes ask, ADR asks every time) accepted on 2026-10-06.

---

## 10. Not verified yet, and risks

- **Windows:** deferred by decision (macOS first). The code keeps Windows-port seams: Node `path` handling and no bash-only tooling in hooks or the CLI. A teammate can fork and port it.
- **GitLab:** `glab` is not installed yet, so the GitLab flows are untested until phase 3.
- **Docs not re-read** because the host was unreachable during the audit; they will be re-read in phase 3:
  - plugin version pinning per project;
  - `plugin.json` pointing at skills outside the plugin folder;
  - `enabledPlugins` in `settings.local.json`.
- **`ask` under bypass mode:** whether a hook's `ask` is honoured in `bypassPermissions` mode is tested in phase 2.
- **Invisibility** depends on per-clone excludes plus the leak-protection hooks. A developer committing by hand with hooks bypassed could still leak kit files. `forge doctor` checks the client repo history for kit paths.
- **Transcript format:** reading a lane's transcript relies on an undocumented format. That is mitigated by an isolated parser with tests and the call-count and `maxTurns` backstops.
- **Scope:** 2 Git hosts, 3 backends, 4 databases and 4 cloud targets are a large surface. D17 keeps testing per recipe rather than per combination.
