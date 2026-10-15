---
name: adr-writer
description: Writing an architecture decision record in MADR 4.0.0 (decision 66) - one decision per record, the options considered with their pros and cons, the chosen option tied to the register's decision drivers, how compliance is confirmed - drafted for a person to accept, then kept in the client repository's docs/adr/. Use for any stack, structure, data or integration decision, or when a plan has `Gates: architecture`.
---

# Architecture decision records (MADR)

`template.md` is MADR 4.0.0's full template, unchanged (github.com/adr/madr, tag 4.0.0).
`examples/0001-cursor-pagination-for-lists.md` is a filled record; both are checked by
`forge docs check` (`tests/architecture/run.sh`).

## When a decision needs a record
A choice that is costly to reverse or that others must follow: a framework, database or library of
consequence, a service boundary, a data model shape, an integration style, a security mechanism, a
deviation from a team decision. Not for a choice a single file contains.

## Steps
1. **Number and name:** the next free number in `docs/adr/` and `.forge/project/architecture/adr/` together, four digits, and a title in lowercase words joined by dashes that states the solved problem and the solution: `0007-postgresql-full-text-search-for-patients.md`.
2. **Draft** from `template.md` in `.forge/project/architecture/adr/`:
   - front matter: `status: proposed`, today's `date`, `decision-makers` (the owner or the person named in the register), `consulted`, `informed`;
   - **Context and Problem Statement**: two or three sentences ending in the question; cite the register's D-ids and the story;
   - **Decision Drivers**: the requirements and qualities that decide it, each traceable (D-id, NFR, constraint);
   - **Considered Options**: at least two real ones, including "keep what we have" when it applies;
   - **Decision Outcome**: `Chosen option: "<title>", because <the drivers it meets that the others do not>`; **Consequences** good and bad; **Confirmation**: the check, test, review or metric that shows the code follows it;
   - **Pros and Cons of the Options**: Good / Neutral / Bad lines per option; a new technology links its evaluation (skill `tech-evaluation`);
   - **More Information**: when to revisit, links.
   Remove the template's comments and every optional section you do not fill.
3. **Check:** `forge docs check .forge/project/architecture/adr/<file>`.
4. **Decision:** the record goes to the owner (in the bootstrap's single review, or as a `Gates: architecture` question): options, your recommendation, the consequences. Their answer sets `status: accepted` or `rejected`, and the `date`.
5. **Into the repository:** the lead copies accepted records to `docs/adr/` on a `chore/adr-<number>` branch with its merge request; committing them asks a person, who merges it.
6. **Changing a decision later:** never rewrite an accepted record. Write a new one, and set the old one's status to `superseded by ADR-<new number>` in the same merge request.

## Done when
- the record follows MADR 4.0.0 and `forge docs check` passes on it;
- it has at least two options, the chosen one tied to traceable drivers, and a confirmation;
- its status reflects a person's decision, and an accepted record is in `docs/adr/` through a merge request a person merged.
