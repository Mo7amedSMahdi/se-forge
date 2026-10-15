---
name: new-screen
description: Add one screen to the Flutter app - the go_router route, the screen in its feature folder, data through the feature's Riverpod providers, every state (loading, empty, error, success), access by role, strings in every ARB file, and its widget tests. Use when a plan item adds or changes a mobile screen.
---

# A new mobile screen

## Steps
1. **Route** in `lib/router.dart`: a `GoRoute` under its parent, with the path the plan (and the design map) gives. A screen only some roles may see sits behind the router's `redirect` guard. The role rule comes from the register or the authorization matrix, never a guess.
2. **Data:** providers in `lib/<feature>/<feature>_providers.dart` around the generated client, each call through `apiCall` (skill `stack-flutter`):
   - an `AsyncNotifier` per list or detail;
   - a change as a method on the notifier that invalidates what it changed. The method uses the notifier's own `ref`, never the screen's after an `await`.
   - The screen never calls Dio or the client itself.
3. **Screen** `lib/<feature>/<name>_page.dart`: a `ConsumerWidget` (or `ConsumerStatefulWidget` for a form) inside `AppScaffold`, built from widgets (skill `figma-to-widget`). It renders every state with a `switch` on the provider's value:
   - **loading:** a progress indicator with a `semanticsLabel`;
   - **empty:** an explanation and the next action;
   - **error:** a translated message; an `ApiException` by its meaning, never raw JSON;
   - **success.**
4. **Strings** in every `lib/l10n/app_<lang>.arb` under the feature's prefix, with the same keys. Layout that works in both directions: `EdgeInsetsDirectional`, `AlignmentDirectional`, `start`/`end`.
5. **Tests** (skill `write-flutter-tests`):
   - widget tests on the real app with the client mocked: each state, the role rule, every acceptance criterion;
   - a golden picture per language when the plan's design shows the screen;
   - an integration test when the plan's `E2E:` line names the flow.

## Done when
- the route, providers and screen exist, and every state renders with the right role or message;
- access follows the register's role rule;
- every string is in each ARB file, and the layout is directional only;
- the tests cover each state and acceptance criterion, plus the golden pictures and the integration flow when the plan calls for them.
