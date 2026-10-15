# Mobile apps in Flutter (decisions 101-112)

Branch `feat/mobile-flutter`, 2026-10-11. The owner asked for a mobile engineer and every skill it needs, with
Flutter; the twelve choices were accepted as recommended (`docs/audit/2026-10-06-phase-1-audit.md`, rows 101-112).
Built in three steps, each checked by running it.

## Built
1. **The sample and the guide.**
   - `tests/stacks/flutter`: the Users app of the React sample in Flutter 3.47.7 (Dart 3.13.5), on the FastAPI sample. It has the client generated from the contract (swagger_parser, Retrofit on Dio, freezed), Riverpod 3, go_router, Material 3, gen-l10n in English and Arabic, and `Form` validators from the contract.
   - Its tests: widget and golden tests, and integration tests on the Linux build under Xvfb against the real API, keeping pictures with `FORGE_SHOTS`.
   - The kit's own image, built from Flutter's release tag: the community image stopped at 3.44, and Flutter's Linux download is x64 only.
   - Skill `stack-flutter`, written from the sample (`examples/` are copies of it).
2. **The agent and the skills.**
   - `mobile-engineer` and the plan area `mobile`: db → api → ui → mobile → infra. The engineer runs on its tier, only on an approved contract version, and the reviews and QA know the area.
   - `forge shot --dir` records the Flutter tests' pictures.
   - New skills: `new-screen`, `flutter-form`, `figma-to-widget`, `write-flutter-tests`, `mobile-release`. `rtl-i18n-check`, `api-sync`, `dev-environment`, `dockerize` and `write-unit-tests` gained Flutter sections.
3. **The starter and CI.**
   - `forge new --mobile flutter --app-id <id>`, alone or next to `backend/` and `frontend/`.
   - The Dockerfile's `android` target (Java 17, Android SDK 36, NDK 28.2, the SDK licence accepted by the owner's decision) and `android/ci-bundle.sh`.
   - The `android` CI job: debug-signed on merge requests; on release tags `vX.Y.Z` signed with the upload key from protected variables (GitHub: the `release` environment). The server checklists' section 4b says how to keep the key.

## Tested
- `tests/stacks/run.sh flutter`: 12/12. The gate, the client regenerated from the contract matches the committed one, and the integration tests pass against the real API with their pictures.
- `forge api generate` with the guide's command, from a tagged contract: an identical client.
- `tests/starter/run.sh flutter` (6/6) and `mobile-fullstack github` (10/10). The gate also runs in the dev image as built, as CI does, and the CI files lint.
- The live scenario `mobile`: 13/13 for $0.19. A Haiku lead spawned the real `mobile-engineer` (Sonnet), which built a ticket in `mobile/` next to `backend/` and finished on a green gate. A hidden acceptance test passed on the pushed branch.
- The Android bundle, emulated for amd64 on this Mac under a 4.5 GB cap:
  - debug-signed (`CN=Android Debug`);
  - signed with a throwaway upload key (`CN=forge kit test upload key`);
  - 48 MB, about 11 minutes, peak 3.7 GB with Kotlin compiling inside Gradle.
- `npm test`: 526 pass, 7 skipped.

## Found and fixed on the way
- `xvfb-run` waits forever as a container's first process: `init: true` / `--init`.
- With only `fonts-noto-core`, Flutter on Linux drew every letter as a box: DejaVu covers Latin and Arabic.
- An Android Gradle build without limits ran Docker's 6 GB VM out of memory and stalled Docker for about 30 minutes. Hence decision 111, and the cap and in-process Kotlin in the tests.
- `project.stack.mobile` was refused by the config check, which limited every agent to reading. The live scenario found it.
- The dev image had no source, so CI's gate would have run on nothing.
- `forge new` wrote binary files as text: app icons and golden pictures now copy byte for byte.

## Open
- **Separate repositories and lanes:** an app in its own repository includes `../<backend>/compose.yaml`. In a lane's worktree that path does not exist, and compose refuses to run, the gate included. This holds for React as for Flutter; one repository with `backend/` and `mobile/` works. A layout decision for the owner.
- **No live CI pipeline yet:** the CI jobs ran job by job on this Mac and lint clean, but no GitLab or GitHub pipeline has run. A runner on Apple silicon must emulate amd64 for the `android` job.
- **CI time:** every pipeline builds the Flutter image from scratch (the git clone and the SDK downloads). A cache through the registry would cut it.
- **iOS:** built and signed by a person on a Mac with Xcode (decision 111); this Mac has none, so the iOS project is untested beyond `flutter create`.
- **Material:** the move to the standalone `material_ui` package waits for Flutter to deprecate the framework copy (decision 106).
