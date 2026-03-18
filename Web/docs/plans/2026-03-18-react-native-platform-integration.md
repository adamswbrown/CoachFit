# React Native Platform Integration Plan

**Date**: 2026-03-18
**Status**: Draft
**Scope**: Connect the standalone React Native app to the CoachFit backend

---

## Problem Statement

The React Native app (`/React`) is completely isolated from the CoachFit platform:
- No authentication — users are anonymous
- Scanned nutrition data stays in local SQLite, never reaches the backend
- HealthKit data is read locally but never synced to `/api/ingest/*`
- No concept of client identity, coach relationship, or cohort membership

The platform already has everything needed on the backend side:
- Device pairing via one-time codes (`/api/pair`)
- Token-based mobile auth (`X-Pairing-Token` header)
- Full ingest API suite (`/api/ingest/entry`, `/api/ingest/workouts`, `/api/ingest/sleep`, `/api/ingest/steps`, `/api/ingest/profile`)
- The native iOS app (`/iOS`) already uses all of this successfully

## Goal

Make the React Native app a first-class platform citizen that:
1. Authenticates via the existing pairing code flow
2. Syncs scanned nutrition data to daily entries
3. Syncs HealthKit/Health Connect data to the platform
4. Shows platform data (entries, coach info) to the client

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                React Native App                  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐ │
│  │ Pairing  │  │ Barcode  │  │ Health        │ │
│  │ Screen   │  │ Scanner  │  │ Dashboard     │ │
│  └────┬─────┘  └────┬─────┘  └───────┬───────┘ │
│       │              │                │         │
│  ┌────▼──────────────▼────────────────▼───────┐ │
│  │            API Client Service               │ │
│  │  (X-Pairing-Token auth, retry, offline Q)   │ │
│  └────┬───────────────────────────────────────┘ │
│       │                                          │
│  ┌────▼────┐  ┌──────────┐  ┌────────────────┐ │
│  │ Secure  │  │ Local    │  │ Sync Engine    │ │
│  │ Storage │  │ SQLite   │  │ (background)   │ │
│  └─────────┘  └──────────┘  └────────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
                       ▼
┌──────────────────────────────────────────────────┐
│              CoachFit Backend (Next.js)           │
│                                                   │
│  POST /api/pair              → Device pairing     │
│  POST /api/ingest/entry      → Daily nutrition    │
│  POST /api/ingest/workouts   → HealthKit workouts │
│  POST /api/ingest/sleep      → Sleep records      │
│  POST /api/ingest/steps      → Step counts        │
│  POST /api/ingest/profile    → Body metrics       │
└──────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Auth Foundation (Pairing + Secure Storage + API Client)

The iOS app's auth flow is the blueprint. We replicate it in React Native.

#### Step 1.1: Create Secure Storage Service

**New file**: `React/src/services/secureStorage.ts`

Stores device token and client identity after pairing. Uses `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android) — mirrors `KeychainService.swift`.

```typescript
// Keys to store:
// - deviceToken: string (64-char hex from /api/pair)
// - clientId: string (UUID)
// - clientName: string | null
// - coachName: string | null
// - baseUrl: string (platform API URL)

export async function getDeviceToken(): Promise<string | null>
export async function setDeviceToken(token: string): Promise<void>
export async function getClientId(): Promise<string | null>
export async function setClientId(id: string): Promise<void>
export async function clearAll(): Promise<void>
export async function isPaired(): Promise<boolean>
```

**Verification**: Unit test that set/get/clear cycle works.

**New dependency**: `expo-secure-store`

---

#### Step 1.2: Create API Client Service

**New file**: `React/src/services/apiClient.ts`

Centralized HTTP client that attaches `X-Pairing-Token` header to every request. Mirrors `APIClient.swift`.

```typescript
const API_BASE_URL = 'https://your-coachfit-domain.com'; // from env/config

async function authenticatedFetch(
  path: string,
  options?: { method?: string; body?: object }
): Promise<Response> {
  const token = await getDeviceToken();
  if (!token) throw new AuthError('Not paired');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Pairing-Token': token,
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401) {
    // Token revoked — clear storage, navigate to pairing
    await clearAll();
    throw new AuthError('Token revoked');
  }

  return response;
}

