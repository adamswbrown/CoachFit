# Native iOS Feature Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add barcode scanning, food logging, nutrition tracking, expanded health dashboard, and streak/milestone display to the native iOS app — achieving feature parity with the React Native version.

**Architecture:** Add 4 new SwiftUI views (ScannerTab, ProductView, FoodLogView, HealthDashboardView) and 3 new services (BarcodeService for OpenFoodFacts, FoodLogStore for SwiftData persistence, NutritionWriter for HealthKit writes). Integrate into existing HomeView TabView. Follow existing patterns: @Observable services, @Environment(AppState.self), async/await, no third-party dependencies.

**Tech Stack:** SwiftUI, SwiftData (iOS 17+), AVFoundation (camera), HealthKit (expanded types), Vision (barcode detection)

---

## Existing Codebase Reference

**App root:** `/Users/adambrown/Developer/CoachFit/iOS/CoachFit/CoachFit/`

| File | Purpose |
|------|---------|
| `Models/AppState.swift` | Central @Observable state, owns services |
| `Services/APIClient.swift` | HTTP client, `authenticatedRequest()`, `POST /api/ingest/*` |
| `Services/HealthKitManager.swift` | HealthKit queries (steps, workouts, sleep, weight, height) |
| `Services/SyncEngine.swift` | Parallel sync with offline queue |
| `Services/KeychainService.swift` | Secure token storage |
| `Views/HomeView.swift` | TabView with Today/Import/More tabs |
| `Views/TodayTab.swift` | Daily check-in form |

**Patterns:** `@Observable` classes, `@Environment(AppState.self)`, async/await, `HKHealthStore` queries bridged via `withCheckedThrowingContinuation`.

**API base:** `https://gcgyms.com` with `X-Pairing-Token` header auth.

---

## Task 1: Add SwiftData Food Log Model

**Files:**
- Create: `Models/FoodLogEntry.swift`

**Step 1: Create the SwiftData model**

```swift
import Foundation
import SwiftData

@Model
final class FoodLogEntry {
    var date: String          // YYYY-MM-DD
    var barcode: String?
    var name: String
    var brand: String?
    var servingGrams: Double
    var calories: Double
    var protein: Double
    var fat: Double
    var carbs: Double
    var sugar: Double?
    var fiber: Double?
    var sodium: Double?       // mg
    var loggedAt: Date

    init(date: String, barcode: String? = nil, name: String, brand: String? = nil,
         servingGrams: Double, calories: Double, protein: Double, fat: Double,
         carbs: Double, sugar: Double? = nil, fiber: Double? = nil,
         sodium: Double? = nil, loggedAt: Date = .now) {
        self.date = date
        self.barcode = barcode
        self.name = name
        self.brand = brand
        self.servingGrams = servingGrams
        self.calories = calories
        self.protein = protein
        self.fat = fat
        self.carbs = carbs
        self.sugar = sugar
        self.fiber = fiber
        self.sodium = sodium
        self.loggedAt = loggedAt
    }
}
```

**Step 2: Add SwiftData container to CoachFitApp.swift**

Add `.modelContainer(for: FoodLogEntry.self)` to the WindowGroup in `CoachFitApp.swift`.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add SwiftData FoodLogEntry model"
```

---

## Task 2: Add Product Model and OpenFoodFacts Service

**Files:**
- Create: `Models/Product.swift`
- Create: `Services/BarcodeService.swift`

**Step 1: Create Product model**

```swift
import Foundation

struct Product: Sendable {
    let barcode: String
    let name: String
    let brand: String
    let imageURL: URL?
    let servingLabel: String?
    let servingGrams: Double
    let caloriesPer100g: Double
    let proteinPer100g: Double
    let fatPer100g: Double
    let carbsPer100g: Double
    let sugarsPer100g: Double
    let fiberPer100g: Double
    let sodiumPer100g: Double  // mg

    func scaled(grams: Double) -> (calories: Double, protein: Double, fat: Double, carbs: Double) {
        let ratio = grams / 100.0
        return (caloriesPer100g * ratio, proteinPer100g * ratio, fatPer100g * ratio, carbsPer100g * ratio)
    }
}
```

**Step 2: Create BarcodeService**

```swift
import Foundation

enum BarcodeService {
    enum LookupError: LocalizedError {
        case notFound
        case networkError(Error)

        var errorDescription: String? {
            switch self {
            case .notFound: "Product not found"
            case .networkError(let e): "Network error: \(e.localizedDescription)"
            }
        }
    }

    static func lookup(barcode: String) async throws -> Product {
        let url = URL(string: "https://world.openfoodfacts.net/api/v2/product/\(barcode)?fields=product_name,brands,image_front_url,serving_quantity,serving_size,nutriments")!

        let (data, response) = try await URLSession.shared.data(from: url)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw LookupError.notFound
        }

        let json = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let status = json?["status"] as? Int, status == 1,
              let product = json?["product"] as? [String: Any] else {
            throw LookupError.notFound
        }

        let nutriments = product["nutriments"] as? [String: Any] ?? [:]
        let servingQty = product["serving_quantity"] as? Double
        let servingSize = product["serving_size"] as? String

