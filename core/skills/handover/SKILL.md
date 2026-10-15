---
name: handover
description: Leave a resume point in .forge/handoffs/<name>-handover.md, and pick work up from one in a fresh agent. Use at the context-budget warning, when an agent is paused or stops with a ticket half done, before /clear or compaction, and first thing in a resumed lane.
argument-hint: "<name> [--from-tree <worktree>]"
---

# Handover and resume

An agent cannot clear its own context, and Claude Code compacts a full one by itself. Both are safe once the work is written down: the next step is taken by a **fresh agent** reading the handover, never by waking the agent that stopped.

## Write one (no helper agents; ten minutes at most)
1. Commit everything that can be committed on your branch, adding files by name (`git add <paths>`, never `-A`). Leave no half-made edit that fails the gate command: if you must, undo your own unfinished change and nothing else.
2. `forge handover <name>` starts `.forge/handoffs/<name>-handover.md` with the branch, the commit, `git status` and the diff stat against `origin/<base branch>` (dev unless the project names another). A lane's file is written in its own worktree, and the hook copies it to the main checkout when the lane stops. The lead, writing for a lane that has stopped, adds `--from-tree <worktree>`.
3. Fill in the sections: **Where things stand** (ticket, plan, branch, and the files other lanes own), **Done so far** (a row per step: commit, change), **Remaining** (numbered, with the files and the exact next command), **Decisions** (made, and still open) and **Gates on the last commit**. Point to plans and tickets by path or id instead of copying them.
4. Your last message is the handover's path and nothing more.

## Resume from one
For a fresh agent, or for the lead once its context was cleared, compacted or restarted.
1. Before anything else, read the newest handover that concerns you (the session briefing lists `.forge/handoffs/*-handover.md`), then the plan it points to.
2. Run `git status --short --branch` and `git log -3 --oneline`, and make sure you are on the branch the handover names (in its worktree, if it names one). Continue the work; the ticket is not restarted. Uncommitted changes stay unless they are plainly broken, and then you say so before dropping them.
3. Work through **Remaining** from item 1. When the list is empty, rename the file to `*-handover.done.md` and say so in the plan.
4. **The skills win.** A handover keeps the state and the owner's own orders, not the kit's rules. When the session briefing says the kit changed since the handover was written, read what changed (`.forge/kit/CHANGELOG.md`) and the skills you follow first; where a rule in the handover (one that came from a skill or a hook's refusal) disagrees with the current skill, follow the skill and correct the handover. An order the owner gave stands until the owner changes it.

## The lead's handover
`.forge/handoffs/lead-handover.md` starts with `Kit: <version>`, the se-forge version whose skills it follows (`forge version`, or the session briefing's first line), and holds what the lead needs to carry on: the lanes running (name, type, ticket, branch, worktree), the queue of plans in order, the owner's standing orders and the rulings made since the last update. Update it when the lead crosses its context warning, then keep working: Claude Code compacts soon after, and the lead continues from this file.

## Done when
- writing: the work is committed and pushed, the handover's sections are filled (the exact next command under Remaining, the other lanes' files named), and your last message is only its path;
- resuming: you are on the handover's branch, and the file is renamed `*-handover.done.md` once Remaining is empty.