// Public API methods:
export async function pair(code: string): Promise<PairResponse>
export async function submitEntry(data: IngestEntryPayload): Promise<void>
export async function submitWorkouts(data: IngestWorkoutsPayload): Promise<void>
export async function submitSleep(data: IngestSleepPayload): Promise<void>
export async function submitSteps(data: IngestStepsPayload): Promise<void>
export async function submitProfile(data: IngestProfilePayload): Promise<void>
```

**Key behaviors**:
- `pair()` is unauthenticated (POST /api/pair with code, stores response token)
- All other methods use `authenticatedFetch`
- 401 responses trigger automatic sign-out
- Timeout: 15 seconds
- No retry logic (keeps it simple; sync engine handles retries)

**Verification**: Mock fetch, test that headers are set correctly, 401 triggers clearAll.

---

#### Step 1.3: Create Auth Context

**New file**: `React/src/contexts/AuthContext.tsx`

React context that holds auth state and exposes pairing/unpairing actions. Drives conditional navigation.

```typescript
type AuthState =
  | { status: 'loading' }        // Checking secure storage on app launch
  | { status: 'unpaired' }       // No device token → show PairingScreen
  | { status: 'paired'; clientId: string; clientName: string | null; coachName: string | null }

// Provider wraps App, checks isPaired() on mount
// Exposes: pair(code), unpair(), authState
```

**Verification**: App launches → checks storage → routes to correct screen.

---

#### Step 1.4: Create Pairing Screen

**New file**: `React/src/screens/PairingScreen.tsx`

Mirrors PairingView.swift. Simple screen with:
- 8-character code input (auto-capitalize, alphanumeric filter, excludes O/I/0/1)
- "Connect" button → calls `apiClient.pair(code)`
- Loading spinner during pairing
- Error message on failure (invalid code, expired, already used)
- On success: stores token + navigates to Home

**UI**: Follows existing theme from `constants/theme.ts` (green primary, consistent spacing).

**Verification**: Enter valid code → lands on Home. Enter invalid code → shows error. Enter expired code → shows appropriate message.

---

#### Step 1.5: Update Navigation

**Modified file**: `React/App.tsx`

Wrap app in `AuthProvider`. Conditionally render:
- `status === 'loading'` → splash/loading screen
- `status === 'unpaired'` → `PairingScreen` only
- `status === 'paired'` → existing `Stack.Navigator` (Home, Scanner, etc.)

Add a "Disconnect" option somewhere accessible (Settings or Home screen menu).

**Verification**: Cold start without token → PairingScreen. Cold start with valid token → Home. Disconnect → PairingScreen.

---

#### Step 1.6: Add Platform API URL Configuration

**Modified file**: `React/src/constants/api.ts`

Add the CoachFit backend URL. Use environment-based config for dev vs prod.

```typescript
// Existing:
export const OPEN_FOOD_FACTS_BASE_URL = '...';

// New:
export const COACHFIT_API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-production-domain.com';
```

**Verification**: Dev build hits localhost, prod build hits production URL.

---

### Phase 2: Nutrition Sync (Barcode Scans → Platform Entries)

This is the highest-value integration: scanned food data flows to the coach's dashboard.

#### Step 2.1: Create Nutrition Sync Service

**New file**: `React/src/services/nutritionSync.ts`

Translates scanned `Product` data into `/api/ingest/entry` payloads.

```typescript
export async function syncScannedProduct(
  product: Product,
  servingGrams: number
): Promise<void> {
  const clientId = await getClientId();
  if (!clientId) return; // Not paired, skip sync

  const ratio = servingGrams / 100;
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  await apiClient.submitEntry({
    client_id: clientId,
    date: today,
    calories: Math.round(product.caloriesPer100g * ratio),
    proteinGrams: Math.round(product.proteinPer100g * ratio * 10) / 10,
    carbsGrams: Math.round(product.carbsPer100g * ratio * 10) / 10,
    fatGrams: Math.round(product.fatPer100g * ratio * 10) / 10,
    fiberGrams: Math.round(product.fiberPer100g * ratio * 10) / 10,
  });
}
```

**Important**: The ingest/entry endpoint uses **fill-only merge** — it only fills null fields, never overwrites. This means:
- First scan of the day: creates entry with nutrition data
- Subsequent scans: won't overwrite (by design — the backend merges conservatively)
- This is a known limitation. For additive nutrition tracking, we may need a dedicated endpoint or to accumulate locally and submit totals. See "Future Considerations" below.

**Verification**: Scan product → check backend Entry for that date has nutrition values. Second scan same day → verify no overwrite.

---

#### Step 2.2: Integrate Sync into Product Screen

**Modified file**: `React/src/screens/ProductScreen.tsx`

After the existing "Log to Health" button action, also sync to platform:

```typescript
// Existing: writes to HealthKit locally
await writeScannedProduct(product, servingGrams);

