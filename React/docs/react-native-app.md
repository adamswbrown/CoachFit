# CoachFit React Native Mobile App

**Platform**: React Native 0.83 + Expo SDK 55
**Location**: `/React/`
**Bundle ID**: `com.anonymous.coachfit`

## Overview

The CoachFit mobile app is a companion to the web platform at gcgyms.com. It provides three core capabilities:

1. **Daily Check-In** -- manual health logging (weight, steps, calories, sleep quality, perceived stress, notes) with HealthKit auto-population
2. **Barcode Nutrition Scanner** -- scan food products, look up nutrition data from OpenFoodFacts, log to HealthKit and sync to the platform
3. **Health Data Sync** -- read HealthKit data (workouts, steps, sleep, body metrics) and sync to the CoachFit platform

All data syncs to the production backend at `https://gcgyms.com` via device token authentication.

---

## Authentication

**Mechanism**: Pairing code (no passwords, no OAuth, no Clerk on mobile).

1. Coach generates an 8-character code on the web dashboard (`POST /api/pairing-codes`)
2. Client enters the code in the app's Pairing screen
3. App calls `POST /api/pair` with the code
4. Server returns a 64-character hex device token, client ID, and coach/client names
5. App stores credentials in iOS Keychain / Android Secure Storage via `expo-secure-store`
6. All subsequent API calls use the `X-Pairing-Token` header with the device token

**Secure Storage Keys**:
| Key | Purpose |
|-----|---------|
| `coachfit_device_token` | API authentication token |
| `coachfit_client_id` | Client user ID |
| `coachfit_client_name` | Display name |
| `coachfit_coach_name` | Coach name |
| `coachfit_last_sync_at` | ISO 8601 timestamp of last health sync |

**Token Revocation**: If any API call returns 401, the app clears all stored credentials, empties the offline queue, and returns to the Pairing screen.

---

## Screens

### Pairing Screen
- Shown when device is unpaired
- 8-character code input (excludes ambiguous characters: O, I, 0, 1)
- Valid characters: A-H, J-N, P-Z, 2-9
- 15-second request timeout

### Home Screen
- Main hub after pairing
- Shows connection status (client name, coach name, green dot)
- Three action buttons:
  - **Daily Check-In** (accent orange) -- navigates to check-in form
  - **Scan Barcode** (green) -- opens barcode scanner
  - **Health Data** (pink) -- opens health dashboard
- Displays 5 most recent barcode scans from local database
- Disconnect button to unpair device

### Check-In Screen
- **Daily health check-in form** matching the iOS native app
- **Fields**:
  - Weight (lbs) -- auto-populated from HealthKit if available, shown read-only with "Apple Health" badge
  - Steps -- auto-populated from HealthKit if available
  - Calories -- always manual entry
  - Sleep Quality -- 1-10 rating picker (tap to select, tap again to deselect)
  - Perceived Stress -- 1-10 rating picker
  - Notes -- multiline free text
- Submit button disabled until at least one field is filled
- **Submits to**: `POST /api/ingest/entry` via `submitEntry()`
- **Success view**: read-only summary with "Apple Health" badges for auto-populated fields, "Edit Entry" button to return to form
- **Error handling**: displays error message, submit button shows loading spinner

### Scanner Screen
- Uses `expo-camera` CameraView for real-time barcode scanning
- Supported barcode types: EAN-13, EAN-8, UPC-A, UPC-E
- 2-second debounce between duplicate scans
- On scan: navigates to Product screen with barcode

### Product Screen
- Displays full nutrition information for scanned product
- **Lookup flow**: SQLite cache check -> OpenFoodFacts API -> save to cache
- Shows: product name, brand, image, calories (per serving/per 100g/per package), macros
- **Serving Calculator**: custom gram input with preset buttons (25g, 50g, 100g, 150g, 200g), real-time calorie/macro calculation
- **"Log to Health" button**:
  - Writes nutrition entry to HealthKit/Health Connect
  - If paired: syncs accumulated daily nutrition totals to platform
  - Shows sync status indicator (syncing/synced/failed)

### History Screen
- Lists all scanned products (up to 100) ordered by scan date
- Shows name, brand, calories per serving, date scanned
- Tap to re-view product details
- "Clear History" button with confirmation

### Health Dashboard Screen
- **Permission flow**: checks HealthKit availability, requests permissions
- **Today's Summary** (grid tiles): steps, active calories, total burned, distance, exercise minutes, weight, body fat %, BMR, sleep hours, water, net calories
- **Recent Workouts** (7 days): type, duration, calories, distance, date
- **Week History**: 7-day daily breakdown
- **Platform Sync Section**: sync status indicator, counts of synced items, "Sync Now" button
- **Auto-sync triggers**: on screen load (if paired), on app foreground

---

## Barcode Scanning & Nutrition Data

### Data Source: OpenFoodFacts

All barcode nutrition data comes from the **OpenFoodFacts** open database.

