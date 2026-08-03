#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> prebuild android..."
npx expo prebuild --platform android --no-install

echo "==> gradle assembleRelease..."
(cd android && ./gradlew assembleRelease)

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/app-release.apk
echo "==> APK: dist/app-release.apk"
