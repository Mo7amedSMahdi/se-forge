---
name: api-sync
description: Regenerate the typed API client from the approved contract version the project pins (forge api generate), verify the change is additive, and record what changed. Use when the plan's Contract: version is newer than the client, or a ticket needs an operation the client lacks.
---

# Sync the API client

1. The generated client is never edited by hand; the guard hook refuses it. It comes from the approved contract: the `api-v` tag in `project.api.pin`, or in a single repository the tag on the plan's `Contract:` line. Pinning a newer version is a person's change to project.json, never an agent's.
2. `forge api generate > /tmp/apigen.log 2>&1; tail -5 /tmp/apigen.log`. It fetches the spec at the pinned tag and runs the project's generate command on it.
3. Size up the change from the diff instead of reading the files:
   - how much: `git diff --stat -- <generated client> | tail -3`;
   - which exports: `git diff -- <generated client> | grep -E '^[-+]export (type|const|interface|class|function)' | sort | uniq -c | head -40`;
   - a Flutter app: `git diff -- lib/api | grep -E '^[-+](abstract class|class|enum) |^[-+]  Future<' | sort | uniq -c | head -40`.

   An export, class or method that disappeared or got a new name is a **breaking** backend change: stop, write it into the plan, and raise an Issues-board Task through the `tracker` skill (`[Backend request] …`).
4. Run the gate command with its output in `/tmp/gates.log` and grep that for errors. Fix the compile errors in your own feature only; errors in another agent's files go into your report, and their files stay untouched.
5. The regenerated client is a commit of its own: `git add <generated client> && git commit -m "chore(api): regenerate client from spec"`, with the Co-Authored-By line.
6. An operation the ticket needs that is still missing afterwards is a conflict with the backend: a plan question and an Issues-board Task. Never fill the gap with a hand-written stub in the client.

## Done when
- the client was regenerated with `forge api generate` from the pinned version, and committed alone;
- the export diff is recorded, and any removed or renamed export is raised as a breaking change;
- the gates pass for your own feature's code.
