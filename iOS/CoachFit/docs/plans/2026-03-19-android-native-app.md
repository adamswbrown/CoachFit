# CoachFit Android Native App - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native Android app with full feature parity to the iOS CoachFit app.

**Architecture:** Kotlin + Jetpack Compose UI, Health Connect API for health data, Room for local storage, WorkManager for background sync. Zero third-party UI libraries — Material 3 components only. Retrofit for networking, EncryptedSharedPreferences for secure token storage.

**Tech Stack:** Kotlin, Jetpack Compose, Health Connect API, Room, WorkManager, ML Kit Barcode Scanning, CameraX, Retrofit, Material 3, Hilt (DI)

---

## Project Setup

**Package:** `com.askadam.coachfit`
**Min SDK:** 28 (Android 9 — Health Connect requirement)
**Target SDK:** 35
**Build System:** Gradle (Kotlin DSL)

### Dependencies

```kotlin
// Compose + Material 3
implementation("androidx.compose.material3:material3:1.3.x")
implementation("androidx.navigation:navigation-compose:2.8.x")
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.x")

// Health Connect
implementation("androidx.health.connect:connect-client:1.1.x")

// Room (local DB)
implementation("androidx.room:room-runtime:2.6.x")
implementation("androidx.room:room-ktx:2.6.x")
kapt("androidx.room:room-compiler:2.6.x")

// WorkManager (background sync)
implementation("androidx.work:work-runtime-ktx:2.9.x")

// Networking
implementation("com.squareup.retrofit2:retrofit:2.11.x")
implementation("com.squareup.retrofit2:converter-gson:2.11.x")
implementation("com.squareup.okhttp3:okhttp:4.12.x")

// Barcode scanning
implementation("com.google.mlkit:barcode-scanning:17.3.x")
implementation("androidx.camera:camera-camera2:1.4.x")
implementation("androidx.camera:camera-lifecycle:1.4.x")
implementation("androidx.camera:camera-view:1.4.x")

// Secure storage
implementation("androidx.security:security-crypto:1.1.0-alpha06")

// Hilt DI
implementation("com.google.dagger:hilt-android:2.51.x")
kapt("com.google.dagger:hilt-compiler:2.51.x")
implementation("androidx.hilt:hilt-work:1.2.x")
implementation("androidx.hilt:hilt-navigation-compose:1.2.x")

// Coil (image loading)
implementation("io.coil-kt:coil-compose:2.7.x")

// DataStore (preferences)
implementation("androidx.datastore:datastore-preferences:1.1.x")
```

---

## Architecture Overview

```
app/
├── CoachFitApp.kt                    // @HiltAndroidApp
├── MainActivity.kt                   // Single activity, Compose host
├── di/
│   ├── AppModule.kt                  // Hilt modules (Retrofit, Room, DataStore)
│   └── HealthConnectModule.kt
├── data/
│   ├── local/
│   │   ├── CoachFitDatabase.kt       // Room database
│   │   ├── FoodLogDao.kt             // Room DAO
│   │   └── FoodLogEntry.kt           // Room Entity
│   ├── remote/
│   │   ├── ApiService.kt             // Retrofit interface
│   │   ├── AuthInterceptor.kt        // Adds X-Pairing-Token header
│   │   └── ApiModels.kt              // Request/response DTOs
│   └── repository/
│       ├── AuthRepository.kt         // Token storage, sign-in/out
│       ├── CheckInRepository.kt      // Daily entry submission
│       ├── FoodRepository.kt         // OpenFoodFacts + USDA search
│       ├── HealthRepository.kt       // Health Connect reads/writes
│       └── SyncRepository.kt         // Background sync orchestration
├── health/
│   ├── HealthConnectManager.kt       // Health Connect client wrapper
│   └── SyncWorker.kt                 // WorkManager periodic sync
├── ui/
│   ├── navigation/
│   │   └── NavGraph.kt               // Navigation routes
│   ├── theme/
│   │   └── Theme.kt                  // Material 3 theme (dark navy + teal)
│   ├── screens/
│   │   ├── SignInScreen.kt
│   │   ├── onboarding/
│   │   │   ├── OnboardingFlow.kt     // HorizontalPager with 7 steps
│   │   │   ├── WelcomeStep.kt
│   │   │   ├── GoalStep.kt
│   │   │   ├── ProfileStep.kt
│   │   │   ├── HealthConnectStep.kt
│   │   │   ├── FoodTrackingStep.kt
│   │   │   ├── CheckInStep.kt
│   │   │   └── CompletionStep.kt
│   │   ├── today/
│   │   │   ├── TodayScreen.kt
│   │   │   └── TodayViewModel.kt
│   │   ├── food/
│   │   │   ├── FoodLogEntryScreen.kt   // Category picker
│   │   │   ├── FoodSearchScreen.kt     // Product + ingredient search
│   │   │   ├── FoodLogScreen.kt        // History view
│   │   │   ├── ProductScreen.kt        // Serving calc + log
│   │   │   ├── ScannerScreen.kt        // CameraX + ML Kit
│   │   │   └── FoodViewModel.kt
│   │   ├── health/
│   │   │   ├── HealthDashboardScreen.kt
│   │   │   └── HealthViewModel.kt
│   │   └── more/
│   │       └── MoreScreen.kt
│   └── components/
│       ├── StreakBanner.kt
│       ├── MilestoneCard.kt
│       ├── RatingPicker.kt
│       ├── NoteChips.kt
│       └── CompactTile.kt
└── util/
    ├── DateUtils.kt
    └── Extensions.kt
```

