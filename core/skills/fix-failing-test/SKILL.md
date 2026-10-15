---
name: fix-failing-test
description: Fix a failing or flaky test by finding its cause - a product bug, a wrong test, or the environment - and fixing that, never by weakening, skipping or deleting the test. Use when the gates, CI or a reviewer report a red test.
---

# Fix a failing test

A red test is information. Never weaken an assertion, skip, `.only`-isolate, delete, raise a timeout or add a retry to make it green.

## Steps
1. **Reproduce** it alone: the single test with the stack's runner (`pytest path::name`, `dotnet test --filter`, `vitest run -t "<name>"`, `npx playwright test -g "<name>"`), output to a file, read the first failure, not the last.
2. **Classify**:
   - **Product bug**: the code breaks an acceptance criterion or the contract. Fix the code. The test stays as it is.
   - **Wrong test**: the test asserts something the acceptance criteria or the contract do not say. Change it only with that evidence, cited in the commit message (`test: AC3 says 409, not 400`), and tell the lead.
   - **Environment**: a missing service, port or container, or wrong data. Fix the setup, not the assertion.
   - **Flaky** (passes and fails without a change): find the cause — timing (waits instead of web-first assertions), order (shared data, global state), time zones or dates, parallel runs on one database. Fix it; run it 5 times.
3. Run the whole suite and the gate (`forge gates`): other tests must stay green.
4. Commit the fix alone, with the cause in the message.

If you cannot find the cause within the item's budget, stop and report: the test, the classification so far, and what you ruled out. Quarantining a test needs the owner's approval and a ticket.

## Done when
- the cause is named and fixed in the code, the test with evidence, or the setup;
- the test passes alone and in the full suite (5 runs for a flaky one), and `forge gates` is green;
- no test was weakened, skipped or deleted.
