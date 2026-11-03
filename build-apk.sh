#!/usr/bin/env bash
set -euo pipefail

echo "=== Installing Dependencies ==="
if [ -f package-lock.json ]; then
  npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
else
  npm install --legacy-peer-deps --no-audit --no-fund
fi

echo "=== Building Color Stack 3D Web Bundle ==="
rm -f public/color-stack-android-apk-project.zip
npm run build

echo "=== Syncing Capacitor Android Project ==="
npx cap sync android

echo "=== Compiling Android APK (Gradle assembleDebug) ==="
chmod +x android/gradlew
(cd android && ./gradlew assembleDebug --no-daemon)

APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
test -f "$APK_SRC"
cp "$APK_SRC" ColorStack3D-debug.apk
cp "$APK_SRC" android/app/build/outputs/apk/debug/ColorStack3D-debug.apk

echo ""
echo "SUCCESS! APK built at: ./ColorStack3D-debug.apk (and android/app/build/outputs/apk/debug/ColorStack3D-debug.apk)"
