---
name: retro
description: The retrospective after each release (decision 85) - from metrics.md, the review and QA reports and the issues agents filed, a draft of what went well, what to change, and proposed changes to the project's rules or the kit, for the team to discuss. Use when a release reaches main.
---

# Retrospective

The draft is for people to discuss; changes to rules or to the kit are theirs to decide. Write it to
`.forge/project/retros/vX.Y.Z.md`, then `forge save`.

## Inputs
- The release's tickets: the CHANGELOG section and the merge requests (skill `release`).
- `.forge/project/metrics.md` rows for those tickets (guide: docs/metrics.md in the kit): estimate, actual people's hours, bugs after release, rework rounds, AI cost. Fill missing AI cost cells first: `forge metrics <ticket> --record`.
- `.forge/project/reviews/<ticket>/`: blockers per reviewer, and findings that recur across tickets.
- Issues filed by agents (`source::ai`) and by people during the release: `forge tracker list json`.
- Handovers and lane failures in `.forge/handoffs/` and the plans' status lines (GATES-FAILED, blocked).

## Write
1. **Numbers:** a table ticket → estimate, actual, bugs after release, rework, AI cost; the totals; the estimates' accuracy (actual within the range or not).
2. **What went well:** with the evidence (a ticket, a report, a number).
3. **What to change:** each with its evidence and one proposed change, aimed at the right place:
   - the project: its rules (`.forge/project/kit/rules.md`), its settings (project.json: gates, tests), its register;
   - the kit (a role, a skill, the policy): an issue for the kit's repository, with the evidence;
   - the team's way of working: a sentence for the meeting.
4. **Follow-ups:** the open questions and the owner of each.

## Done when
- every ticket of the release is in the numbers table, AI cost included;
- every proposed change has evidence and a place it would go;
- the draft is saved and shared with the team, and nothing in the rules or the kit changed without them.
