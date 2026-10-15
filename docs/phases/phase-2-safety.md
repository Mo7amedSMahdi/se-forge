# Phase 2: safety fixes

Branch `phase-2/safety` (local only; nothing pushed). Scope approved on 2026-10-06: worktrees, tests-green gate, guard bypasses, approval gates, hook tests, macOS first.

## Built

- **Policy engine** `core/policy/`: Node.js 22+, no dependencies, one hook entry point for PreToolUse, PostToolUse, SubagentStop and SessionStart. It fails closed. Rules are listed in `core/policy/README.md`.
- **Shell parser**, so rules see the commands that actually run, including those inside wrappers and substitutions. All 23 bypasses from the phase 1 audit are closed.
- **Lanes**:
  - recognised by `agent_id`, as the harness sends it;
  - a context budget read from the lane's own transcript: warn at 100k, deny past 120k except for handing over;
  - no sub-agents;
  - 25 calls without an edit stops an engineer lane.
- **Done gate**: a feature branch, clean, pushed, and the gate command green. It is enforced:
  - when an engineer lane finishes (SubagentStop sends it back, up to 3 times, then GATES-FAILED);
  - on ready PRs/MRs;
  - on done ticket statuses.
- **Approval gates**:
  - Denied: merges, applies, production deploys, dropping tables, production credentials.
  - Ask: ADRs, CI files and config; security-sensitive paths and plans tagged `Gates: security`, recorded per branch when a person approves.
  - Asks become denials in bypass, dontAsk and auto modes.
- **Template wiring**:
  - three permission levels;
  - `scripts/agents/policy.json`;
  - worktree isolation and `maxTurns` for engineers, QA and reviewers;
  - plans gain `Branch:` and `Gates:`;
  - "proceed on defaults" removed for gated questions and bootstrap stages;
  - six bash hooks, `lib.sh` and the token watcher removed;
  - the installer installs the engine.
- **Server layer** `core/server/` and `core/ci/`:
  - GitHub and GitLab checklists with full and fallback options per plan tier;
  - CI jobs: secret scan and gates;
  - a GitLab Free approval-check job.

## Tested

| What | Result |
|---|---|
| `npm test` on macOS (Node 22.20) and Linux (Node 22.23, container) | 246/246 |
| Live harness, real `claude -p` sessions: bypasses, gated plan, lane sent back until gates pass, hard cap, no sub-agents | 20/20, about $0.38 |
| Installer under bash 5: fresh, re-run, existing project merge | pass; re-run skips 67 files; existing allow rules and hooks kept |
| CI templates: YAML parse; gitleaks on clean and leaky repos; approval-check against a mock GitLab API | pass; leaky repo exit 1 (2 leaks); author-only approval exit 1, other approver exit 0, wrong token exit 1 |
| Harness behaviour probes (before building) | hook `ask` is refused in every mode when nobody can answer; crash with `\|\| exit 2` blocks; lanes see `CLAUDE_PROJECT_DIR` = main checkout |

Bugs found by testing and fixed: `bash <(curl …)` taken for a script run; the policy config was denied instead of asked; over-budget lanes could still run `ls`, `cat` and `echo` (found live).

## Learned about the platform

- **Untrusted folders.** In a folder not yet trusted, Claude Code ignores the project's `permissions.allow`. Each developer trusts a project once; the docs must say so (phase 3).
- **Worktree cleanup.** A lane worktree that has commits is not removed after the lane ends. The lead removes it (pipeline skill); reviewers read branches detached.
- **Built-in co-author line.** Claude Code adds its own `Co-Authored-By` line to commits. The per-project co-author setting (decision Q11) must also control Claude Code's attribution setting (phase 3).

## Proposals to confirm

Defaults chosen here, all changeable in `policy.json` or the agent files:

- `paths.sensitive` defaults: `**/auth/**`, `**/authentication/**`, `**/authorization/**`, `**/permissions/**`, `**/payments/**`, `**/billing/**`.
- `maxTurns`: engineers 200, QA 150, reviewers 80.
- Pushing tags asks first, because tags can start release pipelines.
- ADR edits ask every time; security approvals last for the branch.

## Phase 2b: gaps closed after review

Asked for on 2026-10-06 after "what is missing?".

| Gap | Now |
|---|---|
| No secret scan before a commit | `git commit` is refused when the lines it would add contain a secret, including files staged by the same command. gitleaks is used when installed, else built-in patterns. Editing `.gitleaksignore` or `.gitleaks.toml` asks a human. |
| No format/lint/type-check after edits (brief §8) | `edits.{format,lint,typecheck}` rules run on each edited file. Failures go straight back to the agent. |
| Reviewers read-only only by prompt | Read-only roles may write only their report (`paths.reports`) and run only inspection commands. |
| Node older than 22 only warned | Writes are refused and reading stays allowed (checked on Node 20 and 18). |
| `usage.sh` pointed at a pause skill that never existed | Fixed. |
| Unattended lanes blocked on the gate command | Gate commands and `commands.allow` are approved without a prompt, even in an untrusted folder. Settings deny and ask rules still apply. |
| A person's approval never tested live | An MCP stand-in answers the prompt: one ask, recorded per branch; a refusal changes nothing. |

**Tests after 2b**

- `npm test`: 268/268 on macOS (gitleaks installed) and on Linux, Node 22, without gitleaks (the built-in scanner).
- Live: all 11 scenarios passed, 32 checks.
  - The last full run had 22/32: Haiku refused the bypass and secret commands because `CLAUDE.md` forbids them. That is the prose layer working, but it meant the hooks were never reached.
  - Those two scenarios now run with a test-only prompt that plays an agent ignoring the rules, and passed 14/14.
  - The other nine passed in the full run.
  - About $1.10 for the 2b live runs.

## Open

- **Kit CI** waits on where `se-forge` will be hosted (phase 3).
- **Windows**: not supported (macOS first, by decision).
- **GitLab**: the `glab` flows are untested (`glab` not installed); covered by unit tests only.
- **Reviewer verdicts** are still written into the plan (now the only thing reviewers may write); they move to the team repo in phase 3.
- **Edit rules and "affected tests"** commands are per project and empty by default; the stack recipes (phases 4 and 6) provide them.
- **Bootstrap stage approvals**: enforcement by a merged PR in the team repo comes in phase 6. For now there is no default path through them.
- **Installer** still needs bash 4. The `forge` CLI replaces it in phase 3, together with plugin packaging.
- **GitHub tracker adapter**: the bash 3.2 crash and the dry-run label bug are fixed in phase 3.
- **`auto` mode** could not be tested (it fell back to default); asks are denied there to be safe.
