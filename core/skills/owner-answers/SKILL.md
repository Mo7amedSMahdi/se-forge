---
name: owner-answers
description: How a question is answered before it reaches the owner (decision 138) - the owner-assistant checks it against the owner's past answers, the register and the sources, and returns recorded, precedent, obvious or owner; what is never answered for the owner; the answer log every answer goes into; and how a habit of the owner's becomes a rule. Used by the owner-assistant, and by the lead when it spawns it and records answers.
---

# Answering before the owner is asked

The owner should only see a question nobody else can answer. Before a plan's or an agent's questions go to the owner, the lead spawns `owner-assistant` once with all of them. It answers what the owner has already decided, or would plainly decide the same way, and passes on the rest. It never decides anything new.

## The four verdicts
| Verdict | When | The answer |
|---|---|---|
| `recorded` | A register row (D-id), an accepted ADR, the story, the contract, or a log row with the owner's answer to the same question settles it | What the record says, with its source |
| `precedent` | The log holds at least 3 owner answers of this question's kind, every one the recommended default, and none of them changed an assistant's answer | The question's own recommended default |
| `obvious` | Exactly one option fits: the others break a D-id, the contract, the story, a kit rule or the code's existing pattern, and the one that fits is the recommended default | The recommended default, with the one source that rules the others out |
| `owner` | Anything else, and everything in the next list | Nothing: the lead asks the owner (skill `ask-owner`) |

A record that disagrees with the plan's default wins; say so in its line. When the only option that fits is not the recommended default, the plan is wrong: `owner`, with the source the default breaks.

## Never answered for the owner
- A gate question: the plan's `Gates:` line is security or architecture, or the question is about authentication, permissions, payments, personal data, the stack or the structure. That includes confirming a `Gates:` line.
- A new or updated dependency, a licence, a cost, a date, scope (what joins the build, new work).
- A product question (what users see, who may do it, which data is kept) that no record answers.
- A question whose answer would change a D-id or an accepted ADR, or where two sources disagree (that is a conflict: a tracker Task, skill `plan-ticket`).
- An action only a person can take: a merge, a tag, `forge limits lift`, approving a contract change.
- A kind the owner has taken back: any log row of that kind says `owner, changed`.

## The answer log: `.forge/project/owner-answers.md`
Every answer to a question the kit asked during the build, the owner's and the assistant's, one row each, oldest first. Start it from `log.md` in this skill's folder. The lead writes it (the assistant only reads); `forge save` takes it to the team repo.
- **Kind**: a short tag for what the question is about (`test-placement`, `retry-count`, `copy`, `e2e-budget`, `error-order`). The precedents count by it, so list the log's tags first (`awk -F'|' '/^\| [0-9]{4}-/ {gsub(/ /,"",$4); print $4}' .forge/project/owner-answers.md | sort | uniq -c`) and reuse one whenever the question is the same sort of choice (a mutation's retries are `retry-count`); a new tag only when none fits.
- **Default?**: `yes` when the answer is the option the plan recommended, `no` otherwise.
- **By**: `owner`, `assistant: recorded <source>`, `assistant: precedent`, `assistant: obvious <source>`, or `owner, changed <date> <where>` when the owner changes an assistant's answer.
- The register keeps decisions that bind later tickets (a rule, a product decision, a library), with a D-id. An answer that settles one ticket only goes in the plan and the log, not the register.

## The owner-assistant's reply
```
Owner-assistant: <plan path, or "agent questions">, <n> questions, <m> for the owner
Q1 recorded · error-order · A. <answer> · D-043
Q2 precedent · e2e-budget · A. <answer> · the default 4 of 4 times (#3 Q2, #4 Q1, #11 Q1, #16 Q2)
Q3 obvious · error-order · B. <answer> · only B keeps 409 before 404 (contract, "Errors")
Q4 owner · login · gate: security
Q5 owner · copy · product question, no record
Plan line: Answered for you (owner-assistant, decision 138): Q1 A (D-043) · Q2 A (precedent, e2e-budget) · Q3 B (contract "Errors")
Log rows:
| <date> | #14 Q1 | test-placement | <question in a few words> | A. <answer> | yes | assistant: recorded D-043 |
Rule to propose: <kind>, the default <n> of <n> times: "Planners decide <kind> themselves?"
```
- One line per question, in the plan's numbering: the verdict, the kind (every question has one, the `owner` ones too, so the lead logs the owner's answer under it), the answer, its source. The header counts the `owner` lines.
- **Plan line**: every answer you gave, in one line, for the lead to paste; none: leave it out.
- A source is a D-id, a path with a line or a section, or the log's rows by ticket and question. No source, no answer.
- **Rule to propose**: only when a kind reaches 5 owner answers in a row on the default, and the register does not give it to the planners yet.

## What the lead does with it
1. Paste the reply's plan line into the plan's section 6, under the questions, as it is; leave the questions as they are. Lanes build on these answers.
2. Append the reply's log rows, then ask the owner only the `owner` questions (skill `ask-owner`). Log each of the owner's answers under the kind the reply gave it.
3. A rule to propose goes to the owner with those questions, as a yes/no: `A. Yes: planners decide <kind>, D-<next> · B. No: keep asking`. A yes becomes a register row, and planners stop asking that kind (skill `plan-ticket`).
4. The next progress report lists the `precedent` and `obvious` answers since the last report under "Decided for you", as boxes (skill `progress-report`). For each one the owner ticks: ask it again, log the answer as `owner, changed`, and when the work was built on the old answer, file a `[Follow-up]` for the change (skill `report-issue`).
5. With the owner out of reach, an `owner` question outside the gates may still go ahead on its default, noted in the plan (skill `pipeline`); a gate question waits.

## A project that has plans already
The first time, spawn `owner-assistant` with "backfill": it reads the answered questions in section 6 of the plans in `.forge/project/plans/` and returns them as log rows (`By: owner` where the plan says the owner answered). Write them into the log, oldest first, then go on as above.

## Done when
- every question in the batch has one verdict, a kind, and a source for every answer;
- nothing on the "never answered" list was answered for the owner;
- the plan's section 6 names the answers given for the owner, the log has a row for each answer, and only the `owner` questions were asked;
- the next progress report lists the `precedent` and `obvious` answers under "Decided for you".
