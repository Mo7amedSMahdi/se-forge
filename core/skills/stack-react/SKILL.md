---
name: stack-react
description: How this team builds the frontend - React + TypeScript with Vite, the API client generated from the contract (openapi-typescript + openapi-fetch), TanStack Query, React Router, react-hook-form + zod, shadcn/ui + Tailwind with logical properties, i18next with Arabic right-to-left, Vitest + Testing Library + msw, Playwright, and a Caddy image. Use on any project with a React frontend, when planning, building or reviewing UI work.
---

# React frontend

Decisions 39, 52-58 and 70-73. Checked by running `tests/stacks/run.sh react` (the dev part with the FastAPI sample's compose included) and `tests/ci/run.sh <gitlab|github> react` in the kit (2026-10-08). The run used React 19, Vite 8, TypeScript 6, React Router 8, TanStack Query 5, zod 4, Tailwind 4, shadcn 4 (radix, nova), i18next 26, msw 2 and Playwright 1.63; the end-to-end tests ran against the FastAPI sample. The files in `examples/` are copies of that sample.

## Setup
- `npm create vite@latest <app> -- --template react-ts`. The template enables `erasableSyntaxOnly`, so write class fields instead of constructor parameter properties.
- Tailwind: `tailwindcss` and `@tailwindcss/vite`; `@import "tailwindcss";` in `src/index.css`; the `@/*` alias in both tsconfigs and in Vite.
- shadcn/ui: `npx shadcn@<version> init -t vite -b radix -p nova --rtl -y --no-monorepo`, then `npx shadcn add <components>`. Generated components live in `src/components/ui/`; exclude that folder from oxlint's `only-export-components` rule.
- **The API client:** run `npx --yes openapi-typescript@7.13.0 {spec} -o src/api/schema.d.ts` through npx at a pinned version, never as a dependency (it requires TypeScript 5). It is the project's `project.api.generate`, run by `forge api generate`. Commit `schema.d.ts`; never edit it.

## Layout
```
src/api/client.ts        openapi-fetch client, ApiError (problem details), orThrow (examples/client.ts)
src/api/schema.d.ts      generated from the pinned contract
src/<feature>/api.ts     TanStack Query hooks per operation (examples/api.ts)
src/<feature>/*Page.tsx  screens; one route per page
src/routes.tsx           the route objects; src/Layout.tsx the shell; App.tsx the providers
src/i18n/                index.ts (i18next, lang and dir), ar.json, en.json
src/components/ui/       shadcn components (generated, then owned by the project)
e2e/                     Playwright user flows
```

## Patterns (see `examples/`)
- **Calls:** `api.GET('/v1/…', { params })` and `orThrow(...)`. A problem-details response becomes an `ApiError` carrying the problem. Create the client with `fetch: (r) => globalThis.fetch(r)`, so msw (which patches `fetch` later) is used in tests.
- **Server state:** TanStack Query only. Cursor lists use `useInfiniteQuery` with `getNextPageParam: p => p.nextCursor`. Mutations invalidate their feature's key. No server data in component state or Zustand.
- **Forms:**
  - react-hook-form with `zodResolver`; the zod schema repeats the contract's limits, with translation keys as messages;
  - the API's `errors: [{ field, message }]` go to `setError(field)`, and a 409 to its field;
  - `aria-invalid` and `aria-describedby` on inputs (examples/NewUserPage.tsx; skill `form-builder`).
- **Languages:** every string through `t('…')`; `ar.json` and `en.json` have the same keys. The document's `lang` and `dir` follow the language; Arabic is right-to-left.
- **RTL:** use logical classes only, `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, never `ml-`, `mr-`, `left-`, `right-`. Dates and numbers through `Intl` with the active language (skill `rtl-i18n-check`).
- **Same-origin API:** `/v1` is proxied: by Vite in dev and preview (`API_URL`), by Caddy in the image.

## Tests
- **Components:** Vitest, Testing Library and msw (`examples/test-setup.ts`, `test-utils.tsx`, `users.test.tsx`). Render the real routes in a memory router with a fresh QueryClient (`retry: false`). Every test states its own API responses (`server.use(http.get('*/v1/…', …))`), and `onUnhandledRequest: 'error'` fails tests that call unmocked endpoints. Query by role and label.
- **End to end:** Playwright on the production build (`vite preview`, with `/v1` proxied to a real API) in Chromium, Firefox and WebKit (`examples/playwright.config.ts`, `users.e2e.spec.ts`; skill `write-e2e`).

## project.json
```json
"project": { "stack": { "frontend": "React + TypeScript (Vite)" },
  "api": { "generate": "npx --yes openapi-typescript@7.13.0 {spec} -o src/api/schema.d.ts", "generatedDir": "src/api/schema.d.ts" } },
"policy": {
  "tests": { "sides": [{ "name": "frontend", "code": ["src/**/*.{ts,tsx}"], "tests": ["src/**/*.test.{ts,tsx}"], "ignore": ["src/api/schema.d.ts", "src/components/ui/**"] }],
             "e2e": { "tests": ["e2e/**"], "command": "docker compose --profile e2e run --rm -T e2e" } },
  "gates": { "full": "docker compose run --rm -T --no-deps web sh -c 'npm run typecheck && npm run lint && npm test'" },
  "edits": { "lint": [{ "glob": "src/**/*.{ts,tsx}", "command": "docker compose run --rm -T --no-deps web npx oxlint {file}" }] }
}
```
In a single repo with a backend, add this side next to the backend's in `tests.sides`, and prefix the paths with the frontend's folder.

Everything runs in the dev container (decision 72): the gate, the per-file checks and the migrations go through `docker compose run`. In one repository holding both services, prefix the globs with the service's folder and add `"dir": "<folder>"` to each per-file rule (skill `dev-environment`). The end-to-end command starts the API it needs (the e2e service depends on it).

## Containers (skills `dockerize`, `dev-environment`)
- `examples/Dockerfile`: the `dev` target on the Playwright image (Node and the three browsers; `vite --host 0.0.0.0`), so the gate and the end-to-end tests run in it; then the production image: `npm ci` and `npm run build` on `node:24-bookworm-slim`, `caddy:2-alpine` serving `dist` as an unprivileged user on port 8080, with `try_files` for client-side routes and `/v1/*` proxied to `API_URL` (`Caddyfile`).
- `examples/compose.yaml`: includes the backend's compose file (here `../fastapi/compose.yaml`; in separate repositories, a checkout of the backend next to this one), so `docker compose up -d --wait` runs the database, the API and Vite with hot reload on both sides; `web` waits for a healthy API; the `e2e` service (profile `e2e`) runs Playwright on the production build against that API.

## Done when
- the change follows the layout and patterns above, with every string in both language files and logical classes only;
- the gate passes, every new component behaviour has a test, and the plan's E2E flow has a Playwright test that passes in the three browsers;
- the generated client was regenerated from the pinned contract if the contract changed, and never edited by hand.
