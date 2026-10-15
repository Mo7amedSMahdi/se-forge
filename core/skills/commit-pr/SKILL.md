---
name: commit-pr
description: Commit and open the pull/merge request the team's way - Conventional Commits with explicit paths, a draft PR/MR after the first push, a description from the template (ticket, what changed, how to test, contract and migration notes, risks), and ready only after gates and reviews. Use whenever work is committed or a PR/MR is opened or marked ready.
---

# Commit and open the PR/MR

## Commits
- `git add <explicit paths>` (never `.`, `-A` or `-u`; the hooks refuse them). One behaviour per commit.
- Message: Conventional Commits, `<type>(<scope>): <summary>` with type `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`, `style` or `revert`; summary in the imperative, under about 72 characters; a body that says why when it is not obvious; `!` or `BREAKING CHANGE:` for breaking changes. The commit-msg hook checks the format.
- The AI co-author line follows the project facts; with `coAuthor: false` it is removed for you.
- Never `--no-verify`, never amend or rebase pushed commits others may have, never commit generated output or kit files.

## The PR/MR
1. After the first push: a **draft**. `gh pr create --draft --title "<conventional summary>" --body-file <file>` or `glab mr create --draft --title "..." --description "$(cat <file>)"`. The body comes from `template.md` in this skill's folder.
2. Keep it focused: one ticket. Link the ticket (`Closes #<id>` where the tracker supports it).
3. Review reports stay in the team repo, never in the PR/MR (decision Q10).
4. Mark it **ready** only when `forge gates` is green on the last commit and the review pass has no open blocker: `gh pr ready` / `glab mr update --ready`. The hook refuses it otherwise.
5. Never merge it: merging is for a person.

## Done when
- every commit is a Conventional Commit with explicit paths, pushed;
- the PR/MR has the template's sections filled, links the ticket, and is ready only after green gates and reviews.
