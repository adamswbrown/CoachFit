# Plan: CoachFit iOS Companion App

**Date:** 2026-03-16
**Status:** In progress
**Branch:** `feature/ios-companion-app`
**Estimated effort:** 60-80 hours

## What it is

A SwiftUI companion app for gym members/clients. Handles three things: background HealthKit sync, quick daily check-ins, and Cronometer CSV import. Everything else (questionnaires, charts, settings, coach features) stays on the web — the app deep-links to gcgyms.com when needed.

This is a client-only app. Coaches use the web dashboard exclusively.

## Authentication

Single mechanism: pairing code. Coach generates an 8-char code on the web dashboard, client enters it in the app on first launch. The app stores a persistent device token in Keychain and uses it for all API requests via the `X-Pairing-Token` header.

No Clerk SDK, no Google sign-in, no passwords on mobile. Invited-only — you can't use the app unless a coach has generated a code for you.

On successful pair, `POST /api/pair` returns user info and a long-lived device token. The app stores this and uses it for all subsequent requests.

## Screens

### First launch
1. Welcome screen with CoachFit logo
2. "Enter your pairing code" — single text field, 8 characters
3. App calls `POST /api/pair` → gets back user ID, name, coach name
4. Token stored in Keychain. Shows "Welcome, {name}!" then lands on home screen
5. Invalid/expired code → error message, try again

### Home (tab bar, 3 tabs)

**Tab 1 — Today**
- Today's check-in form: weight, steps, calories, sleep quality, perceived stress, notes
- If already submitted today, shows the entry with an "Edit" option
- Below the form: last 5 entries as a simple list (date, weight, steps, calories)
- Cronometer hint below calories field (same text as web)
- If HealthKit has already synced steps/weight for today, pre-populate those fields (read-only with "from Apple Health" badge) so the user only fills in what's missing

**Tab 2 — Import**
- "Import from Cronometer" button
- Opens iOS file picker (CSV files)
- Parses CSV, shows preview of rows to import
- Confirms and uploads via API

**Tab 3 — More**
- Sync status: last HealthKit sync time, connected/disconnected badge
- "View full dashboard" → opens Safari to gcgyms.com/client-dashboard
- "Answer questionnaire" → opens Safari to gcgyms.com/client-dashboard
- "Unpair device" → confirms, clears Keychain, returns to pairing screen
- App version

No settings screen, no charts, no coach features. Detail lives on the web.

## HealthKit integration

**Permissions requested after pairing:**
- Step count
- Workouts (all types)
- Sleep analysis
- Body mass (weight)
- Height

**Background sync via HealthKit background delivery:**

| Data | Endpoint | Trigger |
|------|----------|---------|
| Workouts | `POST /api/ingest/workouts` | On new workout |
| Sleep | `POST /api/ingest/sleep` | On new sleep record |
| Steps | `POST /api/ingest/steps` | Daily midnight rollup |
| Weight | `POST /api/ingest/profile` | On new measurement |

**Background delivery reliability:**

`HKObserverQuery` with `enableBackgroundDelivery` is the primary mechanism, but iOS is not guaranteed to wake the app — especially for step count, which updates frequently and may be coalesced or delayed by the system. Two mitigations:

1. **`BGAppRefreshTask` fallback.** Register a background app refresh task (`BGTaskScheduler`) that runs a catch-up sync for all data types. Schedule it to run at least once daily. This covers the case where HealthKit background delivery doesn't fire (common after device restart, low power mode, or extended periods without app launch).

2. **Foreground catch-up.** Every time the app enters the foreground (`scenePhase == .active`), run a lightweight sync for data since the last successful sync timestamp. This is the most reliable path and ensures data is never more than one app-open behind.

The step count "daily midnight rollup" is the most likely to be unreliable via background delivery alone. The `BGAppRefreshTask` + foreground catch-up combination handles this.

**Deduplication:** Server-side via unique constraints. App can safely re-send. The ingest endpoints return `207` for partial failures — the app should parse the response and only re-queue failed records.

