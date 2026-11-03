# Color Stack 3D — Android APK Cloud Build & Clean Artifact Packaging

Deliver a production-ready Capacitor Android Debug APK build pipeline, harden mobile runtime and cloud compilation edge cases, keep official Google AdMob Test IDs active for safe device verification, and export clean Android project and GitHub Actions workflow folders directly into artifacts.

### User Review & Critical Decisions

> [!IMPORTANT]
> Your three configuration choices from our planning check are locked in below. Review the architecture and click **Proceed** to generate the updated workflow, hardened mobile build, and artifact folders.

- **Confirmed Decision 1 — Build Variant**: Produce an install-ready **Debug APK** (`assembleDebug`) signed automatically with the standard Android debug keystore so you can sideload and test immediately on any Android phone without managing production signing secrets yet.
- **Confirmed Decision 2 — AdMob Configuration**: Retain **official Google AdMob Test IDs** (persistent bottom adaptive banner + interstitial every 3 game overs) in test mode so real device testing is 100% policy-safe before swapping in live production ad units later.
- **Confirmed Decision 3 — Workflow Triggers**: Trigger the GitHub Actions APK cloud build both **automatically on branch pushes** (`main` / `master`) and **on-demand via the manual Run Workflow button** (`workflow_dispatch`).
- **Artifact & Packaging Guarantee**: Strip transient build caches and redundant lockfile assumptions so both the exported **Android** and **GitHub Actions** artifact folders—and the in-app one-click project archive—contain only clean, essential build sources.

---

### 1. Overview & Core Concept

- **What It Does**: Bridges the interactive 3D Color Stack game—complete with progression tiers, 3D spinning gold coins, tactile vibration haptics, international referral rewards, saved withdrawal profiles, and AdMob test monetization—into a clean, cloud-compilable Android APK package with exported build artifacts.
- **Target Audience / Persona**: Mobile players installing and testing the portrait 3D arcade game on Android hardware, and the project owner compiling verifiable test APKs in GitHub Actions without needing a heavy local Android Studio installation.
- **Key Value**: Eliminates silent CI failures (such as lockfile cache mismatches, missing Java 21 / Android SDK 36 toolchains, or missing Gradle wrapper execute permissions) while providing clean, clutter-free native Android and CI workflow deliverables in the workspace artifacts.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **In-App APK & Mobile Setup Flow**: From the game header, tapping the APK button opens the dedicated mobile setup dialog where the user can download the clean single-archive Android project, copy the one-line build command, verify active AdMob Test IDs, or view GitHub Actions cloud build instructions.
  2. **Cloud APK Compilation Flow**: Pushing the exported repository to GitHub (or clicking *Run workflow* in the Actions tab) installs dependencies, compiles the optimized web bundle, syncs native Capacitor plugins, runs Gradle with JDK 21, and publishes the installable Debug APK as a downloadable workflow artifact.
  3. **On-Device Android Test Flow**: Installing the Debug APK launches into full-screen portrait mode with dark splash framing, responsive 60fps Three.js block stacking, native device vibration feedback, persistent bottom test banner ads, interstitial test ads every third game over, and safe authentication error guidance if WebView popup restrictions occur.
- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Tactile arcade spatial clarity—combining a full-bleed 3D isometric tower canvas with crisp, thumb-friendly dark translucent HUD surfaces.
  - *Color Palette & Mood*: Deep midnight navy canvas (`#131629` / `--background`), elevated slate-indigo modal surfaces (`#141830`), crisp off-white foreground text, and high-contrast semantic accents (amber gold for coins/combos, rose-to-amber action gradients for primary CTAs, emerald for verified test states).
  - *Typography & Hierarchy*: Geometric display headings paired with clean sans body copy and strict `tabular-nums` monospace alignment for scores, coin balances, USD equivalents, and AdMob unit identifiers.
  - *Component Styling & Layout*: Full-viewport 3D canvas (`100dvh`) with floating top HUD and bottom thumb-zone actions keeping aggregate sticky overlays well within the 15% mobile viewport cap; every interactive button enforces a minimum `44px × 44px` hitbox (`48px` height on primary CTAs) and single-line `whitespace-nowrap` labels with zero static pill clutter.
- **Interactive Feedback & Motion**:
  - Immediate `<150ms` tactile press scaling (`active:scale-[0.98]`), Web Audio synthesized feedback paired with Android hardware `VIBRATE` patterns on block drops, combos, coin pickups, and game over, plus instant clipboard confirmation states in the APK setup modal.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Lockfile-Resilient GitHub Actions Pipeline with JDK 21 & SDK 36**
  - *Chosen Approach*: Configure the GitHub Actions workflow on Ubuntu with Node.js 22, Temurin JDK 21, Android SDK setup, explicit Gradle wrapper execution permissions, Gradle build caching, and dependency installation that does not crash when `package-lock.json` is absent.
  - *Why*: Capacitor 8 and Android Gradle Plugin 8.13 require Java 21 and SDK 36; additionally, relying on strict `npm` lockfile caching in repos without a `package-lock.json` causes immediate CI runner failure before compilation even starts.
  - *Alternatives Considered*: Using Java 17 or `npm ci` with mandatory lockfile caching—rejected because Java 17 fails Capacitor 8 compilation and `npm ci` aborts on fresh repository uploads lacking `package-lock.json`.

