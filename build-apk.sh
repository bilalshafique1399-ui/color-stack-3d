#!/usr/bin/env bash
set -euo pipefail

echo "=== Installing Dependencies ==="
npm install --legacy-peer-deps --no-audit --no-fund

echo "=== Building Color Stack 3D Web Bundle ==="
rm -f public/color-stack-android-apk-project.zip
npm run build

echo "=== Syncing Capacitor Android Project ==="
npx cap sync android

echo "=== Compiling Android APK (Gradle assembleDebug) ==="
chmod +x android/gradlew
(cd android && ./gradlew assembleDebug --no-daemon)

cp android/app/build/outputs/apk/debug/app-debug.apk android/app/build/outputs/apk/debug/ColorStack3D-debug.apk

echo ""
echo "SUCCESS! APK built at: android/app/build/outputs/apk/debug/ColorStack3D-debug.apk"