**Initial sync:** After pairing, backfill last 30 days of HealthKit data.

**Offline handling:** Queue failed requests locally (UserDefaults array of serialized request payloads), retry on next sync or foreground entry. For v1 with 10-15 users this is sufficient. If the queue grows beyond ~50 items (e.g., device offline for a week with heavy workout activity), batch them into the maximum allowed per endpoint (100 workouts, 400 sleep/step records) and send sequentially. The server-side rate limit is 100 requests/minute/client — stay well under this.

## API changes needed (backend)

Four additions to the existing backend:

### 1. `POST /api/ingest/entry`
Daily check-in submission via pairing token auth. Same validation as `POST /api/entries` but uses `X-Pairing-Token` instead of Clerk session. Follows existing ingest auth pattern.

Must set `dataSources: ["manual"]` on create (matching web behavior) and preserve existing `dataSources` on update. If HealthKit has already written steps/calories for that date, a manual check-in should merge — not overwrite. Follow the same merge strategy as `/api/ingest/sleep` and `/api/ingest/steps`: only fill null fields, append `"manual"` to the `dataSources` array if not already present.

### 2. `POST /api/ingest/cronometer`
Cronometer CSV import via pairing token auth. Same logic as `POST /api/import/cronometer` but with ingest auth.

### 3. Extend `POST /api/pair` response — device token

The current system reuses the 8-char pairing code as the `X-Pairing-Token` for all subsequent requests. This works (the ingest auth middleware looks up the most recent used pairing code for the client), but the pairing code expires in 15 minutes and was designed as a one-time validation code, not a long-lived credential.

**Change:** Generate a separate `deviceToken` (a 64-char `crypto.randomBytes(32).toString('hex')`) when pairing succeeds. Add a `deviceToken` column to the `PairingCode` model. Return it in the `/api/pair` response. Update `validateIngestAuth()` to accept either the pairing code OR the device token in the `X-Pairing-Token` header.

This way:
- The pairing code stays short-lived (15 min) and single-use as intended
- The device token is long-lived and stored in Keychain
- Unpairing (`POST /api/client/unpair-device`) already nullifies `usedAt` and expires the code — also null out `deviceToken` to revoke

### 4. Handle token revocation gracefully

When a coach unpairs a client (or the client unpairs themselves), all subsequent API calls from the app will return 401. The app must handle this:

- On any 401 response from an ingest/entry/cronometer endpoint, clear the Keychain token and navigate back to the pairing screen with a message: "Your device has been unpaired. Enter a new pairing code to reconnect."
- This is a global behavior — implement as a centralized response interceptor in the networking layer, not per-endpoint.

Everything else (workout, sleep, steps, profile ingest) already works with pairing token auth.

## Distribution: TestFlight

Initial distribution to 10-15 gym members via TestFlight. No App Store listing needed.

**Requirements:**
- Apple Developer account ($99/year)
- Xcode on a Mac

**Process:**
1. Build and archive in Xcode
2. Upload to App Store Connect
3. Add testers by email in TestFlight section
4. Testers receive email invite → download TestFlight app → install CoachFit
5. Builds auto-expire after 90 days (push a new build to refresh)

**Internal testers** (your own Apple ID, up to 100 people): no Apple review needed, instant access.

**External testers** (anyone else, up to 10,000): lightweight Apple review, usually approved within a day. This is the route for gym members.

**When ready to go public:** submit the same build to the App Store with screenshots, description, and privacy policy. The TestFlight build and App Store build can coexist.

**Privacy policy:** required even for TestFlight external testers. Must be hosted at a public URL before the first TestFlight submission.

Apple has specific requirements for apps that access HealthKit:

