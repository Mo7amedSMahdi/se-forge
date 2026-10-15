---
name: stack-flutter
description: How this team builds mobile apps - Flutter 3.47 with Dart 3.13, the API client generated from the contract (swagger_parser, Retrofit on Dio, freezed), Riverpod 3, go_router, Material 3, gen-l10n with Arabic right-to-left, Form validators from the contract, widget and golden tests, integration tests on the Linux build under Xvfb against the real API, and a dev image built from Flutter's release tag. Use on any project with a mobile app, when planning, building or reviewing mobile work.
---

# Flutter mobile app

Decisions 101-112 and 70-72. Checked by running `tests/stacks/run.sh flutter` in the kit (2026-10-11): the dev part with the FastAPI sample's compose included, and the checks. The run used Flutter 3.47.7 (Dart 3.13.5), Riverpod 3.4, go_router 18, Dio 5.11, swagger_parser 1.45, freezed 4, retrofit 4.10 and mocktail 1.0. The integration tests ran against the FastAPI sample on PostgreSQL. The files in `examples/` are copies of that sample.

## Setup
- In the dev image: `flutter create --org <reverse domain> --platforms android,ios,linux --project-name <app> mobile`. Keep `linux/`: the integration tests run on that build.
- Packages:
  - `flutter pub add dio retrofit freezed_annotation json_annotation flutter_riverpod go_router intl "flutter_localizations:{\"sdk\":\"flutter\"}"`;
  - `flutter pub add "dev:swagger_parser" "dev:retrofit_generator" "dev:freezed" "dev:json_serializable" "dev:build_runner" "dev:mocktail" "dev:integration_test:{\"sdk\":\"flutter\"}"`.
- `pubspec.yaml` pins the SDK (`environment: flutter: 3.47.7`) and sets `flutter: generate: true` for the languages. Then add `l10n.yaml`, `analysis_options.yaml` and `swagger_parser.yaml` from `examples/`.
- **The API client:** `swagger_parser.yaml` reads the contract at `/contract/openapi.yaml`, which `forge api generate` mounts read-only. The client goes to `lib/api/`; commit it and never edit it. `use_freezed3: true` is needed with freezed 3 and later.

## Layout
```
lib/api/                     generated from the pinned contract (client, models)
lib/core/api.dart            Dio and the client as providers, ApiException, apiCall (examples/api.dart)
lib/<feature>/*_providers.dart  the feature's providers (examples/users_providers.dart)
lib/<feature>/*_page.dart    screens; one route per screen
lib/router.dart              go_router in a provider; lib/app.dart MaterialApp.router; lib/layout.dart the frame
lib/l10n/app_<lang>.arb      the strings; gen-l10n writes app_localizations*.dart next to them
test/                        widget tests, test_utils.dart, golden tests and test/goldens/
integration_test/            user flows against the real API; forge_shots.dart
```

## Patterns (see `examples/`)
- **Calls:** every call goes through `apiCall(() => client.op(...))`. A problem-details answer becomes an `ApiException` with its status, title and field errors; other failures are thrown as they were. The API's address is fixed at build time: `--dart-define=API_URL=…`.
- **State (Riverpod 3):**
  - `Provider` for services;
  - `AsyncNotifier` for server data, with `NotifierProvider` / `AsyncNotifierProvider` written by hand;
  - cursor lists keep `items` and `nextCursor`, with `loadMore()` keeping the list on a failure;
  - a change invalidates the feature's provider.
  - Server data lives in providers only, never in widget state.
- **Screens:**
  - `ConsumerWidget`, with `switch (ref.watch(p)) { AsyncData() => …, AsyncError() => …, _ => spinner }`;
  - navigation by `context.go('/path')`;
  - every screen in `AppScaffold`.
- **Forms (decision 108):**
  - `Form` with validators that repeat the contract's limits;
  - the API's field errors (400) and a 409 go to their field through `forceErrorText`, cleared when the field changes;
  - `labelText` on every field (examples/new_user_page.dart).
- **Languages:** every string from `AppLocalizations.of(context)`. The ARB files have the same keys (a test checks it). Arabic is right-to-left by itself.
- **Right-to-left:**
  - use `EdgeInsetsDirectional`, `AlignmentDirectional` and `start`/`end`, never `left`/`right`;
  - format dates and numbers with `intl` in the active locale (skill `rtl-i18n-check`).
- **Material 3:** `ColorScheme.fromSeed` or the design tokens' colours, in `ThemeData` only, never in a widget. `debugShowCheckedModeBanner: false`.
- **On the device:** tokens in `flutter_secure_storage`, crash reports with `sentry_flutter` (decision 112), when the project needs them.

## Tests (skill `write-flutter-tests`)
- **Widget tests (`test/`):**
  - the real app in a `ProviderScope` with the generated client replaced by a mocktail mock (`usersClientProvider.overrideWithValue`);
  - `retry: (_, _) => null`, so a failure shows at once;
  - a phone-sized view, the language fixed;
  - find by the text and labels a person sees (`find.widgetWithText(TextFormField, 'Email')`).
