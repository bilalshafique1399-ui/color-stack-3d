#!/usr/bin/env bash
set -euo pipefail

echo "=== 1. Checking Java JDK 21+ ==="
if [ -z "${JAVA_HOME:-}" ]; then
  for JVM_CANDIDATE in \
    /usr/lib/jvm/java-21* \
    /usr/lib/jvm/temurin-21* \
    /Library/Java/JavaVirtualMachines/*21*/Contents/Home \
    /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
    /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; do
    if [ -d "$JVM_CANDIDATE" ] && [ -x "$JVM_CANDIDATE/bin/java" ]; then
      export JAVA_HOME="$JVM_CANDIDATE"
      export PATH="$JAVA_HOME/bin:$PATH"
      break
    fi
  done
fi

if ! command -v java >/dev/null 2>&1; then
  echo "ERROR: Java JDK 21+ is required to compile Android SDK 36. Install Temurin JDK 21 and re-run."
  exit 1
fi

JAVA_MAJOR="$(java -version 2>&1 | head -n 1 | sed -E 's/.*"([0-9]+).*/\1/')"
if [ "${JAVA_MAJOR:-0}" -lt 21 ] 2>/dev/null; then
  echo "ERROR: Detected Java $JAVA_MAJOR, but Capacitor 8 / Android SDK 36 requires JDK 21+."
  exit 1
fi
echo "Using Java: $(java -version 2>&1 | head -n 1)"

echo "=== 2. Checking & Setting Up Android SDK ==="
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
      echo "ERROR: Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT to your Android SDK directory."
      exit 1
      ;;
  esac
  echo "Android SDK not found locally; bootstrapping official Google cmdline-tools into $HOME/android-sdk..."
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
printf "\n33b6a2b64607f11b759f320ef9dff4ae5c47d97a\n" > "$SDK_DIR/licenses/google-gdk-license"

SDKMANAGER=""
if [ -x "$SDK_DIR/cmdline-tools/latest/bin/sdkmanager" ]; then
  SDKMANAGER="$SDK_DIR/cmdline-tools/latest/bin/sdkmanager"
else
  for CANDIDATE_BIN in "$SDK_DIR"/cmdline-tools/*/bin/sdkmanager; do
    if [ -x "$CANDIDATE_BIN" ]; then
      SDKMANAGER="$CANDIDATE_BIN"
    fi
  done
fi
if [ -z "$SDKMANAGER" ] && command -v sdkmanager >/dev/null 2>&1; then
  SDKMANAGER="$(command -v sdkmanager)"
fi

if [ -n "$SDKMANAGER" ]; then
  yes | "$SDKMANAGER" --sdk_root="$SDK_DIR" --licenses >/dev/null 2>&1 || true
  "$SDKMANAGER" --sdk_root="$SDK_DIR" --install "platform-tools" "platforms;android-36" "build-tools;36.0.0" >/dev/null 2>&1 || true
fi
echo "Using Android SDK: $SDK_DIR"

echo "=== 3. Installing Web Dependencies ==="
if [ -f package-lock.json ]; then
  npm ci --legacy-peer-deps --no-audit --no-fund || npm install --legacy-peer-deps --no-audit --no-fund
else
  npm install --legacy-peer-deps --no-audit --no-fund
fi

echo "=== 4. Building Color Stack 3D Web Bundle ==="
rm -f public/color-stack-android-apk-project.zip
npm run build

echo "=== 5. Syncing Capacitor Android Project ==="
if [ ! -f "android/app/build.gradle" ]; then
  npx cap add android
fi
npx cap sync android

ESCAPED_SDK="${SDK_DIR//\\/\\\\}"
printf "sdk.dir=%s\n" "$ESCAPED_SDK" > android/local.properties

echo "=== 6. Compiling Android APK (Gradle assembleDebug) ==="
if [ ! -f "android/gradle/wrapper/gradle-wrapper.jar" ] && command -v gradle >/dev/null 2>&1; then
  (cd android && gradle wrapper --gradle-version 8.14.3)
fi
sed -i.bak 's/\r$//' android/gradlew && rm -f android/gradlew.bak
chmod +x android/gradlew
(cd android && ./gradlew clean && ./gradlew assembleDebug --no-daemon)

APK_SRC="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_SRC" ]; then
  APK_SRC="$(find android/app/build/outputs/apk/debug -name '*.apk' | head -n 1)"
fi
test -n "$APK_SRC" && test -f "$APK_SRC"
cp "$APK_SRC" ColorStack3D-debug.apk
cp "$APK_SRC" android/app/build/outputs/apk/debug/ColorStack3D-debug.apk || true

echo ""
echo "SUCCESS! APK built at: ./ColorStack3D-debug.apk"
