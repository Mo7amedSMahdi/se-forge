# Phase 5a: the frontend guide, frontend skills, exact colours from provided screens

Branch `phase-5a/frontend` (local only). 2026-10-08. Decisions 52-69 were accepted as recommended. This part covers 52-58 and 68.

## Built
- **A frontend sample** (`tests/stacks/react`), the users app on the sample contract:
  - the API client generated with openapi-typescript and openapi-fetch;
  - TanStack Query, React Router 8, react-hook-form + zod (the API's field errors and 409 on their fields);
  - shadcn/ui (Radix, nova style, RTL) + Tailwind 4 with logical properties;
  - i18next with Arabic right-to-left and English;
  - Vitest + Testing Library + msw component tests, and Playwright end to end;
  - a Caddy image, serving the app as an unprivileged user and proxying `/v1` to the API.
- **`run.sh react`, 8 steps:**
  - the gate;
  - the client matches the contract;
  - the real API: the FastAPI image on PostgreSQL, migrated;
  - Playwright in Chromium, Firefox and WebKit on the production build against that API;
  - the web image builds, serves the app and proxies `/v1`.
- **The `stack-react` guide:** setup, layout, patterns, tests, the `project.json` snippet with `policy.tests` (frontend side and E2E) and the image. Its 12 example files are kept identical to the sample by the drift test.
- **Skills:**
  - `figma-to-component`, `new-page` and `form-builder`;
  - `rtl-i18n-check`, with commands for physical directions, untranslated text and missing language keys. They were run on the sample (clean) and on planted problems (found).
  The frontend engineer and the UI reviewer load them.
- **`forge design sample`:** read-only exact colours from provided screens: the palette, a region, or points. PNG is decoded in Node; JPEG and PDF go through `sips` or ImageMagick first. The designer and reviewers may run it, and `design-intake` marks sampled colours "sampled".

## Learned about the tools
- **openapi-typescript 7.13 requires TypeScript 5,** and the Vite template uses 6. It runs through `npx` at a pinned version and stays out of the project's dependencies.
- **openapi-fetch keeps the `fetch` it had at import time.** The client looks it up per call, so msw (which patches it later) is used in tests.
- **The template's `erasableSyntaxOnly`** forbids constructor parameter properties.
- **shadcn's CLI** needs `-t vite -b radix -p nova --rtl -y --no-monorepo` to run without prompts.
- **Agents run commands in the login shell (zsh on macOS),** so patterns such as `--include='*.tsx'` must be quoted.

## Tested

| What | Result |
|---|---|
| `npm test` on macOS | 395/395, 6 opt-in skipped |
| `run.sh react` | 8/8 (6 component tests; Playwright 2 flows × 3 browsers against the real API) |
| `forge design sample` | 4/4: every PNG filter, palette, region and points; the discovery screen's header `#0F766E`; JPEG through sips |
| Live `stackguide-react` | 2/2, $0.01: a React project's session loads `stack-react` and answers the client, the 409 and the RTL margin from it |

## Proposals (accepted 2026-10-08, decision 87)
- **msw** mocks the API in component tests; every test states its own responses.
- shadcn's **nova** style on **Radix**.
- **End-to-end tests run against the production build** (`vite preview`), with `/v1` proxied to a real API.

## Open
- **5b:** containers and CI/CD.
- **5c:** architecture and quality.
- The `fullstack` rerun with `policy.tests`, and the stage 7 live run, are still to do.