---

## Task Breakdown

### Task 1: Project Scaffold + Theme + Navigation Shell

**Files:**
- Create: `app/build.gradle.kts` (dependencies)
- Create: `CoachFitApp.kt`, `MainActivity.kt`
- Create: `di/AppModule.kt`
- Create: `ui/theme/Theme.kt` (dark navy #1A1A2E + teal #4ECDC4)
- Create: `ui/navigation/NavGraph.kt`

**Steps:**
1. Create new Android project `com.askadam.coachfit` with Compose
2. Add all dependencies to build.gradle.kts
3. Set up Hilt application class
4. Create Material 3 theme matching iOS (dark navy background, teal accent)
5. Create navigation graph with routes: signIn, onboarding, home (tabs)
6. Create empty placeholder screens for each route
7. Verify app builds and shows empty home screen
8. Commit

**Verification:** App launches, shows bottom nav with 5 tabs, theme colors match iOS.

---

### Task 2: Secure Storage + Auth Repository

**Files:**
- Create: `data/repository/AuthRepository.kt`
- Create: `data/remote/AuthInterceptor.kt`

**Steps:**
1. Create AuthRepository using EncryptedSharedPreferences
   - Store: deviceToken, clientId, clientName, coachName
   - Methods: saveCredentials(), clearCredentials(), isSignedIn(), getDeviceToken()
2. Create AuthInterceptor (OkHttp Interceptor)
   - Reads deviceToken from AuthRepository
   - Adds `X-Pairing-Token` header to every request
   - On 401 response: triggers sign-out callback
3. Wire into Hilt AppModule
4. Commit

**Verification:** AuthRepository stores/retrieves token from encrypted storage.

---

### Task 3: Retrofit API Service

**Files:**
- Create: `data/remote/ApiService.kt`
- Create: `data/remote/ApiModels.kt`
- Modify: `di/AppModule.kt` (provide Retrofit)

**Steps:**
1. Define ApiModels matching iOS payloads:
   - RegisterDeviceResponse, SubmitEntryRequest, WorkoutPayload, SleepPayload, StepsPayload, ProfilePayload, StreakResponse
2. Define ApiService interface:
   ```kotlin
   @POST("api/client/register-device")
   suspend fun registerDevice(): RegisterDeviceResponse

   @POST("api/ingest/entry")
   suspend fun submitEntry(@Body entry: SubmitEntryRequest): Response<Any>

   @POST("api/ingest/workouts")
   suspend fun submitWorkouts(@Body payload: WorkoutPayload): Response<Any>

   @POST("api/ingest/sleep")
   suspend fun submitSleep(@Body payload: SleepPayload): Response<Any>

   @POST("api/ingest/steps")
   suspend fun submitSteps(@Body payload: StepsPayload): Response<Any>

   @POST("api/ingest/profile")
   suspend fun submitProfile(@Body payload: ProfilePayload): Response<Any>

   @GET("api/client/streak")
   suspend fun getStreak(): StreakResponse
   ```
3. Provide Retrofit instance in AppModule with base URL `https://gcgyms.com`, AuthInterceptor, Gson converter
4. Commit

**Verification:** Compiles, Retrofit instance injectable.

---

### Task 4: Room Database + FoodLogEntry

**Files:**
- Create: `data/local/FoodLogEntry.kt` (Room Entity)
- Create: `data/local/FoodLogDao.kt`
- Create: `data/local/CoachFitDatabase.kt`
- Modify: `di/AppModule.kt` (provide Room)

**Steps:**
1. Create FoodLogEntry entity matching iOS:
   ```kotlin
   @Entity(tableName = "food_log")
   data class FoodLogEntry(
       @PrimaryKey(autoGenerate = true) val id: Long = 0,
       val date: String,          // YYYY-MM-DD
       val barcode: String?,
       val name: String,
       val brand: String?,
       val servingGrams: Double,
       val calories: Double,
       val protein: Double,
       val fat: Double,
       val carbs: Double,
       val sugar: Double?,
       val fiber: Double?,
       val sodium: Double?,
       val loggedAt: Long          // epoch millis
   )
   ```
2. Create FoodLogDao with: insertEntry, getEntriesForDate, getEntriesForDateRange, deleteEntry
3. Create CoachFitDatabase with FoodLogEntry entity
4. Provide in AppModule
5. Commit

**Verification:** Room compiles, DAO methods work.

---

### Task 5: Sign-In Screen

**Files:**
- Create: `ui/screens/SignInScreen.kt`
- Create: `data/repository/AuthRepository.kt` (add register method)

**Steps:**
1. Create sign-in screen with:
   - App icon + "CoachFit" title
   - "Sign In" button (triggers Clerk or custom auth flow)
   - Loading state during device registration
   - Error display
2. On successful auth: call `/api/client/register-device`, store credentials
3. Navigate to onboarding (if first time) or home
4. Commit

**Note:** Auth provider choice — options are:
- **Clerk Android SDK** (if available and mature)
- **Firebase Auth** (most mature Android auth SDK)
- **Custom email/password** (simplest, matches pairing flow)

Recommend starting with the existing pairing code flow (POST /api/pair) as a fallback, then add Clerk/Firebase later.

**Verification:** User can sign in, token stored, navigates to next screen.

---

### Task 6: Onboarding Flow (7 Steps)

**Files:**
- Create: `ui/screens/onboarding/OnboardingFlow.kt`
- Create: `ui/screens/onboarding/WelcomeStep.kt`
- Create: `ui/screens/onboarding/GoalStep.kt`
- Create: `ui/screens/onboarding/ProfileStep.kt`
- Create: `ui/screens/onboarding/HealthConnectStep.kt`
- Create: `ui/screens/onboarding/FoodTrackingStep.kt`
- Create: `ui/screens/onboarding/CheckInStep.kt`
- Create: `ui/screens/onboarding/CompletionStep.kt`

**Steps:**
1. Create OnboardingFlow using HorizontalPager
2. Add progress dots indicator
3. Implement each step matching iOS:
   - Welcome: coach name + greeting
   - Goal: 4 tappable cards
   - Profile: height (cm), weight (kg), activity level — skippable
   - Health Connect: permission explanation + connect button
   - Food Tracking: barcode scanning preview
   - Check-In: daily check-in preview
   - Completion: summary + "Start" button
4. On completion: POST profile to /api/ingest/profile, save onboardingComplete to DataStore
5. Commit

**Verification:** Full onboarding flow works, profile submitted to server.

---

### Task 7: Health Connect Manager

**Files:**
- Create: `health/HealthConnectManager.kt`
- Create: `di/HealthConnectModule.kt`

**Steps:**
1. Create HealthConnectManager:
   - Check Health Connect availability (isAvailable)
   - Request permissions for read types:
     - Steps, Weight, Height, HeartRate, BodyFat, Sleep, ExerciseSession
     - ActiveCalories, BasalMetabolicRate, Distance, FloorsClimbed, Hydration
   - Request permissions for write types:
     - NutritionRecord, Hydration, Weight
   - Fetch methods:
     - `fetchTodaySteps()` — aggregate today's step count
     - `fetchLatestWeight(lookbackDays: 30)` — most recent weight
     - `fetchLatestBodyFat(lookbackDays: 30)`
     - `fetchSleepLastNight()` — sleep sessions from last night
     - `fetchWorkouts(since: Instant)` — exercise sessions
     - `fetchDailySummary(date: LocalDate)` — all metrics for one day
     - `fetchWeekSummaries()` — last 7 days
   - Write methods:
     - `saveNutrition(calories, protein, fat, carbs, date)`
     - `saveWater(milliliters, date)`
     - `saveWeight(kg, date)`
2. Health Connect data type mappings:

   | iOS HealthKit | Android Health Connect |
   |---|---|
   | HKQuantityType(.stepCount) | StepsRecord |
   | HKQuantityType(.bodyMass) | WeightRecord |
   | HKQuantityType(.height) | HeightRecord |
   | HKQuantityType(.heartRate) | HeartRateRecord |
   | HKQuantityType(.bodyFatPercentage) | BodyFatRecord |
   | HKCategoryType(.sleepAnalysis) | SleepSessionRecord |
   | HKWorkoutType | ExerciseSessionRecord |
   | HKQuantityType(.activeEnergyBurned) | ActiveCaloriesBurnedRecord |
   | HKQuantityType(.basalEnergyBurned) | BasalMetabolicRateRecord |
   | HKQuantityType(.distanceWalkingRunning) | DistanceRecord |
   | HKQuantityType(.flightsClimbed) | FloorsClimbedRecord |
   | HKQuantityType(.dietaryWater) | HydrationRecord |
   | HKQuantityType(.dietaryEnergyConsumed) | NutritionRecord |
   | HKQuantityType(.dietaryProtein) | NutritionRecord.protein |
   | HKQuantityType(.dietaryFatTotal) | NutritionRecord.totalFat |
   | HKQuantityType(.dietaryCarbohydrates) | NutritionRecord.totalCarbohydrate |

3. Provide via Hilt
4. Commit

**Verification:** Health Connect permissions requested, data reads return values.

**Important difference from iOS:** Health Connect does NOT support background delivery like HealthKit's observer queries. Background sync must be driven by WorkManager on a schedule.

---

### Task 8: Sync Engine + WorkManager

**Files:**
- Create: `health/SyncWorker.kt`
- Create: `data/repository/SyncRepository.kt`

**Steps:**
1. Create SyncRepository:
   - Per-type last sync timestamps in DataStore
   - Sync methods for each type (workouts, sleep, steps, weight)
   - Chunked uploads (workouts: 100, sleep/steps: 400, weight: 50)
   - Offline queue in Room (max 50 items)
   - Parallel sync via coroutineScope + async
2. Create SyncWorker (PeriodicWorkRequest):
   - Runs every 6 hours (matching iOS BGAppRefreshTask)
   - Calls SyncRepository.syncAll()
   - Constraints: NetworkType.CONNECTED
3. Schedule worker in CoachFitApp.onCreate()
4. Also trigger sync on app foreground (in MainActivity lifecycle)
5. Commit

**Verification:** WorkManager schedules periodic sync, data syncs to server.

---

### Task 9: Today Screen (Daily Check-In)

**Files:**
- Create: `ui/screens/today/TodayScreen.kt`
- Create: `ui/screens/today/TodayViewModel.kt`
- Create: `ui/components/RatingPicker.kt`
- Create: `ui/components/NoteChips.kt`
- Create: `data/repository/CheckInRepository.kt`

**Steps:**
1. Create TodayViewModel:
   - Load today's HealthKit data (steps, weight, sleep, workouts)
   - Load today's food log calories from Room
   - Track submitted state via DataStore (key: "checkin_YYYY-MM-DD")
   - Submit entry to /api/ingest/entry
2. Create TodayScreen matching iOS layout:
   - Streak card at top
   - Auto-tracked HealthKit tiles (compact grid)
   - Check-in form: calories (pre-filled from food log), weight, steps, sleep quality (1-10), stress (1-10), notes with chip suggestions
   - "Send to [Coach Name]" button
   - Submitted state with summary + Edit button + Cancel
   - Haptic feedback on success
   - Pull-to-refresh
3. Create RatingPicker (1-10 tappable circles)
4. Create NoteChips (FlowRow of tappable chips)
5. Commit

**Verification:** Check-in submits to server, auto-populates from Health Connect + food log.

---

### Task 10: Food Logging — Category Picker + Search

**Files:**
- Create: `ui/screens/food/FoodLogEntryScreen.kt`
- Create: `ui/screens/food/FoodSearchScreen.kt`
- Create: `ui/screens/food/ProductScreen.kt`
- Create: `ui/screens/food/FoodViewModel.kt`
- Create: `data/repository/FoodRepository.kt`

**Steps:**
1. Create FoodRepository:
   - `searchProducts(query)` — OpenFoodFacts API
   - `searchIngredients(query)` — USDA FDC API (nutrient IDs: 1008/2047/2048 for kcal, 1003 protein, 1004 fat, 1005 carbs, 2000 sugars, 1079 fiber, 1093 sodium)
   - `lookupBarcode(barcode)` — OpenFoodFacts barcode API
   - Rate limit handling for USDA
2. Create FoodLogEntryScreen — 4 category cards:
   - Scan Barcode, Search Products, Search Ingredients, Log Manually
3. Create FoodSearchScreen:
   - Supports both product and ingredient modes
   - Debounced search (500ms)
   - Results show: name, brand/category, kcal, P/F/C per 100g
   - Navigate to ProductScreen on tap
4. Create ProductScreen:
   - Serving size slider (1-500g)
   - Live macro calculation
   - Log button: save to Room + write to Health Connect
   - Manual entry form for not-found products
5. Commit

**Verification:** Search returns results, product logged to Room and Health Connect.

---

### Task 11: Barcode Scanner

**Files:**
- Create: `ui/screens/food/ScannerScreen.kt`

**Steps:**
1. Create ScannerScreen using CameraX + ML Kit:
   - CameraX preview (back camera)
   - ML Kit BarcodeScanning with formats: FORMAT_EAN_13, FORMAT_EAN_8, FORMAT_UPC_A, FORMAT_UPC_E, FORMAT_CODE_128, FORMAT_CODE_39, FORMAT_CODE_93, FORMAT_ITF, FORMAT_DATA_MATRIX, FORMAT_QR_CODE
   - 2-second debounce between detections
   - Camera permission handling
   - Manual barcode text field at bottom
   - Navigate to ProductScreen on detection
2. Add camera permission to AndroidManifest.xml
3. Commit

**Verification:** Camera opens, barcodes detected, navigates to product screen.

---

### Task 12: Food Log View

**Files:**
- Create: `ui/screens/food/FoodLogScreen.kt`

**Steps:**
1. Create FoodLogScreen:
   - Segmented control: Today / This Week
   - Today: calorie banner + macro row + entry list (sorted by time)
   - Week: sections by date with daily totals
   - Swipe-to-dismiss for delete
   - Empty state with icon
2. Use Room @Query with Flow for reactive updates
3. Commit

**Verification:** Logged food appears in list, deletable, totals correct.

---

### Task 13: Health Dashboard

**Files:**
- Create: `ui/screens/health/HealthDashboardScreen.kt`
- Create: `ui/screens/health/HealthViewModel.kt`
- Create: `ui/components/CompactTile.kt`

**Steps:**
1. Create HealthViewModel:
   - Fetch daily summary from Health Connect
   - Fetch week summaries (7 days parallel)
   - Fetch recent workouts
   - Expose sync status from SyncRepository
2. Create HealthDashboardScreen:
   - Permission states: checking, unavailable, needs permission, connected
   - Today summary: 2-column grid of 9 tiles (steps, active cal, total burned, distance, exercise, weight, body fat, sleep, water)
   - Recent workouts with type icons
   - Week history rows
   - Sync status section (if paired)
   - Pull-to-refresh
3. Commit

**Verification:** Dashboard shows Health Connect data, workouts listed, sync status visible.

---

### Task 14: More Screen

**Files:**
- Create: `ui/screens/more/MoreScreen.kt`

**Steps:**
1. Create MoreScreen:
   - Coach info (name)
   - Sync status per data type
   - Manual "Sync Now" button
   - "View Dashboard" link (opens Chrome Custom Tab with auth handoff)
   - "Unpair" button with confirmation dialog
   - App version
2. Milestones section (if any from streak API)
3. Commit

**Verification:** Sync status shows, unpair works, web dashboard opens.

---

### Task 15: CSV Import (Cronometer)

**Files:**
- Create: `ui/screens/more/ImportScreen.kt`
- Add to: `data/repository/FoodRepository.kt`

**Steps:**
1. Add CSV parser to FoodRepository:
   - File picker via ActivityResultContracts.OpenDocument
   - Parse CSV matching iOS logic (column matching, date formats, quote handling)
2. Create ImportScreen:
   - File picker button
   - Preview parsed rows
   - Upload to /api/ingest/cronometer
   - Success/error display
3. Commit

**Verification:** CSV file parsed, rows displayed, uploaded to server.

---

### Task 16: App Icon + Polish

**Files:**
- Modify: `res/mipmap-*/` (app icons)
- Modify: `AndroidManifest.xml` (permissions, metadata)

**Steps:**
1. Generate adaptive icon from existing SVG (dark navy background + teal pulse/checkmark)
2. Create adaptive icon XML (foreground layer + background color)
3. Add all required permissions to manifest:
   - CAMERA
   - INTERNET
   - ACCESS_NETWORK_STATE
   - RECEIVE_BOOT_COMPLETED (WorkManager)
   - health.READ_* and health.WRITE_* permissions
4. Add Health Connect intent filter
5. Final UI polish pass: loading states, error states, empty states
6. Commit

**Verification:** App icon appears on launcher, all permissions declared.

---

### Task 17: Testing + Build Verification

**Steps:**
1. Unit tests:
   - FoodRepository (API parsing)
   - SyncRepository (chunking, offline queue)
   - CheckInRepository (date logic)
   - CSV parser
2. Instrumented tests:
   - Room DAO operations
   - Health Connect read/write (mock)
3. Full build: `./gradlew assembleDebug`
4. Install on device and smoke test all features
5. Commit

**Verification:** All tests pass, debug APK installs and runs.

---

## Rollback Procedure

This is a greenfield project — rollback is simply not deploying the APK. No existing Android app to break.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Health Connect not installed on user's device | Medium | High | Check availability, prompt to install from Play Store |
| Health Connect API differences from HealthKit | High | Medium | Map data types carefully (Task 7 table), test on real device |
| No background delivery in Health Connect | Certain | Medium | WorkManager every 6 hours + foreground sync on app open |
| Clerk Android SDK immature | Medium | Low | Fall back to pairing code flow initially |
| ML Kit barcode detection accuracy | Low | Low | Supports same symbologies as Vision framework |
| CameraX lifecycle issues | Medium | Low | Use LifecycleCameraProvider, test thoroughly |

## Estimated Effort

| Task | Estimate |
|------|----------|
| 1. Project scaffold | 0.5 day |
| 2. Secure storage + auth | 0.5 day |
| 3. Retrofit API | 0.5 day |
| 4. Room database | 0.5 day |
| 5. Sign-in screen | 1 day |
| 6. Onboarding flow | 1.5 days |
| 7. Health Connect manager | 2 days |
| 8. Sync engine + WorkManager | 1.5 days |
| 9. Today screen (check-in) | 1.5 days |
| 10. Food search + logging | 1.5 days |
| 11. Barcode scanner | 1 day |
| 12. Food log view | 0.5 day |
| 13. Health dashboard | 1 day |
| 14. More screen | 0.5 day |
| 15. CSV import | 0.5 day |
| 16. App icon + polish | 0.5 day |
| 17. Testing + verification | 1 day |
| **Total** | **~15 days** |

## Key Differences from iOS

| Aspect | iOS | Android |
|--------|-----|---------|
| UI Framework | SwiftUI | Jetpack Compose |
| Health API | HealthKit (observer queries, background delivery) | Health Connect (no background delivery, poll via WorkManager) |
| Local DB | SwiftData | Room |
| Secure Storage | Keychain | EncryptedSharedPreferences |
| Background Sync | BGAppRefreshTask + HKObserverQuery | WorkManager PeriodicWorkRequest only |
| Barcode Scanning | Vision framework | ML Kit + CameraX |
| DI | Manual (environment injection) | Hilt |
| State Management | @Observable + @Environment | ViewModel + StateFlow + Hilt |
| Image Loading | AsyncImage (built-in) | Coil library |
| CSV File Picker | UIDocumentPickerViewController | ActivityResultContracts.OpenDocument |
