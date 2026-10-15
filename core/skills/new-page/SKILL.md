---
name: new-page
description: Add one routed screen to the React app - the route, the page in its feature folder, data through the feature's TanStack Query hooks, every state (loading, empty, error, success), access by role, strings in every language, and its tests. Use when a plan item adds or changes a page.
---

# A new page

## Steps
1. **Route** in `src/routes.tsx`, under the layout. The path follows the plan (and the design map). A page only some roles may see sits behind the project's route guard; the role rule comes from the register or the authorization matrix, never a guess.
2. **Data**: hooks in `src/<feature>/api.ts` around the generated client (skill `stack-react`), one hook per contract operation. The page never calls `fetch` or the client directly.
3. **Page** `src/<feature>/<Name>Page.tsx`, built from components (skill `figma-to-component`). It renders every state:
   - **loading:** `role="status"`;
   - **empty:** an explanation and the next action;
   - **error:** `role="alert"`; problem details shown by their title, never raw JSON;
   - **success.**
4. **Strings** in `ar.json` and `en.json` under the feature's key, and layout that works in both directions.
5. **Tests** (skill `write-unit-tests`): render the route with `renderAt('/path')` and msw. Cover each state, the role rule, and every acceptance criterion. When the plan's `E2E:` line names this page's flow, add its Playwright test (skill `write-e2e`).

## Done when
- the route, hooks and page exist, and every state renders with the right role or message;
- access follows the register's role rule;
- the tests cover each state and acceptance criterion, plus the end-to-end flow when the plan names one.