- **API**: `https://world.openfoodfacts.net/api/v2/product/{barcode}`
- **Fields requested**: `product_name`, `brands`, `image_url`, `serving_size`, `serving_quantity`, `product_quantity`, `nutriments`
- **Nutrient fields extracted**:
  - `energy-kcal_100g`, `energy-kcal_serving`, `energy-kcal`
  - `proteins_100g`, `fat_100g`, `carbohydrates_100g`
  - `sugars_100g`, `fiber_100g`, `sodium_100g`

### Lookup Pipeline

```
Barcode scanned
  -> useBarcodeScan (2s debounce)
  -> Navigate to ProductScreen
  -> useProductLookup hook
    -> Check SQLite cache (getCachedProduct)
    -> If cached: return product, update scanned_at
    -> If not cached:
      -> GET OpenFoodFacts API
      -> normalizeProduct (parse serving sizes, calculate per-serving values)
      -> saveProduct to SQLite cache
  -> Display NutritionCard
```

### Nutrition Logging Flow

```
User taps "Log to Health"
  -> writeScannedProduct() writes to HealthKit/Health Connect
  -> If paired to coach:
    -> addScannedNutrition() accumulates daily totals in SQLite
    -> submitEntry() sends accumulated totals to POST /api/ingest/entry
```

The daily accumulator uses `INSERT ... ON CONFLICT(date) DO UPDATE` to maintain running totals per day. Each scan adds to the day's totals rather than replacing them.

### Product Data Model

```typescript
interface Product {
  barcode: string;
  name: string;
  brand: string;
  imageUrl?: string;
  servingSizeLabel: string;
  servingSizeGrams: number;
  packageSizeGrams: number;
  caloriesPer100g: number;
  caloriesPerServing: number;
  caloriesPerPackage: number | null;
  proteinPer100g: number;
  fatPer100g: number;
  carbsPer100g: number;
  sugarsPer100g: number;
  fiberPer100g: number;
  sodiumPer100g: number;
  scannedAt: string;
}
```

---

## Health Data Integration

### Platform Support

| Platform | Library | Data Source |
|----------|---------|-------------|
| iOS | `react-native-health` (via `NativeModules.AppleHealthKit`) | Apple HealthKit |
| Android | `react-native-health-connect` | Google Health Connect |

The `health.ts` service provides a platform-agnostic abstraction layer. Platform-specific implementations are in `healthkit.ios.ts` and `healthkit.android.ts`, loaded dynamically at runtime.

**Note**: New Architecture (Fabric) must be **disabled** for `react-native-health` to work. The native module is bridge-based and does not support TurboModules. `RCTNewArchEnabled` is set to `false` in `Info.plist`.

### Permissions Requested

**Read**: Steps, Active Energy, Basal Energy, Distance, Flights Climbed, Workouts, Heart Rate, Resting Heart Rate, Blood Pressure, Blood Glucose, Oxygen Saturation, Respiratory Rate, Body Temperature, Weight, Height, Body Fat, Lean Body Mass, Basal Metabolic Rate, Waist Circumference, Sleep, Water

**Write**: Nutrition, Hydration, Weight

### Health Sync Flow

Triggered by: Health Dashboard load, app foreground, manual "Sync Now" button.

```
syncHealthData()
  1. Get client_id from secure storage
  2. Calculate sync window:
     - Read last_sync_at from secure storage
     - Days = ceil((now - lastSync) / 86400000) + 1, max 14 days
  3. Run 4 parallel syncs (Promise.allSettled):
     a) Workouts -> POST /api/ingest/workouts (batched in 100-item chunks)
     b) Steps -> POST /api/ingest/steps (daily totals)
     c) Sleep -> POST /api/ingest/sleep (daily totals)
     d) Body metrics -> POST /api/ingest/profile (weight, body fat %)
  4. Update last_sync_at timestamp
  5. Return SyncResult with counts
```

### Check-In HealthKit Auto-Population

On the Check-In screen, the app calls `getTodaySummary()` which reads:
- **Steps**: today's step count (auto-fills Steps field)
- **Weight**: most recent weight in kg, converted to lbs (auto-fills Weight field)

When HealthKit data is available for a field, the manual input is hidden and replaced with a read-only display with an "Apple Health" badge.

---

## API Endpoints

All requests to `https://gcgyms.com` with `X-Pairing-Token` header (except `/api/pair`).

| Endpoint | Method | Trigger | Payload |
|----------|--------|---------|---------|
| `/api/pair` | POST | Pairing screen | `{code: string}` |
| `/api/ingest/entry` | POST | Check-in submit, nutrition log | `IngestEntryPayload` |
| `/api/ingest/workouts` | POST | Health sync | `IngestWorkoutsPayload` |
| `/api/ingest/steps` | POST | Health sync | `IngestStepsPayload` |
| `/api/ingest/sleep` | POST | Health sync | `IngestSleepPayload` |
| `/api/ingest/profile` | POST | Health sync | `IngestProfilePayload` |

**External API**:

| Endpoint | Method | Trigger | Purpose |
|----------|--------|---------|---------|
| `https://world.openfoodfacts.net/api/v2/product/{barcode}` | GET | Barcode scan (cache miss) | Nutrition data lookup |

### Key Payload: IngestEntryPayload

