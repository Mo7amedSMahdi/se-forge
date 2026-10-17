---
name: ask-owner
description: How every question, approval or action for the owner is written (decision 136) - short choices the owner answers in a few keystrokes (pick one, pick any, yes/no, or a free-text line when nothing fits), in the session with AskUserQuestion and in writing as numbered questions with lettered options. Use whenever the owner has to decide, approve, answer or act, and when an agent writes a question that the lead will pass on.
---

# Asking the owner

The owner should never have to read a long message to find out what you need. Every request is a choice: they answer in a few keystrokes, or write their own words when no option fits.

## The shapes
| The owner must… | Shape | In writing |
|---|---|---|
| pick one of a few ways | options, recommended first | `A. … (recommended)` `B. …` `C. …` |
| pick any number from a list | boxes | `[ ] #31 …` `[ ] #33 …` |
| say yes or no | two options that say what happens | `A. Yes: … · B. No: …` |
| take an action only a person can | what, where, the exact command, then a choice | `A. Done · B. Later` |
| give a name, a value, a date | a free-text line | `Write it: …` |

Free text alone is the last shape, not the first: when a list of likely answers exists, offer it, and the owner can still write their own.

## In the session: AskUserQuestion
- Up to 4 questions per call; more questions go in the next call, most important first.
- 2 to 4 options per question, each a label of a few words and a description of one line: what happens if chosen.
- The recommended option first, its label ending in "(Recommended)".
- `multiSelect: true` when several may apply (which follow-ups join, which findings to apply).
- A short `header` per question (at most 12 characters): `Login`, `Follow-ups`, `Limit #12`.
- "Other" is added for free text; never add an option called Other yourself.

## In writing
For a report, a digest, a plan's questions, the owner's list at the end of a session, or anything the owner reads later:

```
Needs you (3):
1. Login for the booking page? (Gates: security, plan 12 §6)
   A. Keycloak, as D-004 says (recommended)
   B. Email and password
2. Which follow-ups join the build?
   [ ] #31 Rate limit on bookings (P2)
   [ ] #33 Export to CSV (P3, new scope)
3. #12 reached its limit (4 engineer lanes). Give it one more?
   A. Yes: run `! forge limits lift 12` · B. No: it stays parked
Reply like 1A 2[31] 3B, or in your own words.
```

- Number the questions and letter the options; the reply then reads `1A 2B`.
- One line of context per question, with the path or ticket where the details are. Never hide a question inside a paragraph.
- All open questions in one message, not one at a time.

## Rules
1. **Ask only what is open.** An answer the decision register or the plan already holds is never asked again; cite its D-id instead.
2. **Gates wait.** A question on a gate (security, architecture) may carry a recommendation, but nothing goes ahead on it until the owner answers. Say so in its line.
3. **Every option is real.** Each one is something you will do as written; no option that is only there to fill the list.
4. **Agents that cannot ask** (lanes, reviewers, the planner, the project manager) write their questions in the written shape in their plan, report or digest; the lead asks them.
5. **Record and confirm.** Put each answer where it belongs (the register with a new D-id, the plan, a ticket comment) and confirm in one line: `1A: Keycloak, recorded as D-031.`
6. **Short around the choices.** What happened, in at most 3 lines, then the choices. The rest goes in the file the report points to.

## Done when
- every request to the owner is a numbered question with options, a box list, a yes/no or a one-line free-text prompt;
- the recommended option comes first and is marked, and gate questions say they wait;
- each answer is recorded where it belongs and confirmed in one line.
