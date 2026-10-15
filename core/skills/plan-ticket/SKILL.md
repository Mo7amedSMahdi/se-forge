---
name: plan-ticket
description: How one ticket is planned before any code - check the ticket against its user story, Figma frame and API contract, name the files, tests and risks, and give every open question a recommended answer - and the format of the plan written to .forge/project/plans/<ticket>-<slug>.md. Used by the planner agent and by anyone writing or updating a plan.
argument-hint: "<ticket id> | \"<description of the change>\""
---

# Plan one ticket

Ticket: **$ARGUMENTS**

## Steps
1. **The ticket.** A tracker id: `forge tracker get <id>` for the subject, description, acceptance criteria, parent or epic, links and status. A plain description instead is the ticket itself: the plan takes the id it names or a short slug, and the tracker steps are skipped.
2. **The story.** Open the user stories (project facts) at the epic the ticket cites, by `pages` or line ranges, after a targeted search for the right page; never the whole document. Read the rule documents next to it only when the story points to them.
3. **The frame.** Load `figma:figma-design-to-code`, find the frame with a narrow `get_metadata` under the root node of the project's Figma file (or take the node ids from `.forge/project/bootstrap/design-map.md`), and `get_screenshot` each one. Note the node ids and every state the frame shows.
4. **The API.** Look the operations up in the approved contract (`git show <newest api-v tag or api.pin>:<spec path>`, then a narrow `grep -n`). A missing operation or field means a contract change (skill `api-contract-design`, by the contract-analyst) when this team owns the backend, and a backend conflict when it does not.
5. **The areas.** Decide what the ticket really touches: `ui` (the web app), `mobile` (the Flutter app), `api`, `db`, `infra` (Dockerfiles, compose files, CI). Tracker labels (`area::…` / `area:…`) are only a hint. A db area needs the data model section (skill `data-model-design`); a new entry point, trust boundary or personal data, the threat model (skill `threat-model`).
6. **End to end.** Name the user flow, added or changed by this ticket, that the end-to-end tests must cover, or write "not applicable (<reason>)": no user-facing change, API only, or covered by ticket #n. The done check holds the plan to it (decision 50).
7. **Patterns.** Find the closest feature that already exists (`ls`, `grep -rn`) and name the files to copy from; a comparable plan in `.forge/project/plans/` helps too.
8. **Questions.** Answer what you can from the decision register (`.forge/project/bootstrap/decisions.md`), citing its D-id. Only what it leaves open becomes a question in section 6.
9. **Write the plan** in the format below. For each conflict, raise an Issues-board Task and put its id in section 6:
   `forge tracker create --subject "[Story conflict] …" --source ai --description-file <f> --type Task --status Todo --relates $ARGUMENTS --board issues --column Pending`
10. **Estimate it** (skill `estimate`): the plan's Estimate section, and the ticket's row in `.forge/project/metrics.md`. When the bootstrap draft has an estimate for the ticket (`**Estimate:**` under it in `.forge/project/bootstrap/tickets.md`), start from that and explain any difference.

## The plan: `.forge/project/plans/<ticket>-<slug>.md`
```
# <Ticket subject> (#<id>)
Status: planned on <date>, before any code | in progress | in review | in testing | blocked on #<issue>
Areas: ui | mobile | api | db | infra (comma-separated; the items run db → api → ui → mobile)
Contract: none | api-v<semver> (approved) | pending (<draft path>, version <x.y.z>)
E2E: <the user flow the end-to-end tests cover> | not applicable (<reason>)
Repo: <the system's repository it changes> (a system only, decisions 130-131: one ticket, one repository)
Branch: `feat|fix|chore/<id>-<slug>`
Gates: none | security (auth, permissions, payments or personal data) | architecture (stack or structure) | performance (a flow with a latency or load target: k6 and the performance review)
**To review: the questions in section 6.** Each has its recommended answer in **bold**, and "go with defaults" answers them all, except a question on a gate, which a person always decides.
Sources: ticket #<id> · story <E<n>-S<n>, pages> · Figma <node ids> · contract <operation names> · patterns <files>

## 1. How the sources line up
| Acceptance criterion | Story | Figma node | API | Verdict |
|---|---|---|---|---|

## 2. Built without a design
The designer draws these later.
- <what no frame shows> · role: <role or authorization subject> · where: <feature folder and route> · looks like: <the designed screen copied, node and component>

## 3. Items, one commit each (db → api → ui → mobile; grouped by repository when the apps and the backend are separate)
1. [db|api|ui|mobile|infra] <files>: <what>; pattern <file>; test <file>
## 3b. Data model (db area) · Contract change (pending contract) · Threat model (security)   (only those that apply)
## 4. Tests and gates   (the gate command)
## 5. Risks; the files of other agents, which this ticket stays out of
## 6. Open questions and conflicts
Each question with its recommended answer in bold; each conflict with its Issues-board Task id.
## Estimate   (skill `estimate`: hours per item, low and high, the main risk, the total)
## 7. Done and remaining   (the lead updates it from the lanes' reports)
Review and QA reports live in `.forge/project/reviews/<ticket>/`, not in the plan.
```
Keep a plan under about 200 lines. Point to documents by path and page instead of pasting stories or rules into it.

## Done when
- the plan exists with `Areas:`, `Contract:`, `Branch:` and `Gates:` lines (and `Repo:` in a system) and every section that applies;
- the plan has its Estimate section, and `metrics.md` the ticket's row with that estimate;
- every open question has a recommended default, and gate questions are marked for a human;
- every conflict has a tracker Task whose ID is in the plan.