```typescript
{
  client_id: string;
  date: string;           // YYYY-MM-DD
  weightLbs?: number;
  steps?: number;
  calories?: number;
  proteinGrams?: number;
  carbsGrams?: number;
  fatGrams?: number;
  fiberGrams?: number;
  sleepQuality?: number;  // 1-10
  perceivedStress?: number; // 1-10
  notes?: string;
}
```

---

## Local Storage

### SQLite Database (`coachfit.db`)

**products** -- Barcode scan cache
```sql
CREATE TABLE products (
  barcode TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  data TEXT NOT NULL,     -- full Product JSON
  scanned_at TEXT NOT NULL
);
```

**daily_nutrition** -- Accumulated daily nutrition from barcode scans
```sql
CREATE TABLE daily_nutrition (
  date TEXT PRIMARY KEY,  -- YYYY-MM-DD
  calories REAL NOT NULL DEFAULT 0,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fat REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
```

**sync_queue** -- Offline request queue
```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON stringified
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
```

---

## Offline Support

Failed POST requests are automatically queued in SQLite's `sync_queue` table.

**Queue drainage**:
- Triggered when app returns to foreground and network is available
- Processes up to 50 items per drain
- Max 3 retry attempts per item; items exceeding attempts are dropped
- 401 response clears entire queue and signs out
- Network detection: pings `https://clients3.google.com/generate_204`

---

## Project Structure

```
React/
  App.tsx                          -- Root: AuthProvider + NavigationContainer
  app.json                         -- Expo config (permissions, plugins)
  src/
    screens/
      PairingScreen.tsx            -- Device pairing
      HomeScreen.tsx               -- Main hub
      CheckInScreen.tsx            -- Daily check-in form
      ScannerScreen.tsx            -- Barcode camera
      ProductScreen.tsx            -- Nutrition display + log
      HistoryScreen.tsx            -- Scan history
      HealthDashboardScreen.tsx    -- Health data + sync
    components/
      RatingPicker.tsx             -- 1-10 toggle button component
      NutritionCard.tsx            -- Product nutrition display
      ServingCalculator.tsx        -- Custom serving input
      ScanOverlay.tsx              -- Camera UI overlay
      ProductNotFound.tsx          -- Error state
    services/
      apiClient.ts                 -- HTTP layer (auth, offline queue)
      health.ts                    -- Platform-agnostic health abstraction
      healthkit.ios.ts             -- Apple HealthKit implementation
      healthkit.android.ts         -- Google Health Connect implementation
      healthSync.ts                -- Platform sync orchestration
      nutritionSync.ts             -- Barcode nutrition -> platform sync
      openFoodFacts.ts             -- OpenFoodFacts API client
      database.ts                  -- SQLite (products cache, daily_nutrition)
      dailyAccumulator.ts          -- Daily nutrition running totals
      offlineQueue.ts              -- Failed request retry queue
      secureStorage.ts             -- Keychain/Secure Storage wrapper
      nutritionCalculator.ts       -- Serving size math
    hooks/
      useBarcodeScan.ts            -- Scan debouncing
      useProductLookup.ts          -- Cache-first product lookup
      useNetworkStatus.ts          -- Connectivity + queue drain
      useAppForeground.ts          -- App lifecycle detection
    contexts/
      AuthContext.tsx               -- Pairing state management
    types/
      index.ts                     -- Product, navigation types
      api.ts                       -- API request/response types
      health.ts                    -- Health data types, HealthService interface
    constants/
      api.ts                       -- URLs, barcode config
      theme.ts                     -- Colors, spacing, fonts
  ios/
    CoachFit/
      Info.plist                   -- HealthKit permissions, camera permissions
      CoachFit.entitlements        -- HealthKit entitlement + background delivery
    Podfile                        -- CocoaPods config
```

---

## Build & Run

```bash
cd React/

# Install dependencies
npm install

# Install iOS pods
cd ios && LANG=en_US.UTF-8 pod install && cd ..

# Run on connected iPhone
npx expo run:ios --device

# Run on simulator
npx expo run:ios
```

**Important**: New Architecture must be disabled for HealthKit to work:
- `ios/CoachFit/Info.plist`: `RCTNewArchEnabled` = `false`
- `ios/Podfile.properties.json`: `"newArchEnabled": "false"`

---

## Relationship to iOS Native App

The React Native app replaces the iOS Swift/SwiftUI app at `/iOS/`. Both apps provide the same core features:

| Feature | iOS Native | React Native |
|---------|-----------|--------------|
| Pairing | Yes | Yes |
| Daily Check-In | Yes (TodayTab) | Yes (CheckInScreen) |
| HealthKit Auto-Population | Yes | Yes |
| HealthKit Sync | Yes | Yes |
| Barcode Scanner | No | Yes |
| Nutrition Logging | No | Yes (OpenFoodFacts) |
| Offline Queue | No | Yes |
| Android Support | No | Yes (Health Connect) |

The React Native app submits data to the same API endpoints as the iOS native app, using the same `X-Pairing-Token` authentication. Both apps are interchangeable from the platform's perspective.
