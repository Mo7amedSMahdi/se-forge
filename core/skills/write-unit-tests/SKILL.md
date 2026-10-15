---
name: write-unit-tests
description: Write unit and component tests from the acceptance criteria and the contract, not from the code - named after the criteria, covering success, boundaries, errors and permissions, failing before the change and passing after. Use for every plan item, in any stack (pytest, xUnit, Vitest, Testing Library).
---

# Unit and component tests

Tests prove the acceptance criteria. Written from the code, they only prove the code does what it does.

## Steps
1. List the item's acceptance criteria (the plan, the spec) and the contract's status codes for its operations.
2. Per criterion, the cases: the success case, the boundaries (empty, maximum, just over), the errors and the permission cases. Name each test after its criterion (`AC2: a valid form is sent once and confirmed`).
3. Write the tests **before** the code, run them, and see them fail for the right reason. A test that passes before the change proves nothing.
4. Arrange, act, assert; one behaviour per test; no logic in tests (no loops or branches that decide what to assert).
5. Test doubles only at the boundary (clock, network, outside services); never mock the unit under test or its own collaborators inside the module. Databases: the stack's Testcontainers setup (skill `stack-*`), not a mock.
6. Implement until they pass; then refactor with the tests green.

## Per stack
- Python: pytest (`async def test_...`), httpx for API tests (skill `stack-fastapi`).
- .NET: xUnit `[Fact]` / `[Theory]`, WebApplicationFactory for API tests (skill `stack-dotnet`).
- Node: Vitest `*.spec.ts`, Supertest for API tests (skill `stack-nestjs`).
- Flutter: widget tests with flutter_test and mocktail on the real app, golden pictures and integration tests (skill `write-flutter-tests`).
- React: Vitest + Testing Library. Query like a user: `getByRole`, `getByLabelText`, `getByText`, never CSS classes or test ids first; act with `user-event`; assert with jest-dom matchers. With explicit Vitest imports (no globals), register `afterEach(() => cleanup())` in the setup file, or earlier renders leak into later tests.

The done check refuses a branch that changes a side's code (frontend, mobile, backend; `policy.tests`) without new or changed tests on that side.

## Done when
- every acceptance criterion and every contract status code of the item has at least one test named after it;
- the tests failed before the change and pass after it;
- no test is skipped, focused (`.only`) or asserting nothing.
