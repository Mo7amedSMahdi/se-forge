---
name: report-issue
description: File a problem found outside your own task as a tracker issue instead of fixing it or dropping it - [Bug] from engineers and QA, [Follow-up] for reviewers' non-blocking findings outside the branch's own changes - after a duplicate check, labelled source ai, linked to where it was found. Use whenever you notice something that is not yours to change.
---

# Report an issue

You noticed a problem outside your task: a bug in other code, a review finding that is not a blocker, a failing case QA found, missing documentation. Don't fix it in this branch and don't leave it in a report only: file it.

## Steps
1. **Duplicates**: `forge tracker list json > /tmp/open.json`, then search the titles (`jq -r '.[].title' /tmp/open.json | grep -i "<key words>"`). If one exists, comment your evidence on it instead (`forge tracker comment <id> "…"`) and stop.
2. **Write** the body to a file:
   - **What:** one sentence.
   - **Where:** `file:line`, endpoint or screen.
   - **How to reproduce**, for a bug: the steps, expected and actual result.
   - **Which approved acceptance criterion or contract operation it breaks**, when you can name one. This lets the project-manager mark it ready.
   - **Found while:** ticket #<id>, branch, your role.
3. **File** it: `forge tracker create --subject "[Bug] <short title>" --type Bug --source ai --area <area> --relates <ticket> --description-file <file>`. Use `[Follow-up]` and `--type Task` for a non-blocking review finding outside the branch's own changes. Never file one while reviewing a ticket that is itself a `[Follow-up]`, and never for code the branch changed: those stay in your report (decision 115).
4. Never add `--ready`, and never set its status: the project-manager triages it. Mention the issue id in your report to the lead.

## Done when
- the problem is an issue (or a comment on an existing one) with evidence and a link to where it was found;
- your own branch does not contain a fix for it.
