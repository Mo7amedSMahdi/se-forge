---
name: write-flutter-tests
description: Write the Flutter app's tests from the acceptance criteria and the contract - widget tests on the real app with the generated client mocked (mocktail), golden pictures per language made in the dev container, and integration tests on the Linux build under Xvfb against the real API, which keep pictures for forge shot. Use for every mobile plan item, before the code.
---

# Flutter tests

Decision 109. The patterns are in `stack-flutter/examples/` (`test_utils.dart`, `users_test.dart`, `golden_test.dart`, `users.integration_test.dart`, `forge_shots.dart`), checked by `tests/stacks/run.sh flutter`. The rules of skill `write-unit-tests` hold: tests from the criteria, written first, failing for the right reason before the code.

## Steps
0. The plan's `E2E:` line says which flow needs an integration test (decision 50). When it names one, the done check refuses the branch until a file in `integration_test/` changed and the e2e command passes.
1. **Widget tests** (`test/<feature>_test.dart`), one per criterion, named after it:
   - **Setup:** pump the real app (`pumpApp`) in a `ProviderScope` with the generated client replaced by a mocktail mock (`<feature>ClientProvider.overrideWithValue(mock)`). Set `retry: (_, _) => null`, a phone-sized view and a fixed language.
   - **Stubbing:** state each call the test expects (`when(() => client.op(...)).thenAnswer(...)`). A problem-details failure is the `DioException` the client throws (`problem(409)` in `test_utils.dart`).
   - **Finding and acting:** find widgets as a person sees them: `find.text`, `find.widgetWithText(TextFormField, 'Email')`, `find.byTooltip`. Act with `tap` and `enterText`, then `pumpAndSettle` (no real network here).
   - **Requests:** check what was sent with `verify`, and that nothing was sent with `verifyNever`.
2. **Right-to-left:** one test per screen in Arabic checks `Directionality.of(…)` and the translated title.
3. **Golden pictures** (`test/golden_test.dart`) for the screens the plan's design shows, one per language (`matchesGoldenFile('goldens/<screen>_<lang>.png')`). Text shows as boxes, so they guard layout, colours and direction.
   - Make or remake them only in the dev container: `docker compose run --rm -T mobile flutter test --update-goldens test/golden_test.dart`. Pictures made on a Mac differ in their pixels.
   - Remake one only when the change was meant, and say so in the report; `test/failures/` shows the difference.
4. **Integration tests** (`integration_test/<flow>_test.dart`), the plan's flows against the real API:
   - **Setup:** the app inside `RepaintBoundary(key: screenKey, …)` in a phone-sized view. Each test makes its own data through the API with unique values.
   - **Waiting:**
     - `waitFor` until the next screen's widget shows: a spinner never lets `pumpAndSettle` end;
     - `settle` before tapping into a menu or a sheet that is still opening;
     - wait for a widget on the next screen (`find.widgetWithText(ListTile, email)`), not for text a field also holds.
   - **Pictures:** end each flow on the screen that shows its result, and call `keepScreen(tester, '<what it shows>', test: '<file>')`. With `--dart-define=FORGE_SHOTS=1` it keeps the picture and its record in `build/forge-shots/` for `forge shot --dir` (decision 100).
5. **Run them:**
   - the gate: `docker compose run --rm -T mobile sh -c 'dart format --output=none --set-exit-if-changed lib test integration_test && flutter analyze --fatal-infos && flutter test'`;
   - the integration tests: `docker compose --profile e2e run --rm -T integration`, or one file: `… run --rm -T integration xvfb-run -a flutter test integration_test/<file> -d linux --dart-define=API_URL=http://api:8080`;
   - redirect the output to a file and read its last lines.

## Done when
- every acceptance criterion has a widget test named after it, and every documented error status of the screen's operations is tested;
- the screens the design shows have golden pictures in each language, made in the dev container;
- the plan's E2E flow has an integration test that passes against the real API and ends on the screen that shows its result;
- no test is skipped, no golden picture was remade to hide a difference, and nothing waits a fixed time where a widget can be awaited.