// New: also sync to CoachFit backend
await syncScannedProduct(product, servingGrams);
```

Add visual feedback: "Synced to CoachFit" confirmation or error toast.

If not paired, the sync silently skips (app still works standalone).

**Verification**: Log a product → Entry appears in coach dashboard with correct macros.

---

#### Step 2.3: Local Accumulation for Daily Totals

**New file**: `React/src/services/dailyAccumulator.ts`

Since `/api/ingest/entry` is fill-only (won't overwrite), we need to accumulate nutrition locally across multiple scans per day and submit the running total.

```typescript
// SQLite table: daily_nutrition
// Columns: date TEXT PK, calories INT, protein REAL, carbs REAL, fat REAL, fiber REAL

export async function addScannedNutrition(
  date: string,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber: number
): Promise<DailyTotals>
// Adds to existing totals for the date, returns new totals

export async function getDailyTotals(date: string): Promise<DailyTotals | null>

export async function clearDay(date: string): Promise<void>
```

The sync flow becomes:
1. User scans product → add to local accumulator
2. Local accumulator returns running daily totals
3. Submit totals to `/api/ingest/entry` (which creates or merges)

**Modified file**: `React/src/services/database.ts` — add `daily_nutrition` table to schema init.

**Verification**: Scan 3 products in one day → local totals = sum of all three → backend entry matches totals.

---

### Phase 3: HealthKit/Health Connect Sync to Platform

The app already reads HealthKit data locally. Now we forward it to the backend.

#### Step 3.1: Create Health Sync Service

**New file**: `React/src/services/healthSync.ts`

Background sync that reads local health data and pushes to platform ingest endpoints.

```typescript
export async function syncHealthData(): Promise<SyncResult> {
  const clientId = await getClientId();
  if (!clientId) return { skipped: true };

  const results = await Promise.allSettled([
    syncWorkouts(clientId),
    syncSleep(clientId),
    syncSteps(clientId),
    syncBodyMetrics(clientId),
  ]);

  return summarizeResults(results);
}

async function syncWorkouts(clientId: string): Promise<void> {
  const workouts = await getRecentWorkouts(7); // Last 7 days
  if (workouts.length === 0) return;

  await apiClient.submitWorkouts({
    client_id: clientId,
    workouts: workouts.map(w => ({
      workout_type: w.activityType,
      start_time: w.startDate,
      end_time: w.endDate,
      duration_seconds: w.duration,
      calories_active: w.calories ?? undefined,
      distance_meters: w.distance ?? undefined,
      avg_heart_rate: w.heartRate?.average ?? undefined,
      max_heart_rate: w.heartRate?.max ?? undefined,
      source_device: w.sourceName ?? undefined,
    })),
  });
}

