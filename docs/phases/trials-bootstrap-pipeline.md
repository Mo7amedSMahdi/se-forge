# Trials: bootstrap after approval, and the pipeline through two tickets

Branch `trials/bootstrap-pipeline` (local only). 2026-10-08. These are the two live trials still open
from step 2 and phase 5: the last bootstrap stage, and `/pipeline` running several tickets unattended.

## Setup
- **The users portal** (`tests/live/fixtures/users-portal`): a decision register (D-001 to D-011), three stories, an architecture (overview, C4 diagrams, two ADRs), the users contract, two ticket drafts and an approved review. It runs on the FastAPI sample, set up with `forge init` and the stack guide's `project.json`, so gates run in the dev containers.
- **A stateful fake GitLab** (`tests/live/fixtures/fake-gitlab/glab.js`):
  - issues with their labels and notes, and labels;
  - merge requests that track drafts and refuse a stale `--sha`;
  - a merge that really merges the source branch into `dev` in the local bare remote, as a merge commit by "GitLab".
- **A hidden acceptance test** (`test_acceptance_rules.py`) judges `dev` afterwards, in the dev container.

## Results
| Scenario | Result |
|---|---|
| `portal-dry` | 2/2. Before the tickets, the display-name tests fail. The email test already passes: the service lowercases emails. |
| `afterapproval` | 8/8, $0.47, twice (the second run after adding its cleanup). See below. |
| `pipeline2` | 8/9, $3.89, 161 tool calls. The failing check was mine, and it hid a real gap, now fixed (below). |
| `conflict` | 2/2, $0.44. Checks the fix: the planner's conflict issue is labelled `source::ai` and isn't ready. |

**`afterapproval`: bootstrap stage 8, in two sessions with your merges in between**
- **Session 1:**
  - the architecture records go on their own branch, both ADRs `accepted` in `docs/adr/`, with the overview and diagrams in `docs/architecture/`;
  - the approved contract goes at the spec path on another branch, unchanged;
  - each gets a merge request into `dev`;
  - then the lead stopped and said what waits for the owner: no tag, no tickets.
- **Session 2**, after the stand-in owner's merges:
  - `api-v1.0.0` tagged on `dev` and pushed;
  - the two tickets created in order, labelled `ai::ready`, `source::ai`, `area::api`;
  - `forge save` ran, and the build did not start;
  - `dev` moved only by the owner's merges.
- **Approvals:** the stand-in owner was asked three times: the ADR files, the spec, the tag.

**`pipeline2`: `/pipeline next` through both tickets**
- **Agents spawned:**
  - the project manager;
  - per ticket: the planner, the engineers its areas called for (db and backend for ticket 1, backend for ticket 2), the code, security and spec reviewers (plus the db reviewer for ticket 1), and QA.
- **Merges:** each ticket was merged into `dev` with `forge merge`, which passed the reviewed commit to the host. Ticket 2's branch started from `dev` with ticket 1 merged.
- **Reports:** code, security, spec and QA, each with `Verdict:` and `Commit:` lines.
- **Tickets:** both moved to "In Testing" with a comment.
- **The hidden acceptance test passes on `dev`.** `main` and `staging` are untouched, and nothing from the kit is visible to git.
- **Cleanup:** the lanes' Compose projects (four images, eight volumes, four networks) were removed afterwards.

## Found
- **The planner found a real contradiction in my fixture.** The approved contract limits `displayName` to 1–100 characters on the raw value, while D-004 says after trimming. It filed a `[Story conflict]`, recommended building the story, and carried on, since the conflict didn't block the ticket. The issue went to a person, not into the ready queue.
- **That issue lacked `source::ai`.** Decision 46 says agent-filed issues carry it, but the conflict-task commands in `planner`, `plan-ticket`, `tracker-clerk`, `tracker`, `backend-change` and `figma-align` didn't pass `--source ai`. Fixed. The `conflict` scenario checks it.
- **I was wrong that both tickets were new behaviour.** The service already lowercased emails, so D-003 held through the service only. The planner noticed: ticket 1 moved the rule into the database (a unique index on `lower(email)`, built concurrently in its own migration) and added the tests. The dry check now says exactly what holds before the tickets.
- **My first `pipeline2` check required exactly two issues.** Agents filing what they find is intended (decision 46). The check now looks at the two tickets, and requires every other issue to be agent-labelled and not ready.
- **The tracker skill's description still called GitLab a stub.** Fixed.
- **The after-approval session left a Compose project behind.** The scenario now removes what the session created, as `pipeline2` does. Its rerun removed one image, two volumes and a network.

## Open
- Only GitLab was trialled; the GitHub path for these flows runs only through its unit tests and the `merge` scenario's fake.
- The pipeline ran one ticket at a time (the default). Several lanes at once, and the 30-minute project-manager timer in a long session, weren't tried (the prompt asked for no recurring prompts).
- The `fullstack` rerun with `policy.tests` is still open, though `pipeline2` exercised the same rule through the done gate on two tickets.
