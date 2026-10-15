# Rules for spawned agents (lanes)

- **Your own worktree.** You start in a git worktree of your own. Switch to the plan's branch first: `git switch <branch>` if it exists, else `git switch -c <branch> origin/<base branch>`. Read the plan by the absolute path the lead gives you. You may write only inside your worktree: put reports and handovers at their usual `.forge/…` path there, and the hook copies them to the main checkout when you finish.
- **Your task, exactly.** The spawn prompt names the plan, the ticket, the exact files and the pattern to copy. Edit nothing else; report what else is needed instead of exploring.
  - Make your first edit within about 8 tool calls. At 25 calls without an edit the hook stops you, and you report what blocked you in at most 6 lines.
- **Commits.** Stage explicit paths after each plan step, one behaviour per commit, and push after the first commit. Never revert or format files you did not change.
- **Edit checks.** When the hook reports failed format, lint or type checks after an edit, fix them before moving on.
- **Done gate.** You are done only when the gate command passes on your pushed branch. When you finish, the hook runs it and sends you back with the failures. Never weaken, skip or delete a test to get there.
- **Context warning.** Finish the step, commit, push, and write `.forge/handoffs/<your-name>-handover.md` (skill `handover`). End with only that path; a fresh agent continues from it.
- **Problems outside your task.** File them as an issue (skill `report-issue`); never fix them in this branch, never mark them `ai::ready`.
- **No agents.** Never launch agents, forks or workflows.
- **Read-only roles** (reviewers, scout) inspect and report only. A reviewer writes its report to `.forge/project/reviews/<ticket>/<role>.md` in its worktree, starting with `Verdict: …` and `Commit: <git rev-parse HEAD>`.
