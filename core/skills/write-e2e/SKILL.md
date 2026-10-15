---
name: write-e2e
description: Write end-to-end tests with Playwright for the user flows in the acceptance criteria - real browsers (Chromium, Firefox, WebKit) against the production build, locators by role and label, web-first assertions, isolated test data, traces on failure. Use for flows that cross screens or the API, after the unit tests.
---

# End-to-end tests (Playwright)

Decision 39. Checked on the kit's React sample (`tests/stacks/run.sh react`: Playwright 1.63 in `mcr.microsoft.com/playwright:v1.63.0-noble`, against the real FastAPI sample API); its config and a spec are in skill `stack-react`'s examples.

## Setup (once per project)
- `project.json`: `"tests": { "e2e": { "tests": ["e2e/**"], "command": "npx playwright test" } }`, next to the frontend side `{ "name": "frontend", "code": ["src/**/*.{ts,tsx}"], "tests": ["src/**/*.test.{ts,tsx}"] }` in `tests.sides`.
- `npm install -D @playwright/test`; browsers: `npx playwright install --with-deps`, or run in the official image of the same version.
- `playwright.config.ts`: `testDir: 'e2e'`, `use: { baseURL, trace: 'on-first-retry', screenshot: process.env.FORGE_SHOTS ? 'on' : 'off' }`, `retries: process.env.CI ? 2 : 0`, `forbidOnly: !!process.env.CI`, projects for Chromium, Firefox and WebKit, and a `webServer` that builds and serves the production build (`npm run build && npm run preview -- --port 4173 --strictPort`).

## Steps
0. The plan's `E2E:` line says which flow to cover (decision 50). When it names one, the done check refuses the branch until an end-to-end test changed (`policy.tests.e2e.tests`) and `policy.tests.e2e.command` passes.
1. One test per user flow from the acceptance criteria, named after it. Flows cross screens or the API; single-component behaviour belongs in unit tests (skill `write-unit-tests`).
2. Locators like a user sees the page: `getByRole('button', { name })`, `getByLabel`, `getByText`. Add a `data-testid` only where no accessible name exists, and say why.
3. Web-first assertions only: `await expect(locator).toHaveText(...)`, `toBeVisible()`. Never fixed waits (`waitForTimeout`).
4. Test data through the API or a seed, not through the UI; every test creates its own data (unique emails), so tests run in parallel and in any order.
5. Run: `npx playwright test` (all browsers), `npx playwright test --project=chromium -g "<name>"` while working. On a failure: `npx playwright show-trace test-results/<test>/trace.zip`.
6. RTL and locales: the flows that differ run once per locale the project ships (projects with a locale and `dir`), when the plan says so.
7. Screens (decision 100): with `FORGE_SHOTS=1` each test leaves a picture of its last screen, and the QA engineer keeps them with `forge shot --playwright` when a UI ticket passes; the dashboard shows them by time, named after the test. So end each flow on the screen that shows its result (the saved item in the list, the error on the field), not on a spinner.

## Done when
- every user flow in the acceptance criteria has a test that passes in Chromium, Firefox and WebKit on the production build;
- no fixed waits, CSS-structure selectors or shared test data;
- a failure leaves a trace (`trace: 'on-first-retry'` in CI).
