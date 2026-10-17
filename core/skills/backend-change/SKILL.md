---
name: backend-change
description: What the lead does when the backend team (another repository or team) announces an API change - keep their guide, have contract-analyst check it against the tagged spec, the stories, Figma and our code, take the business questions to the owner, raise tracker Tasks, draft our reply, and propose tickets, the first of which regenerates the client.
disable-model-invocation: true
argument-hint: "<guide text, or a file in .forge/project/backend-updates/>"
---

# A backend update arrived

The guide: **$ARGUMENTS**

The backend lives in another repository and team; we never change it. Our side of the contract is the approved version we pin (`project.api.pin`, an `api-v` tag in the backend repo) and the client generated from it. Backend guides and our replies live in the team repo, `.forge/project/backend-updates/`, never in the client repo. Run, in order:

1. **Keep the guide** exactly as it came, in `.forge/project/backend-updates/<YYYY-MM-DD>-<slug>-<ticket>.md`, with nothing added (when you were given a path, it is there already).
2. **Facts (lead, cheap):** the backend's newest `api-v` tag (`git ls-remote --tags <project.api.contractRepo> 'api-v*'`) against our pin; the spec at that tag (`forge api check --spec` on a downloaded copy, `jq` the new or changed paths); `grep` whether the generated client already has them; `forge tracker get <backend ticket>`. Never regenerate the client on the current branch.
3. **The analysis:** spawn `contract-analyst` (opus) with the guide's path, the spec and pointers to the stories, the Figma nodes and our code. It writes `.forge/handoffs/contract-<feature>.md`: the alignment tables; where the guide and the spec differ (the tagged spec is right, and the backend is told); the conflicts, each with a drafted Task; the answers it recommends to the backend's questions; and the frontend tickets it proposes.
4. **The owner's decisions:** anything that is the business's call (what users see, who may do it, how much is in scope) is the owner's. Ask with AskUserQuestion (skill `ask-owner`), a single narrow question each time, and put the option you recommend first.
5. **Tasks and the reply:** `tracker-clerk` raises the `[Backend request]` and `[Story conflict]` Tasks (`--source ai`, status Todo, nobody assigned, the Issues board's Pending column, related to the backend's ticket). Write our answer to the backend as `.forge/project/backend-updates/<date>-reply-<slug>.md`, shaped like the earlier replies in that folder; the owner sends it.
6. **Tickets:** once the owner agrees, `tracker-clerk` creates the frontend tickets in To Do on the frontend board. The first one is always "pin the new version and regenerate the client": a person sets `project.api.pin`, then the skill `api-sync` runs on a branch and in a commit of its own. Each ticket then goes through `/pipeline <ticket>`, planned by the `planner` (opus).
7. Run `forge save` so the guide, the report and the reply reach the team repo.

## Done when
- the guide and the draft reply are saved in `.forge/project/backend-updates/`;
- the contract-analyst's report exists, and every business question has the owner's answer or is recorded as open;
- the raised tasks and the proposed tickets exist in the tracker, and `forge save` ran.
