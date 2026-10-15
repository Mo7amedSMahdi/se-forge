---
name: triage
description: The project-manager's procedure - find new and changed issues on the board, triage each against the decision register and approved stories, mark only qualifying bugs ai::ready, and write the digest for the leader and the daily summary for the owner. Use when the leader asks for a board digest.
---

# Triage the board

## Steps
1. **What changed.** `forge tracker list json > /tmp/board.json`. Compare with the newest `.forge/project/pm/digest-*.md` (its "Seen" line lists issue ids with their `updatedAt`). New = not seen; changed = newer `updatedAt`.
2. **Triage each** new or changed issue. Read it with `forge tracker get <id>`, then decide:
   - **Type:** Bug, Feature, Task or Follow-up.
   - **Areas:** ui, mobile, api, db or infra.
   - **Priority:** P1 blocks users or the build; P2 is needed soon; P3 can wait.
   - **Acceptance criteria:** present and testable? If not: "needs a spec" (skill `spec-writer`).
   - **Covered by the register?** Name the D-ids that decide it, or say that it is new scope.
   - **Duplicates:** search the open titles; link the duplicate and say which one stays.
   - **Stuck:** In Progress or In Testing with no update for more than 2 working days, or blocked by an open issue.
   - **Follow-ups** (decision 119): a kit fix (the change is to the forge kit or the team's process, not this project's code) or new scope never joins by itself. Write each follow-up under "Follow-ups": joins after the build when it is P1 or P2 and the register covers it, otherwise waits for the owner.
3. **Comment** the triage on each issue, in one short block: `forge tracker comment <id> "Triage (project-manager): type …, areas …, priority …, …"`.
4. **Ready**, for bugs only. Mark it with `forge tracker ready <id> --comment "Breaks AC<n> of #<ticket> (approved)"` when the bug names an approved acceptance criterion or contract operation it breaks and has steps to reproduce. Everything else, features and scope changes included, goes to "Needs a person" in the digest. Never mark your own new ideas.
5. **Digest**: write `.forge/project/pm/digest-<YYYY-MM-DD-HHmm>.md` (with the Write tool) from `template.md` in this skill's folder. Keep the template's headings exactly: the leader reads its sections by name. Return its short form (at most 10 lines) to the leader.
6. **Daily summary**: at the first digest after 17:00, or when the leader asks, write `.forge/project/pm/daily-<YYYY-MM-DD>.md` for the owner: done today, in progress, blocked (and on whom), new issues, decisions needed.

## Done when
- every new or changed issue has a triage comment;
- only bugs that break an approved criterion or contract were marked ready, each with the reason;
- the digest is written with its "Seen" line, and the leader has the short form.
