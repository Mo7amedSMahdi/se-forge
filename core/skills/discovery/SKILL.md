---
name: discovery
description: The discovery interview at the start of a new project - read the requirements, find what they leave open in every category (users, scope, rules, data, integrations, libraries, security, performance, languages, stack, hosting, design source, delivery), get the owner's answers (interactively in rounds, or from a filled questionnaire), and write the decision register agents answer their questions from. Used by /bootstrap, step 1.
argument-hint: "<requirements files> [--answers <filled questionnaire>]"
---

# Discovery: the full picture before any work

The goal: after this interview, agents can answer their own questions from the register. Only something the register does not cover goes back to the owner (decisions 42, 43).

## Steps
1. **Read the requirements** (PRD, ERD, brief, screens) by pages or ranges. Per category in `questionnaire.md` (this skill's folder), note what they already decide, with the page.
2. **Write the questionnaire**: `.forge/project/bootstrap/questionnaire.md`, from the template. Ask only what the documents leave open or unclear; record what they answer as "from the requirements, page n". Every question gets options and a recommended default with a one-line reason. Stack questions offer the team's options:
   - frontend: React + TypeScript with Vite;
   - backend: .NET 10, NestJS or FastAPI;
   - database: PostgreSQL, SQL Server, MySQL/MariaDB or MongoDB.
3. **Get the answers**:
   - With `--answers <file>` (the owner or the client filled the questionnaire in), read it and ask only what is still blank or contradictory.
   - Otherwise ask the owner in rounds (AskUserQuestion, skill `ask-owner`), up to 4 related questions per round, 2 to 4 options each, recommended option first.
   - Questions about security, the stack or the architecture never take a default: they wait for the owner.
4. **Write the register**: `.forge/project/bootstrap/decisions.md`, from `register.md` in this skill's folder. One row per decision (`D-001`, …) with its category, the decision, its source (owner and date, questionnaire, or requirements page) and what it means for the agents. List the approved libraries per stack, the security rules per feature, and anything still open.
5. **Check coverage**:
   - every category has decisions or "not applicable" with the reason;
   - no decision contradicts the requirements without a note;
   - every role in the requirements has its permissions.
   Anything missing goes back to step 3.
6. **Project settings.** Never edit `project.json` directly first: an invalid file locks every agent to read-only until a person fixes it.
   1. Copy it to `.forge/project/bootstrap/project.proposed.json` and fill in what the register fixes, using only these keys:
      - `project.stack`: `{ "frontend", "backend", "database", "cloud", "other" }`, as plain text such as "React + TypeScript (Vite)", "FastAPI", "PostgreSQL 17";
      - `project.design.source`: `kit`, `figma`, `pdf` or `images`;
      - `project.api.spec`: the contract's path in the backend repo;
      - `project.db` and `policy.gates`, `edits`, `commit`, `tests`: the snippet in the backend's stack guide (skill `stack-*`);
      - `policy.deps.approved`: **one flat list** of package names for all stacks, e.g. `["zod", "httpx"]`.
      Everything else (query style, repo layout, rules) stays in the register only.
   2. Check it: `forge config check .forge/project/bootstrap/project.proposed.json`, and fix the proposal until it says `valid`.
   3. Write the checked content into `.forge/project/project.json`. The edit asks the owner, and that click approves the settings.
7. Tell the leader: the register's path, the number of decisions, anything open.

## Done when
- every category in the questionnaire is answered or marked not applicable with a reason;
- the register exists with sources, and the approved libraries are in `policy.deps.approved`;
- no security, stack or architecture question was answered by a default.
