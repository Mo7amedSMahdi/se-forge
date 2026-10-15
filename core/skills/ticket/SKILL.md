---
name: ticket
description: Light mode, the default way to work - one agent takes one ticket or described change from plan to a ready pull/merge request (plan, tests and code, gates, separate read-only reviews, fixes, PR/MR, ticket status). Use for normal-sized work; use /pipeline (full mode) for large features that need parallel lanes.
disable-model-invocation: true
argument-hint: "<ticket id> | \"<short description of the change>\""
---

# One ticket, one agent (light mode)

Arguments: **$ARGUMENTS**

You are the author: you plan and build. Reviewers are separate, read-only agents, and nobody approves their own work. You work in the main checkout, on the ticket's branch.

## 1. Understand
- A ticket id: `forge tracker get <id>`. A plain description: treat it as the ticket text and skip tracker updates.
- Read only what the ticket cites: the story section, the Figma frame (skill `figma-align`), the API operations in the generated client (skill `api-sync`).
- No clear acceptance criteria? Write the spec first (skill `spec-writer`) and get it approved.
- Too big for one agent (several areas, or more than about a day of work)? Say so and suggest `/pipeline`.

## 2. Plan (skill `plan-ticket`, then `estimate`)
- Write `.forge/project/plans/<ticket>-<slug>.md` with its `Branch:` and `Gates:` lines, items, tests and questions.
- Ask the owner the open questions once (AskUserQuestion, all in one message). A question on a gate (security, architecture) waits for the owner; never take its default.
- The hook asks a human before you change security-sensitive paths on this branch.

## 3. Build
**Contract first.** If the plan's `Contract:` is `pending`, draft the change (skill `api-contract-design`) and stop: tell the owner the draft's path and summary. A person puts it in its own merge request, merges it and tags it; then run `/ticket <id>` again. Database items may be built meanwhile.

1. `git switch -c <branch> origin/<base branch>` (or `git switch <branch>` if it exists).
2. Work through the plan's items in the order db → api → ui → mobile, using the skills for each (`db-migration`, `new-endpoint`, `api-sync`; for mobile items `new-screen`, `flutter-form`, `write-flutter-tests`).
3. Per plan item: tests from the acceptance criteria first, then the code. One behaviour per commit, explicit `git add <paths>`. Push after the first commit and open a **draft** PR/MR (`gh pr create --draft` or `glab mr create --draft`).
4. When the hook reports failed checks after an edit, fix them before moving on.

## 4. Gates
`forge gates` runs the gate command on the pushed branch. Fix until it is green. Never weaken, skip or delete a test to get there.

## 5. Review (skill `review-pass`)
Run the review pass on your pushed branch: `code-reviewer`, `security-reviewer` and `spec-checker` always; `db-reviewer` and `figma-ui-reviewer` as the plan's areas call for. They are separate, read-only agents and write their reports to `.forge/project/reviews/<ticket>/`. You fix the blockers yourself (you are the author); after two rounds with blockers left, ask the owner.

## 6. Close
1. Mark the PR/MR into `dev` ready (`gh pr ready` or `glab mr update --ready`). The hook refuses unless the gates passed on that commit.
2. Merge it: `forge merge <id>` (decision 75). It merges only when the gates, the tests rule and every review report hold for the branch head and the contract is untouched; act on each NOT MERGED line. Promotions to `staging` and `main` are a person's.
3. A tracker ticket: `forge merge` moved it to Done and commented the merge (decision 118); add how to test and the known gaps: `forge tracker comment <id> "<how to test, known gaps>"`.
4. Update the plan (status, done, remaining, decisions), record the tokens (`forge metrics <id> --record`; the person closing adds their hours in metrics.md, decision 86), then `forge save`. Plans and reports go to the team repo this way; they are never committed to the client repo.
5. Report to the user in a few lines: the PR/MR and its merge, what changed, how to test, open questions, anything built without a design.

## Done when
- the PR/MR is merged into `dev` by `forge merge` (or the reason it waits is reported), the gates passed on its last commit, and every reviewer's report has no open blocker;
- the ticket is Done with the merge and how to test in its comments (or the description's change is reported), the plan is updated, and `forge save` ran.
