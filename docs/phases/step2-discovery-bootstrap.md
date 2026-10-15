# Step 2: discovery-first bootstrap, project manager, done needs tests

Branch `step2/discovery-bootstrap` (local only). 2026-10-07, after the end-to-end round.

Decisions (audit section 9):
- 42: discovery first, with a decision register.
- 43: the checkpoints that stay with a person.
- 44: one review of all bootstrap artefacts, then the build runs ticket after ticket.
- 45: built before phase 5.
- 46: agents file issues.
- 47: the project manager and the `ai::ready` queue.
- 48: the project manager runs in the open session.
- 49: the design source, kit-designed or provided.
- 50: done needs tests.
- 51: models per project.

## Built

- **Discovery-first `/bootstrap`.**
  - **Discovery** (skill `discovery`): a questionnaire across 13 categories, answered interactively or from a filled questionnaire. It writes the decision register `bootstrap/decisions.md`, which agents answer from first (citing D-ids).
  - **Settings:** project settings go through a checked proposal (`forge config check`) before `project.json` changes, and that edit asks the owner.
  - **Stages:** stories, screens, contract and ticket drafts run one after the other in the foreground, then one review (`review.md`).
  - **After approval:** the contract merge request, merged by a person; the `api-v1.0.0` tag; the tickets created `ai::ready` by the leader; `/pipeline next 1`.
- **Design source** (decision 49): the kit designs in Figma, or the client's screens come as a Figma file, a PDF or images. Skill `design-intake` turns them into a design system (exact values from Figma, measured ones from images), a story-to-screen map and a "Not in the screens" list. The UI reviewer compares against provided screens too.
- **Project manager** (role `project-manager`, skill `triage`):
  - triages new and changed issues (type, areas, priority, acceptance criteria, register coverage, duplicates, stuck work) and comments on each;
  - marks `ai::ready` only for a bug that names a broken approved criterion;
  - writes a digest for the leader and a daily summary for the owner.
  The pipeline calls it before each pick and on a 30-minute session timer, and picks only `ai::ready` tickets, one at a time by default.
- **Agents file issues** (skill `report-issue`): `[Bug]` and `[Follow-up]`, labelled `source::ai`, after a duplicate check. Reviewers may file but not move tickets.
- **Done needs tests** (`policy.tests`): every side whose code changed needs new or changed tests. A plan's `E2E:` line names a flow (an end-to-end test must change and `e2e.command` passes) or says "not applicable (reason)". Enforced by the done check: lane finishing, ready PR/MR, done ticket status. The stack guides have the snippet.
- **Policy:**
  - register-approved libraries (`policy.deps.approved`) no longer ask, as commands or manifest edits;
  - only the leader and the project manager may set `ai::ready`;
  - `commands.wrappers`;
  - `forge sync` refuses an invalid `project.json`.
- **Tracker:** `create --source/--area/--ready`, `ready <id>`, `list ready`, and `list json` (normalised for triage), on GitLab (scoped labels) and GitHub.
- **Models per project** (`project.models`, decision 51).

## Found and fixed along the way
- **A safety gap:** commands inside shell loops, conditions and `{ }` groups reached no rule (`for i in 1; do git push origin main; done`). Fixed with regression tests; restricted roles use the same unwrapping.
- **A done-gate gap since phase 3a:** a done status set through `forge tracker status` was not checked (only the tracker script was).
- **Discovery trial 1:** the leader wrote `project.json` in an invalid shape, which locked agents to read-only (the fail-closed design working). Fix: a checked proposal first, with the exact keys.
- **Discovery trial 2:** the leader started stage agents in the background and the headless run ended. Fix: stages run in the foreground.
- **Project-manager trial:** the digest headings drifted from the template; the skill now requires them.
- **The rules injected at session and lane start were over the hook limit again.** The skill list (Claude Code lists skills itself) left `AGENTS.md`, and model routing moved to the pipeline skill.
- **Test sessions** set `DISABLE_AUTOUPDATER=1`: a run had started a Claude Code update that briefly removed the `claude` command.

## Tested

| What | Result |
|---|---|
| `npm test` on macOS | 386/386, 6 opt-in skipped |
| Live `discovery` (Sonnet lead, Opus agents) | 9/9, $3.02 |
| Live `pm` | 3/3, $0.11 |
| Live `fullstack` with `policy.tests` on | Stopped before the end at the owner's request. Up to then: migration, tests (their own commit) and endpoint built and pushed; the review stage had started. To rerun. |

What the discovery trial produced:
- a register of 32 decisions and 5 open items;
- 15 stories and a 4 × 16 authorization matrix;
- 42 design tokens, two contrast failures against WCAG AA with proposed fixes, and 25 "Not in the screens" items;
- a 20-operation contract that passes `forge api check`;
- 24 ticket drafts estimated at 111–226 h;
- a review with 8 contradictions or gaps, and 5 security questions left to the owner without defaults.

No tracker issue was created before the review.

## Open
- **Stage 7 was not run live:** the contract MR and tag, creating the tickets, and the pipeline with the project manager's 30-minute timer. The pieces are tested on their own (tracker adapters, the policy, the earlier pipeline and ticket runs).
- **Measured tokens are visual estimates:** a docs role may not run a pixel-sampling tool. A small `forge design sample` command, read-only and image-only, would make provided images exact. Proposed for phase 5.
- **`/pipeline` with several tickets unattended:** the multi-ticket trial is still to do.