1. **HealthKit usage descriptions** (in Info.plist):
   - `NSHealthShareUsageDescription` — why the app reads health data ("CoachFit reads your workouts, sleep, steps, and weight to share with your coach for fitness tracking.")
   - `NSHealthUpdateUsageDescription` — only needed if the app writes to HealthKit (we don't, so omit this)

2. **Privacy policy must explicitly state:**
   - What HealthKit data is collected (workouts, sleep analysis, step count, body mass, height)
   - That data is transmitted to CoachFit servers and shared with the user's assigned coach
   - That HealthKit data is NOT used for advertising or sold to third parties (Apple rejects apps that do this)
   - That HealthKit data is NOT stored in iCloud or any third-party analytics service
   - How long data is retained and how to request deletion (unpair device + contact coach)

3. **App Store review guideline 27.4**: Apps must not store HealthKit data in iCloud. Our architecture is fine (data goes to our PostgreSQL backend, not iCloud), but the privacy policy should confirm this.

Host at `gcgyms.com/privacy` — a simple static page is fine. This same page satisfies the App Store listing requirement when you go public later.

---

## What's NOT in v1

- Push notifications (email reminders already work)
- Charts or analytics (use the web)
- Questionnaire answering (deep-link to web)
- Coach features (web only)
- Android version
- Apple Watch app

## Tech stack

- SwiftUI (iOS 16+)
- HealthKit framework
- URLSession for networking
- Keychain for token storage
- No third-party dependencies if possible

## Implementation progress

### Phase 1: Backend API changes — DONE (2026-03-16)

All four backend additions are complete and deployed to the database:

- [x] **Device token auth** — `PairingCode.deviceToken` column (64-char hex, unique). Generated on `POST /api/pair`, stored in Keychain by iOS app, used via `X-Pairing-Token` header. `validateIngestAuth()` accepts either pairing codes or device tokens. Unpair nulls out `deviceToken` to revoke.
- [x] **`POST /api/ingest/entry`** — Daily check-in via pairing token auth. Merge strategy: only fills null fields, appends `"manual"` to `dataSources`. Validation via `ingestEntrySchema`.
- [x] **`POST /api/ingest/cronometer`** — Cronometer CSV import via pairing token auth. Same merge logic as web version. Extends `cronometerImportSchema` with `client_id`.
- [x] **Token revocation** — `POST /api/client/unpair-device` clears `deviceToken` alongside existing `usedAt`/`expiresAt` nullification.

Files changed: `prisma/schema.prisma`, `lib/security/ingest-auth.ts`, `lib/validations/healthkit.ts`, `app/api/pair/route.ts`, `app/api/client/unpair-device/route.ts`
Files created: `app/api/ingest/entry/route.ts`, `app/api/ingest/cronometer/route.ts`

### Phase 2: iOS project scaffold + auth — DONE (2026-03-16)

- [x] **Xcode project** — SwiftUI, iOS 26+, no third-party deps. `PBXFileSystemSynchronizedRootGroup` (auto-discovers files). Bundle ID: `com.askadam.CoachFit`.
- [x] **Info.plist** — `NSHealthShareUsageDescription`, background modes (`fetch`, `processing`), `BGTaskSchedulerPermittedIdentifiers` for HealthKit sync.
- [x] **Entitlements** — HealthKit enabled. Removed CloudKit/push (not needed, and CloudKit violates Apple guideline 27.4 for HealthKit data).
- [x] **`KeychainService`** — `kSecAttrAccessibleAfterFirstUnlock` for background access. Stores `deviceToken`, `clientId`, `clientName`, `coachName`. `clearAll()` for unpair.
- [x] **`APIClient`** — `@Observable`, URLSession-based. `X-Pairing-Token` header injection. Centralized `onUnauthorized` callback (401 → clears Keychain → pairing screen). Base URL: `localhost:3000` (debug) / `gcgyms.com` (release).
- [x] **`AppState`** — `@Observable` routing. Checks Keychain on init → `.home` or `.pairing`. `pair(code:)` stores credentials, `signOut()` clears everything.
- [x] **Pairing screen** — 8-char code input (auto-uppercase, character limit), calls `POST /api/pair`, stores `device_token`. Error/loading states. Shows unpair message if returning from revoked session.

Files created: `CoachFitApp.swift`, `Services/KeychainService.swift`, `Services/APIClient.swift`, `Models/AppState.swift`, `Views/PairingView.swift`, `Views/HomeView.swift`

### Phase 3: HealthKit sync engine — DONE (2026-03-16)

- [x] **`HealthKitManager`** — Requests read-only permissions (workouts, sleep, steps, bodyMass, height). `isHealthDataAvailable()` guard on all operations. Fetches workouts via `HKSampleQuery`, sleep via `HKSampleQuery` with per-date aggregation (core/deep/REM/awake stages), steps via `HKStatisticsCollectionQuery` (daily sums), weight/height via `HKSampleQuery`. `fetchTodayData()` for check-in pre-population. `HKWorkoutActivityType` → API string mapping (25+ activity types).
- [x] **`HKObserverQuery` + `enableBackgroundDelivery`** — Registered per data type: workouts/weight `.immediate`, sleep/steps `.hourly`. Completion handler always called (Apple requirement). Triggers `SyncEngine.syncType()`.
- [x] **`BGAppRefreshTask` fallback** — Registered as `.backgroundTask(.appRefresh(...))` in SwiftUI. Scheduled every 6 hours via `BGAppRefreshTaskRequest`. Runs `syncAll()`.
- [x] **Foreground catch-up** — `scenePhase == .active` → `appState.onForegroundEntry()` → `syncEngine.syncAll()`.
- [x] **Offline queue** — UserDefaults-based, capped at 50 items. Failed `URLError` requests queued automatically. Retried at start of every sync. 401 during retry clears queue and triggers unpair.
- [x] **Initial 30-day backfill** — After pairing + HealthKit auth, resets all sync dates to 30 days ago and runs `syncAll()`.
- [x] **`SyncEngine`** — `@Observable`, coordinates all sync. Batches to API limits (100 workouts, 400 sleep/steps, 50 profile metrics). Payloads match Zod schemas exactly. Per-type sync date tracking in UserDefaults. Parallel sync via `TaskGroup`. Server handles dedup via unique constraints.

Files created: `Services/HealthKitManager.swift`, `Services/SyncEngine.swift`

### Phase 4: UI screens (Today + Import + More) — DONE (2026-03-16)

- [x] **Today tab** — Form with weight, steps, calories, sleep quality (1-10 picker), perceived stress (1-10 picker), notes. HealthKit pre-population: if today's steps/weight available, shown as read-only with red "Apple Health" badge; manual fields hidden for pre-populated data. Submits via `POST /api/ingest/entry`. Shows "Submitted for today" state with Update option.
- [x] **Import tab** — "Import from Cronometer" empty state with instructions. iOS file picker (`.commaSeparatedText`, `.plainText`). `CronometerCSVParser` ported to Swift — flexible column matching (Energy (kcal), Protein (g), etc.), date normalization (YYYY-MM-DD, MM/DD/YYYY), handles quoted fields. Preview screen shows row count, warnings, first 10 rows with macro breakdown. Upload via `POST /api/ingest/cronometer`. Success screen shows created/merged/skipped counts.
- [x] **More tab** — Live sync status (syncing spinner / relative time since last sync / error display). HealthKit availability warning. Coach name. Deep links to web dashboard and questionnaire. Unpair with confirmation dialog. App version.

Files created: `Views/TodayTab.swift`, `Views/ImportTab.swift`, `Services/CronometerCSVParser.swift`

### Phase 5: Privacy policy + TestFlight prep

- [ ] Privacy policy page at `gcgyms.com/privacy`
- [ ] Final Info.plist review
- [ ] Archive, upload to App Store Connect, add testers

---

## Backend infrastructure (all production-ready)

- `POST /api/pair` — pairing code validation + device token generation
- `POST /api/ingest/workouts` — workout sync
- `POST /api/ingest/sleep` — sleep sync
- `POST /api/ingest/steps` — step sync
- `POST /api/ingest/profile` — body metrics sync
- `POST /api/ingest/entry` — daily check-in (pairing token auth)
- `POST /api/ingest/cronometer` — CSV import (pairing token auth)
- `lib/healthkit/pairing.ts` — pairing code generation/validation
- `lib/security/ingest-auth.ts` — pairing token + device token auth middleware
