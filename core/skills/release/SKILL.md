---
name: release
description: Preparing a client project's release (decision 82) - the next SemVer version and the CHANGELOG section from the Conventional Commits since the last tag, the release merge request, then the promotion merge requests dev to staging to main, which a person merges and tags, and the released tickets closed. Use when the owner wants to ship what is on dev.
---

# Release

A release is the promotion of `dev` to `main` (production), through `staging`. People merge the
promotions and create the tag (decision 43); this skill prepares everything they need. Staging and
production deploys come with the next kit release (decision 70): until then a release is the promotion,
the tag and the notes.

## Steps
1. **What is new:** `git fetch --tags origin`, the last release tag `git describe --tags --abbrev=0 --match 'v*' origin/main` (none: this is the first release), then `git log --format='%h %s' <last tag>..origin/dev` (or all of `origin/dev`).
2. **The version** from the commit types (Conventional Commits):
   - a breaking change (`!` after the type, or a `BREAKING CHANGE:` footer): major (minor while the version is 0.x);
   - otherwise any `feat`: minor; otherwise any `fix` or `perf`: patch;
   - only `docs`, `test`, `chore`, `ci`, `style`, `refactor`: no release is needed; say so and stop unless the owner wants one (patch).
   - The first release: the owner chooses, as a choice (skill `ask-owner`): `A. v0.1.0` (not live yet) or `B. v1.0.0` (at launch).
3. **The CHANGELOG section** at the top of `CHANGELOG.md` (create it with the heading `# Changelog` when missing): `## [X.Y.Z] - YYYY-MM-DD`, then `### Added` (feat), `### Fixed` (fix), `### Changed` (perf, refactor, and breaking changes first, marked **Breaking:** with what users must do). One line per change in the users' words, with its ticket (`#12`); leave out tests, CI and chores.
4. **The release branch:** `chore/release-vX.Y.Z` from `origin/dev` with the CHANGELOG commit (`chore(release): vX.Y.Z`), pushed, and a merge request into `dev`. A person merges it.
5. **The promotions**, after that merge: a merge request `dev` → `staging`, and after the person merges and checks it, `staging` → `main`. Each description: the version, the CHANGELOG section, the tickets, the migrations included (expand/contract steps, decision 65), the new environment variables (names only). The `staging` → `main` description ends with one `Closes #<id>` line per ticket of the release that is still open (`forge tracker get <id>`), so the host closes them when it merges into `main`, the default branch (decision 117).
6. **The tag**, after the merge into `main`: a person runs `git tag -a vX.Y.Z -m "vX.Y.Z" origin/main && git push origin vX.Y.Z` (agents' tag pushes ask).
7. **Close what was released** (decision 117): every ticket of the release not yet Done goes to Done, `forge tracker status <id> Done --comment "Released in vX.Y.Z"`, one command per ticket. The host may have closed it already; this sets its status. The hook allows a ticket whose branch passed the gates and is merged, and asks a person for one with no branch.
8. Then the retrospective (skill `retro`).

## Done when
- the version follows the commits since the last tag, and the CHANGELOG section lists every user-visible change with its ticket;
- the release merge request into `dev` and the promotion merge requests are open with complete descriptions;
- after the people's merges, `main` carries the tag `vX.Y.Z`, every ticket of the release is Done and closed, and the retro is scheduled.
