# The panel's seats

| Seat | Id | Agent | Sits when | Reads first |
|---|---|---|---|---|
| backend | BE | `requirements-reviewer` | the project has an API | stories, authorization matrix, contract, tickets |
| frontend | FE | `requirements-reviewer` | the project has a web UI | stories, screens, contract, tickets |
| mobile | MO | `requirements-reviewer` | the project has a mobile app | stories, screens, contract, tickets |
| database | DB | `requirements-reviewer` | the project stores data | stories, architecture, contract, tickets |
| security | SE | `security-reviewer` | always | register, stories, authorization matrix, architecture, contract |
| qa | QA | `requirements-reviewer` | always | stories, tickets, contract |
| architecture | AR | `architect` | always | stories, contract and tickets, against `architecture/` |
| tickets | TK | `project-manager` | always | tickets, against the stories |
| devops | OP | `requirements-reviewer` | the register names hosting or deploys, or an outside service (mail, payments, maps, single sign-on) | register, architecture, tickets |
| performance | PF | `performance-reviewer` | `architecture/nfr.md` sets a number for a flow | `nfr.md`, contract, stories |

Each agent runs on its own tier (`project.models`): the security reviewer and the architect on the deep tier, the others on the standard tier. A seat's findings are numbered with its id: `SE1`, `SE2`.

## backend
- Every action in the stories has its operation in the contract, with the request, the response and every error a story or rule implies (not found, conflict, validation, forbidden).
- Business rules are precise enough to code: limits as numbers, states and their changes, deadlines with their time zone, uniqueness, what happens at each edge.
- Each operation's access matches the authorization matrix.
- Lists have the paging, sorting and filters the stories need.
- Inputs: lengths, formats and character sets the API accepts, and what it refuses.
- Work that happens by itself (a poll closing at its deadline, an email, a reminder): what triggers it, when, and what if it fails.

## frontend and mobile
- Every story has its screens, and every screen in the map belongs to a story.
- Each screen's states: loading, empty, error, partial data, long text, many items, right-to-left and every language the register names.
- Forms: each field's rules match the contract's validation; the message the user sees for each error the contract returns.
- Navigation: how each screen is reached, where each action leads, deep links (mobile).
- What each role sees and cannot see, from the authorization matrix.
- Mobile only: offline and poor network, push, what the stores require (privacy details, account deletion).

## database
- Every entity and field the stories imply, with its type, whether it is required, and its default.
- Uniqueness and relations written as constraints (one vote per person per poll: unique on which fields?).
- Deletes: what happens to related data, soft or hard, what must be kept (history, audit).
- Volumes and growth (from `nfr.md` or the register), and the indexes the lists and filters need.
- Time: how deadlines and dates are stored and compared, and in which time zone.
- The seed and reference data the first tickets need.

## security
At the requirements level, with the threat model per entry point (skill `threat-model`) and ASVS level 2 as the measure (name the requirement):
- The authorization matrix against every operation and every object: who reads or changes whose data.
- Identity: sign-in, sessions, anonymous use, and how abuse is limited (rate limits, one-per-person rules, what identifies a person or a device, and whether a client can forge it, such as `X-Forwarded-For`).
- Personal data: what is collected, why, how long it is kept, who sees it.
- Inputs: lengths, character sets and control characters the API accepts, uploads, links.
- Transport: HTTPS, the security headers, CORS.
- Secrets and outside services: which keys exist and who provides them.

## qa
- Every acceptance criterion can be tested: a number instead of "fast", a list instead of "etc.", a stated result for each action.
- The edge cases each criterion leaves open: empty, maximum, duplicates, two people at once, time boundaries, permissions.
- The test data each ticket needs, and what cannot be tested locally (outside services, email, time).
- Each ticket's criteria are enough to call it done, and the main journeys are named as end-to-end flows.

## architecture
- The stories, the contract and the tickets keep to the architecture: its containers, boundaries and decision records.
- Every target in `nfr.md` has the tickets and the test (a load test, a gate) that meet it.
- Nothing in the drafts needs a component the architecture lacks (a queue, a scheduler, file storage, a cache).
- Do not reargue the architecture itself here: what you would change is a question for the owner.

## tickets
- Each ticket is one slice of a story that one lane can finish; an estimate over one day's work is split.
- The order: database before API before UI, foundations first; every dependency named and earlier.
- No story without a ticket, no ticket without a story, no two tickets doing the same thing.
- Each ticket has its acceptance criteria, areas, gates and estimate.

## devops
- The environments, how each is reached, and the hosting the register chose.
- Every outside service: the account, keys and settings someone must provide, and by when (a ticket waiting for a key stalls the build).
- The backups, logs and monitoring the register asks for, each with its ticket.
- Where secrets live (never in the repository).

## performance
- Each target in `nfr.md` is measurable on a named flow with its load, and a ticket holds the test.
- The lists, searches and reports that grow with the data have paging and indexes in the drafts.
