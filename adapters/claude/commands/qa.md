---
description: QA on a ticket branch by the qa-engineer agent (sonnet) - the gates, a table from each acceptance criterion to its test, and a verdict; a PASS moves the ticket to "In Testing".
argument-hint: "<ticket> <branch>"
---
Spawn the `qa-engineer` agent for $ARGUMENTS. It runs the gate command with the output going to files and writes `.forge/project/reviews/<ticket>/qa.md`; on PASS it keeps pictures of a UI or mobile ticket's screens (`forge shot`) and runs `forge tracker status <id> "In Testing"` with a comment. Then report its verdict.
