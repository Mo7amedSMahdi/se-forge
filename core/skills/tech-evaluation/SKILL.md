---
name: tech-evaluation
description: Comparing technologies for one need - a library, framework, database, service or tool - against weighted criteria (fit, maintenance, security record, licence, team skills, operating cost, lock-in), with a timed spike when the facts are uncertain, ending in a recommendation for an ADR. Use before adding any technology the team does not already run, and whenever a plan or the register asks "which X".
---

# Technology evaluation

Fill `template.md` into `.forge/project/architecture/evaluations/<topic>.md`. The result goes into an ADR
(skill `adr-writer`); adding the dependency still asks a person (decision 6) unless the register approved it.

## Rules
- Start from the need and the register's drivers, not from a product. The team's current choice (stack guides, decisions 34-38, 52-58) is always an option, and wins ties.
- Facts are checked at the source, with the date: latest release and its date, release cadence, open security advisories (the project's advisories page, the GitHub Advisory Database, OSV), licence file, supported runtime versions. No facts from memory.
- Licence: permissive (MIT, Apache-2.0, BSD) is fine; copyleft (GPL, AGPL), source-available or a changed licence goes to the owner.
- Maintenance red flags: no release in 12 months, one maintainer, archived, unanswered security issues, a major version with no migration path.
- Prefer what runs in the local containers we already have (decision 70) over a new service.

## Steps
1. State the need in one sentence and the drivers (D-ids, NFRs) with weights 1-3.
2. List two to four options, including the team's current choice and "build it ourselves" when it is small.
3. Collect the facts per option (table in the template), each with its source link and date.
4. Score each option 1-5 per criterion, multiply by the weight, total. A must-have it fails (licence, security, runtime support) knocks it out whatever its score.
5. When a score depends on something you cannot know from documents (performance on our data, an integration), propose a spike: a time box (hours), the question it answers, and the measure. A person approves the time.
6. Recommend one option with the deciding reasons and the risks; draft the ADR.

## Done when
- every option has dated, sourced facts and a score per weighted criterion, and knock-outs are explicit;
- the team's current choice was one of the options;
- the recommendation and its ADR draft are ready for the owner.