- **Golden tests:** key screens per language (`matchesGoldenFile`). Text shows as boxes, so they check layout, colours and direction. Make them only in the dev image, `flutter test --update-goldens`, since pictures made on a Mac differ.
- **Integration tests (`integration_test/`):**
  - user flows on the Linux build, headless: `xvfb-run -a flutter test integration_test -d linux --dart-define=API_URL=http://api:8080`;
  - a phone-sized window;
  - each test makes its own data through the API;
  - `waitFor` pumps until a widget shows, since a spinner never lets `pumpAndSettle` end;
  - `settle` lets a menu finish opening before the tap on its item; a tap during the animation is lost;
  - wait for the widget on the next screen (`find.widgetWithText(ListTile, email)`), not for text a field also holds: `find.text` matches the field too, and the test would end before the save.
- **Pictures:** with `--dart-define=FORGE_SHOTS=1`, `keepScreen` saves each flow's last screen and its record in `build/forge-shots/` (decision 100).

## project.json
```json
"project": { "stack": { "mobile": "Flutter (Dart)" },
  "api": { "generate": "docker compose run --rm -T -v {spec}:/contract/openapi.yaml:ro mobile sh -c 'rm -rf lib/api && dart run swagger_parser && dart run build_runner build -d && dart format lib/api'", "generatedDir": "lib/api" } },
"policy": {
  "tests": { "sides": [{ "name": "mobile", "code": ["lib/**/*.dart"], "tests": ["test/**/*_test.dart"], "ignore": ["lib/api/**", "lib/l10n/app_localizations*.dart", "**/*.g.dart", "**/*.freezed.dart"] }],
             "e2e": { "tests": ["integration_test/**"], "command": "docker compose --profile e2e run --rm -T integration" } },
  "gates": { "full": "docker compose run --rm -T mobile sh -c 'dart format --output=none --set-exit-if-changed lib test integration_test && flutter analyze --fatal-infos && flutter test'" },
  "edits": { "format": [{ "glob": "{lib,test,integration_test}/**/*.dart", "command": "docker compose run --rm -T mobile dart format {file}" }] }
}
```
In a repository with a backend, add this side next to the backend's in `tests.sides`, prefix the paths with `mobile/`, and add `"dir": "mobile"` to each per-file rule (skill `dev-environment`). With a web app too, both apps have a client and `forge api generate` runs one command: run both, each in its own folder (`"(<the web app's command>) && (cd mobile && <this command>)"`), leave `generatedDir` out, and list both in `policy.paths.generated` (`["frontend/src/api/schema.d.ts", "mobile/lib/api"]`), as `forge new` does.

## Containers and devices (skills `dockerize`, `dev-environment`)
- **`examples/Dockerfile`**, four stages:
  - `flutter`: Ubuntu 24.04 with Flutter from its release tag, the Linux desktop toolchain, Xvfb and DejaVu fonts (Latin and Arabic letters; with `fonts-noto-core` alone every letter showed as a box);
  - `dev`: the packages and the source (CI runs the gate in it as built; Compose mounts the source over it), so after a `pubspec.yaml` change run `docker compose build mobile integration`;
  - `android-sdk` and `android`: Java 17, the Android SDK (compile SDK 36, build tools 36.0.0, NDK 28.2; its licence accepted, decided 2026-10-11), the packages and the source, for CI's Android build. Built for `linux/amd64`: Google ships the build tools for x86-64 only. The build peaked at 3.7 GB of memory (Gradle at 2 GB, Kotlin compiling inside it; `android/gradle.properties`) and took 11 minutes emulated on a Mac.
  There is no production image: the app ships to the stores.
- **`examples/compose.yaml`:**
  - it includes the backend's compose file, so `docker compose up -d --wait` runs the database and the API;
  - `mobile` (profile `tools`) runs the gate;
  - `integration` (profile `e2e`) runs the integration tests against that API;
  - `/app/.dart_tool` stays in the container, so the Mac's own Flutter keeps working;
  - `init: true` on both (`docker run --init` elsewhere): without an init process, `xvfb-run` waits forever for Xvfb's start signal.
- **On a phone:**
  - a person runs `flutter run --dart-define=API_URL=http://localhost:8080` on the Mac, with the iOS simulator (Xcode) or an Android emulator (Android Studio; it reaches the Mac at `10.0.2.2`), for hot reload;
  - agents don't run simulators.
- **Builds (decision 111):**
  - CI's `android` job builds the app bundle with `examples/ci-bundle.sh` (in `android/`): signed with the debug key on merge requests, with the upload key on release tags (skill `ci-pipeline`). `android/app/build.gradle.kts` reads the key from `android/key.properties`, which only CI writes.
  - A person builds and signs iOS on a Mac with Xcode (skill `mobile-release`).
  - The local gate builds neither: an Android build in Docker on a Mac can use up Docker's memory.

## Done when
- the change follows the layout and patterns above, with every string in each ARB file and directional layout only;
- the gate passes, every new widget behaviour has a widget test, changed screens have their golden pictures remade in the dev image, and the plan's E2E flow has an integration test that passes against the real API;
- the generated client was regenerated from the pinned contract if the contract changed, and never edited by hand.
