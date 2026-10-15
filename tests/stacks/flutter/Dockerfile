# The Flutter toolchain (decisions 101, 109-111). Flutter's Linux download is x64 only, so the SDK comes from
# its release tag: the same `flutter` stage on arm64 and amd64.
#   dev      the gate, the generated client and the integration tests (Compose mounts the source over /app;
#            CI runs the gate in it as built)
#   android  the Android app bundle, for CI only (decision 111): docker build --platform linux/amd64 --target android
FROM ubuntu:24.04 AS flutter
ARG FLUTTER_VERSION=3.47.7
ENV DEBIAN_FRONTEND=noninteractive FLUTTER_HOME=/opt/flutter PUB_CACHE=/opt/pub-cache
# The Linux desktop toolchain for the integration tests, Xvfb to run them headless, and DejaVu fonts, which
# cover Latin and Arabic letters. Not fonts-noto-core: with it alone every letter showed as a box.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils zip \
      clang cmake ninja-build pkg-config libgtk-3-dev liblzma-dev libstdc++-12-dev \
      xvfb xauth libegl1 libgl1-mesa-dri fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*
RUN git clone --depth 1 --branch "$FLUTTER_VERSION" https://github.com/flutter/flutter.git "$FLUTTER_HOME"
ENV PATH=$FLUTTER_HOME/bin:$PUB_CACHE/bin:$PATH
RUN flutter config --no-analytics --no-cli-animations >/dev/null && dart --disable-analytics \
 && flutter precache --linux --no-android --no-ios --no-web && flutter --version

FROM flutter AS dev
WORKDIR /app
# The packages live in the image: after a pubspec change, `docker compose build mobile`.
COPY pubspec.yaml pubspec.lock l10n.yaml ./
COPY lib/l10n/*.arb lib/l10n/
RUN flutter pub get --enforce-lockfile
# The source, for CI, which runs the gate in this image as built; Compose mounts it over /app instead.
COPY . .
CMD ["sleep", "infinity"]

# Java and the Android SDK at the versions Flutter 3.47 builds with (compile SDK 36, NDK 28.2, which the
# build fetches otherwise on every run). Google ships the Android build tools for x86-64 Linux only, so this
# stage is built for linux/amd64.
FROM flutter AS android-sdk
ARG ANDROID_TOOLS=16111833
ARG ANDROID_TOOLS_SHA1=e025545c62a8e64c7559119566a569fb1dec5f60
ENV ANDROID_HOME=/opt/android-sdk
ENV PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH
RUN apt-get update && apt-get install -y --no-install-recommends openjdk-17-jdk-headless && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL -o /tmp/tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_TOOLS}_latest.zip" \
 && echo "${ANDROID_TOOLS_SHA1}  /tmp/tools.zip" | sha1sum -c - \
 && mkdir -p "$ANDROID_HOME/cmdline-tools" && unzip -q /tmp/tools.zip -d "$ANDROID_HOME/cmdline-tools" \
 && mv "$ANDROID_HOME/cmdline-tools/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" && rm /tmp/tools.zip
# This accepts the Android Software Development Kit License Agreement for the image: every Android build
# needs it, as Android Studio asks on a developer's Mac (decided by the owner, 2026-10-11).
RUN yes | sdkmanager --licenses >/dev/null \
 && sdkmanager --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;28.2.13676358" >/dev/null \
 && flutter config --android-sdk "$ANDROID_HOME" >/dev/null && flutter precache --android

FROM android-sdk AS android
WORKDIR /app
COPY pubspec.yaml pubspec.lock l10n.yaml ./
COPY lib/l10n/*.arb lib/l10n/
RUN flutter pub get --enforce-lockfile
COPY . .
CMD ["sh", "android/ci-bundle.sh"]
