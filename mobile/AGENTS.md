# Android Agent Guide

This directory is the Android-first client for the AdaptaBuddy mobile + Rust backend MVP.

## Open Path

Open Android Studio at:

```text
C:\Users\17026\Documents\Code stuff\Adaptabuddy_v2\mobile
```

Use SDK location:

```text
C:\Users\17026\AppData\Local\Android\Sdk
```

Use Android Studio's bundled JBR:

```text
C:\Program Files\Android\Android Studio\jbr
```

Default emulator:

```text
Adaptabuddy_API36
```

## Commands

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:lintDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

Run connected tests only when an emulator or device is booted. `JAVA_HOME`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT` are set at the user level for this machine.

## Architecture Rules

- `/api/v0/me/...` is the canonical mobile API namespace.
- Mobile authenticates with Supabase Auth and sends the Supabase access JWT to Rust.
- Rust owns business logic, JWT validation, authorization, and ownership checks.
- Mobile may store the Supabase project URL and publishable key.
- Mobile must never store service-role keys, JWT secrets, database passwords, webhook secrets, or admin credentials.
- Keep the Android app MVP-focused: Home, Habits, Add, Workout, and Food are the first top-level surfaces.

## GitNexus Rules

- Before editing an existing function, class, method, or route handler, run GitNexus impact analysis when the tool is available.
- Warn the user before editing anything GitNexus reports as HIGH or CRITICAL risk.
- Before committing, run GitNexus change detection and confirm affected symbols and flows match the Android task scope.

## Local Files

- `local.properties` is intentionally ignored and points Gradle to the local Android SDK.
- Do not commit Android Studio user metadata, Gradle caches, build output, emulator images, or secrets.