- **Decision 2: Official AdMob Test Mode Isolation**
  - *Chosen Approach*: Keep Google's official Android Test App ID and Banner/Interstitial Test Unit IDs wired across both the native Android manifest resources and the runtime AdMob manager (`initializeForTesting: true`, `isTesting: true`).
  - *Why*: Prevents accidental invalid-traffic policy flags during APK sideload testing while exercising the exact native Capacitor AdMob SDK lifecycle (bottom adaptive banner + 3-game-over interstitial cadence) so swapping to live IDs later is a pure ID replacement.
  - *Alternatives Considered*: Stubbing ads out completely in native builds—rejected because you specifically want to test real native AdMob banner layout and interstitial transitions in the test APK first.

- **Decision 3: Clean Artifact & Archive Filtering (Zero Junk Bloat)**
  - *Chosen Approach*: Exclude transient Gradle build outputs, IDE metadata, local SDK path overrides, and recursive archive files when generating both the downloadable project archive and the artifact folders (`android` and `.github`).
  - *Why*: Keeps the exported artifacts lightweight, portable across machines and CI runners, and easy to upload directly to a GitHub repository.
  - *Alternatives Considered*: Copying raw build caches—rejected because machine-specific caches bloat downloads by hundreds of megabytes and break cross-platform Gradle builds.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                     COLOR STACK 3D — HYBRID RUNTIME                     │
│                                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   ┌─────────────┐  │
│  │  Three.js 3D Engine  │   │  Wallet & Referrals  │   │  APK Setup  │  │
│  │  • Tower & Coins     │   │  • Daily Bonus       │   │    Modal    │  │
│  │  • Tier Progression  │   │  • Saved Payout Info │   │  • Download │  │
│  │  • Audio + Haptics   │   │  • Admin Review      │   │  • CI Guide │  │
│  └──────────┬───────────┘   └──────────┬───────────┘   └──────┬──────┘  │
│             │                          │                      │         │
│             ▼                          ▼                      ▼         │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                CAPACITOR 8 NATIVE ANDROID BRIDGE                  │  │
│  │  • Portrait Lock & Splash Theme     • Hardware Vibration API      │  │
│  │  • AdMob Native SDK (Test IDs)      • WebView Safe Auth Guard     │  │
│  └────────────────────────────────┬──────────────────────────────────┘  │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│            CLOUD APK BUILD & ARTIFACT DELIVERY PIPELINE                 │
│                                                                         │
│  ┌──────────────────────┐      ┌──────────────────────┐                 │
│  │   GitHub Actions     │      │   Clean Artifacts    │                 │
│  │  • Push + Manual Run │─────▶│  • Android Project   │                 │
│  │  • Node 22 + JDK 21  │      │  • GitHub Workflow   │                 │
│  │  • Web Build + Sync  │      │  • Installable Debug │                 │
│  │  • Gradle Debug APK  │      │    APK Artifact      │                 │
│  └──────────────────────┘      └──────────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - **Gameplay & Local Persistence**: High scores, guest coin balances, audio mute state, and haptic vibration preferences persist locally so offline Android APK play works instantaneously without network dependency.
  - **Cloud Profile & Monetization State (Firestore)**: Authenticated user profiles maintain 6-digit referral codes, invite counts, coin and USD balances, 24-hour daily bonus timestamps, and saved payout method preferences (`RedotPay`, `BinancePay`, `USDT_TRC20`, `PayPal`, `JazzCash`, `Easypaisa`), paired with strict security rules and deduplicated profile bootstrap guards.
  - **Native AdMob State**: Tracks session game-over counts in memory, mounting a persistent adaptive bottom test banner on native startup and preloading/displaying a test interstitial every third game over.

- **Interactive Component & State Mapping**:
  - **APK & Cloud Build Modal**: Provides one-tap download of the clean Android project bundle, one-tap copy of the full build command with visual confirmation, active display of configured AdMob Test IDs, and clear step-by-step instructions for running the GitHub Actions workflow.
  - **Android WebView Authentication Guard**: Detects popup/environment restrictions gracefully if Google Sign-In is invoked inside a restricted Android WebView environment, displaying a clear, non-crashing user message while preserving full guest gameplay and local coin accumulation.
  - **GitHub Actions Workflow Runner**: Validates environment setup (`Node 22`, `JDK 21`, `Android SDK`), compiles web assets, syncs Capacitor Android assets and plugins, executes `./gradlew assembleDebug --no-daemon`, verifies APK output existence, and uploads `ColorStack3D-debug-apk` with retention metadata for one-click download from GitHub Actions.
