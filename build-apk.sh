#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Checking Java JDK 17+ ==="
if [ -z "${JAVA_HOME:-}" ]; then
  for JVM_CANDIDATE in \
    /usr/lib/jvm/java-17* \
    /usr/lib/jvm/java-21* \
    /usr/lib/jvm/zulu-17* \
    /usr/lib/jvm/temurin-17* \
    /usr/lib/jvm/temurin-21* \
    /Library/Java/JavaVirtualMachines/*17*/Contents/Home \
    /Library/Java/JavaVirtualMachines/*21*/Contents/Home \
    /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; do
    if [ -d "$JVM_CANDIDATE" ] && [ -x "$JVM_CANDIDATE/bin/java" ]; then
      export JAVA_HOME="$JVM_CANDIDATE"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java JDK 17+ is required to compile Android SDK 34. Install JDK 17 or 21 and re-run."
  exit 1
fi
echo "Using Java: $(java -version 2>&1 | head -n 1)"

echo "=== 2. Checking & Setting Up Android SDK 34 ==="
SDK_DIR="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [ -z "$SDK_DIR" ] || [ ! -d "$SDK_DIR" ]; then
  for CANDIDATE in \
    "$HOME/Android/Sdk" \
    "$HOME/Library/Android/sdk" \
    "/usr/local/lib/android/sdk" \
    "/usr/lib/android-sdk" \
    "$HOME/android-sdk"; do
    if [ -d "$CANDIDATE" ]; then
      SDK_DIR="$CANDIDATE"
      break
    fi
  done
fi

if [ -z "$SDK_DIR" ] || [ ! -d "$SDK_DIR" ]; then
  OS_NAME="$(uname -s)"
  case "$OS_NAME" in
    Linux*)  CMD_OS="linux" ;;
    Darwin*) CMD_OS="mac" ;;
    *)
      echo "ERROR: Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT."
      exit 1
      ;;
  esac
  echo "Android SDK not found locally; bootstrapping Google cmdline-tools into $HOME/android-sdk..."
  SDK_DIR="$HOME/android-sdk"
  mkdir -p "$SDK_DIR/cmdline-tools"
  curl -fsSL "https://dl.google.com/android/repository/commandlinetools-${CMD_OS}-11076708_latest.zip" -o /tmp/cmdline-tools.zip
  unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-tools-extract
  mv /tmp/cmdline-tools-extract/cmdline-tools "$SDK_DIR/cmdline-tools/latest"
  rm -rf /tmp/cmdline-tools.zip /tmp/cmdline-tools-extract
fi

export ANDROID_HOME="$SDK_DIR"
export ANDROID_SDK_ROOT="$SDK_DIR"
export PATH="$SDK_DIR/platform-tools:$PATH"

mkdir -p "$SDK_DIR/licenses"
printf "\n8933bad161af4178b1185d1a37fbf41ea5269c55\nd56f5187479451eabf01fb78af6dfcb131a6481e\n24333f8a63b6825ea9c5514f83c2829b004d1fee\n859f317696f67ef3d7f30a50a5560e7834b43903\n" > "$SDK_DIR/licenses/android-sdk-license"
printf "\n84831b9409646a918e30573bab4c9c91346d8abd\n504667f4c0de7af1a06de9f4b1727b84351f2910\n" > "$SDK_DIR/licenses/android-sdk-preview-license"

SDKMANAGER=""
if [ -x "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  SDKMANAGER="$SDK_DIR/cmdline-tools/latest/bin/sdkmanager"
elif command -v sdkmanager >/dev/null 2>&1; then
  SDKMANAGER="$(command -v sdkmanager)"
fi

if [ -n "$SDKMANAGER" ]; then
  yes | "$SDKMANAGER" --sdk_root="$SDK_DIR" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --sdk_root="$SDK_DIR" --install "platform-tools" "platforms;android-34" "build-tools;34.0.0" >/dev/null 2>&1 || true
fi
echo "Using Android SDK: $SDK_DIR"

echo "=== 3. Building Color Stack 3D Web Bundle & Syncing Assets ==="
if [ -f package.json ] && command -v npm >/dev/null 2>&1; then
  npm install --legacy-peer-deps --no-audit --no-fund
  rm -f public/color-stack-android-apk-project.zip
  npm run build
  node scripts/sync-android-assets.mjs
fi

ESCAPED_SDK="${SDK_DIR//\\/\\\\}"
printf "sdk.dir=%s\n" "$ESCAPED_SDK" > android/local.properties

echo "=== 4. Compiling Standalone Android APK (Gradle assembleDebug) ==="
sed -i.bak 's/\r$//' android/gradlew && rm -f android/gradlew.bak
chmod +x android/gradlew
(cd android && ./gradlew clean assembleDebug --no-daemon)

APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
cp "$APK_SRC" ColorStack3D-APK-RealAds.apk

echo ""
echo "SUCCESS! APK built at: ./ColorStack3D-APK-RealAds.apk"
