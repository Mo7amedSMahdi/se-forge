#!/bin/sh
# The Android app bundle (decision 111; skill mobile-release), run by CI in the Dockerfile's android image.
# With the upload key (ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD,
# protected CI variables) the bundle is signed for Google Play; without it, on merge requests, it is signed
# with the debug key and only proves the app builds. API_URL is the API the release talks to.
set -eu
if [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  umask 077
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 -d > android/upload.jks
  printf 'storeFile=../upload.jks\nstorePassword=%s\nkeyAlias=%s\nkeyPassword=%s\n' \
    "$ANDROID_KEYSTORE_PASSWORD" "$ANDROID_KEY_ALIAS" "$ANDROID_KEY_PASSWORD" > android/key.properties
fi
flutter build appbundle --release --dart-define=API_URL="${API_URL:-http://localhost:8080}"
