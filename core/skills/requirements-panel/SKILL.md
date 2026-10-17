---
name: requirements-panel
description: The bootstrap's requirements panel (stage 7, decision 114) - before the owner's single review, a panel of seats (backend, frontend, mobile, database, security, QA, architecture, tickets, and devops or performance when they apply) reads the drafts, each through its own discipline; the lead applies what fits the register and puts the rest to the owner in the review. One round, no new scope. Run by the lead in /bootstrap; the seats follow their part of it.
---

# The requirements panel

Decision 114. The point is to find now what the build would otherwise find later as new issues, so that the tickets the owner approves are the tickets that get built. The panel reviews; it never adds scope.

## The lead
1. **Seats.** Pick them from `seats.md` in this folder: every seat whose condition holds for this project. Record the seats, and why each optional one sits, in `.forge/project/bootstrap/README.md`.
2. **Spawn every seat at once**, in the background, in one message, with the role and the model `seats.md` gives. Each prompt:
   > Requirements panel, seat `<seat>` (skill `requirements-panel`). Read the drafts by these absolute paths: <the register `decisions.md`, `user-stories.md`, `authorization-matrix.md`, `architecture/`, the screens (`design-map.md`, `design-system.md`, `screens/`) when they exist, `contract.yaml`, `tickets.md`>. Write `.forge/project/bootstrap/panel/<seat>.md` as `findings.md` says.

   The description names the seat (`Panel: security`), so the timeline shows it. Wait for every seat.
3. **Read the reports** in `.forge/project/bootstrap/panel/`, not what the seats said in chat.
4. **Decide each finding** and write `.forge/project/bootstrap/panel/summary.md` from `summary.md` in this folder. Merge the findings two seats raised, keeping both ids.
   - **apply**: it fits the requirements and the register (a gap, a contradiction, an untestable criterion, a missing operation, a wrong order, a ticket too large);
   - **owner**: it needs a decision the register does not hold (new scope, a register decision to revisit, two seats that disagree). Write it as a choice (skill `ask-owner`): lettered options with your recommendation first, and each seat's view in a few words;
   - **reject**: it is wrong, already covered, or out of scope; one line on why, which the owner sees.

   A must that fits the register is applied. A should or a note is applied when it is cheap and inside the register; otherwise it goes to the owner or is rejected with the reason.
5. **Apply.** Rerun only the stages the applied findings touch, in the bootstrap's order (stories, architecture, screens, contract, ticket drafts), each stage once, with its findings as the task list: "Apply panel findings BE2, SE1 and QA4 from `.forge/project/bootstrap/panel/summary.md`; change nothing else." A finding that changes an earlier draft reaches the later ones too (a new operation changes the contract and the ticket drafts). Check each finding against the new draft and mark it done in the summary.
6. **One round.** The panel does not sit again on the reruns; you check them. Then the owner's review (stage 8) opens with the panel's result.

## The seats
Follow `seats.md` for your seat's checklist and `findings.md` for the report. Read only; never edit a draft; nothing new on your own: what the requirements and the register do not ask for is a question for the owner.

## Rules
- The seats never edit the drafts and never wait for each other. You decide each finding; the owner decides what you cannot.
- No new scope through the panel: anything the requirements and the register do not ask for goes to the owner, never into the drafts.
- No issue is created and nothing is marked ready during the panel.

## Done when
- every seat picked has its report in `.forge/project/bootstrap/panel/`;
- `summary.md` gives every finding a decision (apply, owner, reject), and every applied finding is marked done against the rerun draft;
- the owner's review lists what the panel changed, what it rejected and why, and the decisions it leaves to the owner.
