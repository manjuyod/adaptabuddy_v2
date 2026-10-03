# Mobile

This folder contains the Android-first mobile workstream for AdaptaBuddy.

Open this project in Android Studio from:

```text
C:\Users\17026\Documents\Code stuff\Adaptabuddy_v2\mobile
```

## Tooling

- Android Studio: `C:\Program Files\Android\Android Studio\bin\studio64.exe`
- Java runtime: `C:\Program Files\Android\Android Studio\jbr`
- Android SDK: `C:\Users\17026\AppData\Local\Android\Sdk`
- Default AVD: `Adaptabuddy_API36`
- Package namespace: `com.adaptabuddy.mobile`
- SDK levels: `compileSdk = 37`, `targetSdk = 36`, `minSdk = 26`

## Commands

```powershell
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest
.\gradlew.bat :app:lintDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

Run `:app:connectedDebugAndroidTest` only after an emulator or device is available.
`JAVA_HOME`, `ANDROID_HOME`, and `ANDROID_SDK_ROOT` are set at the user level for this machine.

## MVP Direction

The current Android MVP plan lives in `..\docs\architecture\mobile-android-mvp.md`. The canonical mobile API contract lives in `..\docs\api\api-contracts.md`, and the required auth/security posture lives in `..\docs\security\mobile-auth-api-security.md`.

The Android app should:

- use Supabase Auth for login and session acquisition
- send the Supabase access JWT to the Rust API
- consume `/api/v0/me/...` as the canonical backend contract
- support the first MVP screens: Home, Habits, Add, Workout, and Food
- keep mobile-specific UX, navigation, and offline behavior in the mobile app
- avoid duplicating backend-owned business rules or authorization logic

Do not put service-role keys, JWT secrets, database passwords, webhook secrets, or admin credentials in mobile code.

## Local Auth/API Config

Run the local stack from the repository root:

```powershell
make supabase-start
npx supabase status
make api-container-build
make api-container-start
curl.exe -fsS http://127.0.0.1:3000/api/v0/health
```

`local.properties` is ignored. Add only public client config for local runs:

```properties
SUPABASE_URL=http://10.0.2.2:54321
SUPABASE_PUBLISHABLE_KEY=replace-with-npx-supabase-status-anon-key
API_BASE_URL=http://10.0.2.2:3000
```

The Supabase local anon key is acceptable client config. Do not add the service-role key, JWT secret, database password, webhook secret, or admin credentials.

The Rust API runs in its own Docker container on host port `3000`; Supabase Auth/Postgres still run through `npx supabase start`. Host processes use `127.0.0.1`; the Android emulator uses `10.0.2.2` to reach the host:

```text
Rust host process: http://127.0.0.1:3000
Supabase host process: http://127.0.0.1:54321
Android Rust API: http://10.0.2.2:3000
Android Supabase Auth: http://10.0.2.2:54321
```