// Similar for syncSleep, syncSteps, syncBodyMetrics
// Each maps from the local HealthService types to the ingest API shapes
```

**Key mapping** (React Native health types → Platform ingest types):

| Local Type | Ingest Endpoint | Field Mapping |
|-----------|----------------|---------------|
| `ExerciseSession` | `/api/ingest/workouts` | activityType→workout_type, startDate→start_time, etc. |
| `SleepSession` | `/api/ingest/sleep` | duration→total_sleep_minutes, stages→stage fields |
| `StepsData` | `/api/ingest/steps` | value→total_steps |
| `WeightData` | `/api/ingest/profile` | value→metric:"weight", unit:"lbs" |
| `BodyFatData` | `/api/ingest/profile` | value→metric:"body_fat_percentage", unit:"percent" |

**Deduplication**: The backend deduplicates workouts by (userId, workoutType, startTime), so re-syncing the same data is safe.

**Verification**: Grant HealthKit permissions → sync → check backend has workouts, sleep records, steps.

---

#### Step 3.2: Track Last Sync Timestamp

**Modified file**: `React/src/services/secureStorage.ts`

Add `lastHealthSyncAt` to secure storage. Only fetch data newer than this timestamp to avoid redundant work.

```typescript
export async function getLastSyncTimestamp(): Promise<string | null>
export async function setLastSyncTimestamp(iso: string): Promise<void>
```

**Verification**: First sync fetches 7 days. Second sync only fetches since last sync.

---

#### Step 3.3: Trigger Sync on App Foreground + Health Dashboard

**Modified file**: `React/src/screens/HealthDashboardScreen.tsx`

After the existing health data refresh, also trigger platform sync:

```typescript
// Existing: refreshes local health data display
await loadHealthData();

// New: sync to platform (non-blocking, fire-and-forget with error toast)
syncHealthData().catch(err => showSyncError(err));
```

**New hook**: `React/src/hooks/useAppForeground.ts` — uses `AppState` listener to trigger sync when app comes to foreground (matches iOS native app behavior).

**Verification**: Background app → foreground → sync fires → backend receives fresh data.

---

### Phase 4: Platform Data Display (Read from Backend)

Show the client their platform data and coach relationship.

#### Step 4.1: Add Profile Header to Home Screen

**Modified file**: `React/src/screens/HomeScreen.tsx`

When paired, show:
- Client name and coach name (from secure storage, populated at pairing time)
- Last sync timestamp
- Connection status indicator (green dot = paired)

When unpaired, show existing anonymous UI (app still works standalone).

**Verification**: Paired user sees their name and coach. Unpaired user sees original UI.

---

#### Step 4.2: Add Sync Status to Health Dashboard

**Modified file**: `React/src/screens/HealthDashboardScreen.tsx`

Add a "Platform Sync" section showing:
- Last sync time
- Sync status (syncing/synced/error)
- Manual "Sync Now" button
- Count of items synced (workouts, sleep records, steps)

**Verification**: Tap "Sync Now" → spinner → success message with counts.

---

### Phase 5: Offline Support & Error Handling

#### Step 5.1: Offline Queue for Sync Failures

**New file**: `React/src/services/offlineQueue.ts`

When network is unavailable, queue sync payloads in SQLite. Drain queue when connectivity returns.

```typescript
// SQLite table: sync_queue
// Columns: id INTEGER PK, endpoint TEXT, payload TEXT, created_at TEXT, attempts INT