        return Product(
            barcode: barcode,
            name: product["product_name"] as? String ?? "Unknown Product",
            brand: product["brands"] as? String ?? "",
            imageURL: (product["image_front_url"] as? String).flatMap(URL.init),
            servingLabel: servingSize,
            servingGrams: servingQty ?? 100,
            caloriesPer100g: nutriments["energy-kcal_100g"] as? Double ?? 0,
            proteinPer100g: nutriments["proteins_100g"] as? Double ?? 0,
            fatPer100g: nutriments["fat_100g"] as? Double ?? 0,
            carbsPer100g: nutriments["carbohydrates_100g"] as? Double ?? 0,
            sugarsPer100g: nutriments["sugars_100g"] as? Double ?? 0,
            fiberPer100g: nutriments["fiber_100g"] as? Double ?? 0,
            sodiumPer100g: (nutriments["sodium_100g"] as? Double ?? 0) * 1000 // g → mg
        )
    }
}
```

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Product model and OpenFoodFacts barcode lookup"
```

---

## Task 3: Add Barcode Scanner View

**Files:**
- Create: `Views/ScannerView.swift`

**Step 1: Create scanner using AVFoundation + Vision**

Build a SwiftUI view wrapping `AVCaptureSession` with `VNDetectBarcodesRequest` for barcode detection. Support EAN-13, EAN-8, UPC-A, UPC-E. Include a manual barcode entry field as fallback. On scan, navigate to ProductView with the barcode.

Key implementation points:
- Use `UIViewControllerRepresentable` wrapping a `UIViewController` that manages `AVCaptureSession`
- Use `VNBarcodeObservation` for detection
- Debounce scans (2 second cooldown)
- Include camera permission request handling
- Show "Type barcode manually" text field at bottom
- Pass scanned barcode back via a callback closure

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add barcode scanner view with AVFoundation + Vision"
```

---

## Task 4: Add Product Detail View with Serving Calculator

**Files:**
- Create: `Views/ProductView.swift`

**Step 1: Create product detail view**

Build a SwiftUI view that:
1. Accepts a `barcode: String` parameter
2. On appear, calls `BarcodeService.lookup(barcode:)`
3. Shows loading → product card OR "not found" with manual entry form
4. Displays: product name, brand, image (AsyncImage), nutrition per serving
5. Serving size slider (1g to 500g, default to product's serving size)
6. Dynamically updates calories/macros based on slider
7. "Log Food" button that:
   a. Saves to SwiftData `FoodLogEntry`
   b. Writes nutrition to HealthKit (see Task 6)
   c. Syncs to platform if paired (fire-and-forget)
8. "Scan Another" button to go back

For manual entry (product not found), show a form with: name, brand, serving size, calories, protein, fat, carbs per 100g.

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add product detail view with serving calculator"
```

---

## Task 5: Add Food Log View

**Files:**
- Create: `Views/FoodLogView.swift`

**Step 1: Create food log view**

Build a SwiftUI view that:
1. Uses `@Query` to fetch `FoodLogEntry` from SwiftData
2. Shows toggle: Today / This Week
3. **Today view**: Total calories banner + list of entries (name, brand, serving, time, calories)
4. **Week view**: Sections by date with daily totals
5. Swipe-to-delete on entries
6. Empty state messaging

Filter today: `date == todayString`. Filter week: `date >= sevenDaysAgoString`.

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add food log view with daily and weekly display"
```

---

## Task 6: Expand HealthKit Manager — Writes and Extra Read Types

**Files:**
- Modify: `Services/HealthKitManager.swift`

**Step 1: Add write permissions and new read types**

Add to the authorization request:
- **Read**: heartRate, bloodPressureSystolic, bloodPressureDiastolic, oxygenSaturation, respiratoryRate, bodyTemperature, bodyFatPercentage, leanBodyMass, basalEnergyBurned, dietaryWater, dietaryEnergyConsumed, activeEnergyBurned, distanceWalkingRunning, flightsClimbed
- **Write**: dietaryEnergyConsumed, dietaryProtein, dietaryFatTotal, dietaryCarbohydrates, dietaryWater, bodyMass

**Step 2: Add write functions**

```swift
func saveNutrition(calories: Double, protein: Double?, fat: Double?, carbs: Double?, date: Date) async throws {
    // Save each nutrient as a separate HKQuantitySample
}

func saveWater(liters: Double, date: Date) async throws {
    // Save HKQuantitySample for dietaryWater in mL
}

func saveWeight(kg: Double, date: Date) async throws {
    // Save HKQuantitySample for bodyMass
}
```

**Step 3: Add expanded fetch functions for health dashboard**

```swift
func fetchHeartRate(since: Date) async throws -> [(date: Date, bpm: Double)]
func fetchActiveCalories(since: Date) async throws -> [(date: String, kcal: Double)]
func fetchBasalCalories(since: Date) async throws -> [(date: String, kcal: Double)]
func fetchDistance(since: Date) async throws -> [(date: String, meters: Double)]
func fetchFloorsClimbed(since: Date) async throws -> [(date: String, floors: Double)]
func fetchBodyFat(since: Date) async throws -> [(date: Date, percentage: Double)]
func fetchHydration(since: Date) async throws -> [(date: String, mL: Double)]

