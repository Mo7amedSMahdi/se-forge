---
name: review-pass
description: The separate review pass on a ticket branch before QA or the ready PR/MR - spawn the reviewers the plan's areas and gates call for (code-reviewer, spec-checker and security-reviewer always; db-reviewer, infra-reviewer, performance-reviewer, figma-ui-reviewer when they apply), read their reports, route blockers back to the author until none remain. Never review in the authoring context.
argument-hint: "<ticket> <branch to review>"
---

# Review pass

Ticket and branch: **$ARGUMENTS**

1. The context that wrote the code never reviews it. In full mode, make sure the lane that wrote the branch has stopped. Each reviewer gets its own worktree (`isolation: worktree`) and checks the branch out detached (`git switch --detach origin/<branch>`), since the author's checkout may still hold the branch.
2. Start the reviewers together, in the background. Every prompt names the branch, the plan's absolute path and the report to write, `.forge/project/reviews/<ticket>/<report>`, which the reviewer writes in its own worktree: Claude Code keeps it out of the main checkout, and the hook copies the report there when the reviewer stops. Every spawn's description names the ticket (`Code review #12`), because `forge metrics` counts by it.

   | Reviewer | When | Report |
   |---|---|---|
   | `code-reviewer` | always: "Review branch `<branch>` of ticket #<id> against the plan, the se-forge rules and the project's standards." Pass `model=opus`, and say why, when the diff touches auth, permissions, tokens, exposed data or the API client's core | `code.md` |
   | `spec-checker` | always (on a UI-only diff it checks that the client comes from the pinned version and calls only operations in the contract) | `spec.md` |
   | `security-reviewer` | always; `model=opus` when the plan has `Gates: security` or a threat model, or the diff touches the project's sensitive paths | `security.md` |
   | `figma-ui-reviewer` | the diff touches UI, mobile screens or locale files: "Compare branch `<branch>` with Figma nodes <the plan's node ids>." | `figma.md` |
   | `db-reviewer` | the plan's `Areas:` include db, or the diff adds migrations | `db.md` |
   | `infra-reviewer` | the plan's `Areas:` include infra, or the diff touches a Dockerfile, a compose file, CI configuration or `.env.example` | `infra.md` |
   | `performance-reviewer` | the plan has `Gates: performance`, or the owner asks. It reads the QA lane's k6 report (`load.md`), so QA's load test (skill `load-test`) runs first | `performance.md` |

3. Read the reports in `.forge/project/reviews/<ticket>/`, not what you remember of them.
   - **No blocker**: full mode goes on to `/qa <ticket> <branch>`; light mode (`/ticket`) goes on to closing the ticket.
   - **Findings that are not blockers** (decision 115), so that one review does not grow the queue:
     - in code this branch changed: the fix lane of a blocker round fixes them along with the blockers; with no blocker round they stay in the report, and no lane runs for them alone;
     - anywhere else: a `[Follow-up]` issue (skill `report-issue`); the lead takes the P1 and P2 ones inside the register after the build, and the rest wait for the owner (decision 119);
     - on a ticket that is itself a `[Follow-up]`: in the report only, never filed, so follow-ups do not breed follow-ups.
   - **A blocker**: the author's side fixes it. In full mode, spawn a fresh lane of the engineer who owns the finding's area (`db-engineer`, `backend-engineer`, `frontend-engineer`, `mobile-engineer`, `devops-engineer`) with "Fix the blockers in `.forge/project/reviews/<ticket>/` on branch `<branch>`, and the other findings in code this branch changed: one commit per finding, `git add` with explicit paths." In light mode, fix them yourself the same way. Then push, run `forge gates` and start this pass again. Blockers still open after two rounds go to the owner; in full mode the hook stops the next lane by itself at the ticket's limit (decision 127).
4. A reviewer reports and does not fix; an author fixes and does not argue the finding away. The reports say how each finding ended.

## Done when
- every reviewer the plan calls for has written its report in `.forge/project/reviews/<ticket>/`, starting with `Verdict:` and `Commit:` (`forge merge` reads them);
- no report has an unresolved blocker, or the owner was asked after two rounds, as a choice (skill `ask-owner`);
- the reports record how each finding was resolved: fixed, filed as a follow-up (with its issue id), or left in the report.