export async function enqueue(endpoint: string, payload: object): Promise<void>
export async function drainQueue(): Promise<DrainResult>
export async function getQueueSize(): Promise<number>
```

**Modified file**: `React/src/services/apiClient.ts` — on network error, enqueue instead of throwing.

**New hook**: `React/src/hooks/useNetworkStatus.ts` — monitors connectivity, triggers queue drain on reconnect.

**Verification**: Turn off network → scan product → queue grows. Turn on network → queue drains → data appears in backend.

---

#### Step 5.2: Handle Token Revocation Gracefully

**Modified file**: `React/src/services/apiClient.ts`

On 401 response:
1. Clear secure storage
2. Update AuthContext → status becomes 'unpaired'
3. Navigate to PairingScreen
4. Show message: "Your device was disconnected. Please ask your coach for a new pairing code."

**Verification**: Revoke token in admin dashboard → next app API call → user sees pairing screen with explanation.

---

## File Change Summary

### New Files (11)

| File | Purpose |
|------|---------|
| `React/src/services/secureStorage.ts` | Encrypted credential storage |
| `React/src/services/apiClient.ts` | Authenticated HTTP client |
| `React/src/services/nutritionSync.ts` | Barcode scan → Entry sync |
| `React/src/services/dailyAccumulator.ts` | Local nutrition total aggregation |
| `React/src/services/healthSync.ts` | HealthKit → Platform sync |
| `React/src/services/offlineQueue.ts` | Offline-tolerant sync queue |
| `React/src/contexts/AuthContext.tsx` | Auth state management |
| `React/src/screens/PairingScreen.tsx` | Device pairing UI |
| `React/src/hooks/useAppForeground.ts` | App state listener for sync triggers |
| `React/src/hooks/useNetworkStatus.ts` | Connectivity monitoring |
| `React/src/types/api.ts` | Platform API request/response types |

### Modified Files (6)

| File | Change |
|------|--------|
| `React/App.tsx` | Wrap in AuthProvider, conditional navigation |
| `React/src/constants/api.ts` | Add COACHFIT_API_BASE_URL |
| `React/src/services/database.ts` | Add daily_nutrition table |
| `React/src/screens/ProductScreen.tsx` | Add platform sync after "Log to Health" |
| `React/src/screens/HealthDashboardScreen.tsx` | Add sync status + "Sync Now" |
| `React/src/screens/HomeScreen.tsx` | Add profile header when paired |
| `React/package.json` | Add expo-secure-store dependency |

### No Backend Changes Required

All ingest endpoints, pairing flow, and auth validation already exist. The React Native app is purely a new consumer of existing APIs — identical to what the iOS native app already does.

---

## New Dependency

| Package | Purpose | Size |
|---------|---------|------|
| `expo-secure-store` | Keychain/EncryptedSharedPreferences wrapper | ~15KB |

No other new dependencies needed. The existing `expo-sqlite` handles the offline queue and daily accumulator.

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Fill-only merge loses subsequent scans | Medium | High | Daily accumulator (Step 2.3) submits running totals |
| Token revoked while user is mid-session | Low | Low | 401 handler clears state gracefully (Step 5.2) |
| HealthKit permission denied on Android | Medium | Medium | Graceful degradation — sync skips, local display still works |
| Large workout backfill exceeds 100-item limit | Low | Low | Batch into chunks of 100 |
| Network timeout during sync | Medium | Medium | Offline queue retries on reconnect (Step 5.1) |
| Concurrent sync from iOS native + React Native | Low | Low | Backend deduplicates by unique constraints |

---

## Rollback Procedure

Each phase is independently deployable and reversible:

1. **Phase 1 rollback**: Remove AuthProvider wrapper from App.tsx → app works as before (anonymous)
2. **Phase 2 rollback**: Remove syncScannedProduct call from ProductScreen → scans stay local only
3. **Phase 3 rollback**: Remove syncHealthData calls → HealthKit stays local only
4. **Phase 4 rollback**: Remove profile header → original anonymous Home screen
5. **Phase 5 rollback**: Remove offline queue → sync fails silently on network error

No database migrations on the backend. No schema changes. Fully reversible.

---

## Implementation Order & Dependencies

```
Phase 1 (Auth) ─────────┬──→ Phase 2 (Nutrition Sync)
                         │
                         ├──→ Phase 3 (HealthKit Sync)
                         │
                         └──→ Phase 4 (Platform Display)

Phase 2 + 3 ────────────────→ Phase 5 (Offline Support)
```

Phase 1 is the prerequisite for everything. Phases 2, 3, 4 can be done in parallel after that. Phase 5 hardens the sync from Phases 2 and 3.

---

## Future Considerations

- **Additive nutrition endpoint**: The fill-only merge on `/api/ingest/entry` means the daily accumulator is a workaround. A dedicated `/api/ingest/nutrition/add` endpoint that *adds* to existing values would be cleaner. This is a backend change for later.
- **Push notifications**: Notify client of coach messages or weekly questionnaire availability.
- **Daily check-in form**: Replicate the web CheckInForm (perceivedStress, notes, customResponses) natively.
- **Questionnaire support**: Render SurveyJS questionnaires in the app.
- **Background sync**: Use expo-background-fetch for periodic sync without opening the app.
