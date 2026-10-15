---
name: mobile-release
description: Prepare a release of the Flutter app for the stores (decision 111) - the version and build number, store release notes in every language, the Android app bundle built by CI and the iOS build a person makes on a Mac with Xcode, signing kept out of the repository, and the test tracks (TestFlight, Google Play internal testing) before production. Use when the owner wants to ship the mobile app.
---

# Mobile release

People sign, upload and publish (decisions 43, 111); this skill prepares everything they need. Agents never touch signing keys, store accounts or uploads.

## Steps
1. **What is new and the version:** as skill `release` (steps 1-3), on the app's commits. In `pubspec.yaml`, `version: X.Y.Z+N`:
   - X.Y.Z is that version;
   - N, the build number, only goes up: one more than the last build either store has seen, since the stores refuse one they already have.
2. **Store release notes** ("What's new") from the CHANGELOG section, in every language the app ships, in the users' words: at most 500 characters for Google Play. They go in the release merge request's description, with the screens whose store screenshots need a refresh (`forge shot` lists the latest pictures of each).
3. **The release branch and promotions** as skill `release` (steps 4-6): the version commit, the merge requests, and the tag a person creates after the merge into `main`.
4. **Android:** on the tag, CI's `android` job (GitHub: `android-release`) builds the signed app bundle with `android/ci-bundle.sh` (skill `ci-pipeline`): `flutter build appbundle --release --dart-define=API_URL=<production API>`.
   - The upload key and its passwords come from protected CI variables (`core/server/<host>.md`, section 4b), written to `android/key.properties` and the keystore file inside the job's container only.
   - Google Play App Signing holds the app signing key.
   - A person downloads the bundle from the job's artefacts and uploads it to the **internal testing** track.
5. **iOS:** a person on a Mac with Xcode, signed in to the team's Apple Developer account, runs `flutter build ipa --release --dart-define=API_URL=<production API>`. They upload it with Xcode's Organizer or Transporter to **TestFlight**.
6. **Check on real phones** (a person, from the test tracks):
   - the release's flows, in each language and direction;
   - sign-in and sign-out, without a connection, after an update from the previous version;
   - the crash reporter receives a test event (decision 112).
   Problems become `[Bug]` issues (skill `report-issue`).
7. **Production:** a person promotes the tested builds in Google Play Console and App Store Connect, with the release notes. Then the retrospective (skill `retro`).

## Done when
- `pubspec.yaml` has the new version and a build number neither store has seen;
- the release notes are in the release merge request in every language, and the release and promotion merge requests are open with complete descriptions;
- the Android bundle and the iOS build are on the test tracks, and the owner has the real-phone checklist.
