---
name: spec-writer
description: Turn a thin ticket or a request in a few words into a short feature spec the owner approves before planning - problem, users and roles, scope, acceptance criteria in Given/When/Then, data, API needs, UI states and non-functional needs, with open questions. Use when a ticket has no clear acceptance criteria; plan-ticket follows it.
argument-hint: "<ticket id> | \"<request>\""
---

# Write a feature spec

Input: **$ARGUMENTS**

A plan needs acceptance criteria to test against. When the ticket or the user story does not give them, write the spec first. Never invent behaviour: what the sources do not say becomes a question with a recommended default.

## Steps
1. Read the ticket (`forge tracker get <id>`), the story it cites (by pages or ranges), and the Figma frame and contract operations it names. Note what each source says.
2. Fill `template.md` (in this skill's folder) into `.forge/project/specs/<ticket>-<slug>.md`. Keep it under 80 lines.
3. Acceptance criteria: numbered (`AC1`, `AC2`, …), Given/When/Then, one behaviour each, testable, including the error and permission cases. They become the test names.
4. Ask the owner the open questions in one message (AskUserQuestion, skill `ask-owner`), recommended default first. Questions on a gate (security, architecture) wait for the owner; they are never defaulted.
5. Put the answers into the spec, mark it `Status: approved (<date>, <who>)`, and comment the acceptance criteria on the ticket (`forge tracker comment <id> --file <spec>`).
6. Hand over to `plan-ticket`, which cites the spec.

## Done when
- the spec has numbered, testable acceptance criteria covering success, errors and permissions;
- every open question has the owner's answer, or is a gate question waiting for them;
- the spec is marked approved and the ticket carries its acceptance criteria.