struct DailyHealthSummary: Sendable {
    let date: String
    let steps: Int?
    let activeCalories: Int?
    let basalCalories: Int?
    let totalCaloriesBurned: Int?
    let distanceMeters: Int?
    let exerciseMinutes: Int?
    let weight: Double?
    let bodyFatPercentage: Double?
    let sleepMinutes: Int?
    let waterLiters: Double?
}

func fetchDailySummary(for date: Date) async -> DailyHealthSummary
func fetchWeekSummaries() async -> [DailyHealthSummary]
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: expand HealthKit manager with writes and additional read types"
```

---

## Task 7: Add Health Dashboard View

**Files:**
- Create: `Views/HealthDashboardView.swift`

**Step 1: Create health dashboard**

Build a SwiftUI view showing:
1. **Today's summary** as a 2-column grid of tiles (steps, active cal, total burned, distance, exercise min, weight, body fat, BMR, sleep hours, water, net calories)
2. **Recent workouts** (last 7 days) — list with type icon, duration, calories, distance
3. **Week history** — list of daily rows with key metrics
4. **Sync status** (if paired) — sync button, last sync time, per-type counts

Use `fetchDailySummary()` and `fetchWeekSummaries()` from HealthKitManager.

States: checking → unavailable → needs permission → connected (with data).

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add health dashboard view with today summary, workouts, week history"
```

---

## Task 8: Add Streak and Milestone Display to Home

**Files:**
- Create: `Views/Components/StreakBanner.swift`
- Create: `Views/Components/MilestoneCard.swift`
- Create: `Services/StreakService.swift`
- Modify: `Views/HomeView.swift` (add streak to MoreTab or create a new HomeTab)

**Step 1: Create streak service**

```swift
enum StreakService {
    struct StreakData: Sendable {
        let currentStreak: Int
        let longestStreak: Int
        let milestones: [Milestone]
    }

    struct Milestone: Sendable, Identifiable {
        let id: String
        let title: String
        let description: String?
        let coachMessage: String?
        let coachName: String?
        let achievedAt: String?
    }

    static func fetch(apiClient: APIClient) async throws -> StreakData {
        let (data, _) = try await apiClient.authenticatedRequest(path: "/api/client/streak")
        // Decode and return
    }
}
```

**Step 2: Create StreakBanner and MilestoneCard views**

Simple SwiftUI views matching the React Native versions.

**Step 3: Add to home screen**

Add streak banner and recent milestones to the MoreTab or create a dedicated home/overview section.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add streak tracking and milestone display"
```

---

## Task 9: Update Tab Navigation

**Files:**
- Modify: `Views/HomeView.swift`

**Step 1: Update TabView to include new tabs**

Change the TabView from 3 tabs to 5 tabs:

```swift
TabView {
    Tab("Today", systemImage: "checkmark.circle") { TodayTab() }
    Tab("Scan", systemImage: "barcode.viewfinder") { ScannerView(onScan: { barcode in ... }) }
    Tab("Food", systemImage: "fork.knife") { FoodLogView() }
    Tab("Health", systemImage: "heart.text.square") { HealthDashboardView() }
    Tab("More", systemImage: "ellipsis.circle") { MoreTab() }
}
```

Handle navigation from ScannerView → ProductView using a NavigationStack or sheet.

**Step 2: Add streak display to MoreTab**

Add StreakBanner at top of MoreTab, milestones below sync status.

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: update tab navigation with scan, food log, health dashboard"
```

---

## Task 10: Platform Nutrition Sync

**Files:**
- Modify: `Services/SyncEngine.swift`
- Modify: `Services/APIClient.swift`

**Step 1: Add nutrition sync to SyncEngine**

When a food is logged, sync to platform via `POST /api/ingest/cronometer` (reuse existing endpoint for nutrition data). Fire-and-forget with offline queue fallback.

Add a `syncScannedProduct(product:servingGrams:)` function to SyncEngine that builds a payload matching the Cronometer format the API already accepts.

**Step 2: Commit**

```bash
git add -A && git commit -m "feat: add nutrition sync to platform on food log"
```

---

## Execution Order

Tasks 1-2 are foundational (models + services). Tasks 3-5 are the food/scanning UI. Task 6 is HealthKit expansion. Tasks 7-8 are dashboard + streaks. Task 9 ties navigation together. Task 10 adds sync.

Tasks 1-2 can run in parallel. Tasks 3-5 depend on 1-2. Task 6 is independent. Task 7 depends on 6. Task 8 is independent. Task 9 depends on 3-8. Task 10 depends on 1-2.

**Parallelizable groups:**
- Group A: Tasks 1+2 (models + services)
- Group B: Task 6 (HealthKit expansion) — independent
- Group C: Task 8 (streaks) — independent
- Sequential: 3→4→5 (scanner flow, depends on Group A)
- Sequential: 7 (dashboard, depends on Group B)
- Final: 9→10 (navigation + sync, depends on everything)
