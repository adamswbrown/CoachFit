# iOS App Integration Plan
**Project:** CoachFit HealthKit Integration
**Date:** 2026-01-13
**Estimated Duration:** 5 weeks (part-time) or 2.5 weeks (full-time)
**Total Effort:** ~100 hours

---

## Project Overview

Integrate automatic health data collection from iOS devices using Apple HealthKit, reducing manual entry burden for clients while maintaining flexibility for subjective feedback.

### Goals
1. Enable automatic syncing of weight, height, and workout data from iOS devices
2. Maintain manual entry option for subjective metrics (sleep quality, perceived effort, notes)
3. Provide unified coach dashboard showing both automatic and manual data
4. Improve client compliance and data accuracy

### Non-Goals (Future Phases)
- Android support (Google Fit integration)
- Advanced workout analytics
- Real-time sync notifications
- Third-party integrations (Strava, MyFitnessPal)

---

## Architecture Overview

### Current State (CoachFit)
```
Web Browser → Next.js → NextAuth → API Routes → Prisma → PostgreSQL
                                         ↓
                                    Entry (manual data)
```

### Target State (With iOS Integration)
```
iOS App → HealthKit → HTTP → CoachFit API → Prisma → PostgreSQL
                                                 ↓
                                    HealthKitWorkout
                                    HealthKitBodyMetric
                                    HealthKitSteps
                                    HealthKitSleep
                                                 ↓
                               Daily Aggregation Job
                                                 ↓
                                    Entry (merged data)

Web Browser → Next.js → Manual Entry Form → Entry (manual data)
```

---

## Phase Breakdown

## Phase 1: Database Schema & Backend API (Week 1-2)
**Duration:** 22 hours
**Status:** 🟡 Not Started

### 1.1 Prisma Schema Updates (4 hours)

#### New Models

```prisma
// Device pairing for iOS app authentication
model DevicePairing {
  id          String    @id @default(uuid())
  userId      String
  pairingCode String    @unique // 6-char code like "ABC123"
  deviceId    String?   // iOS device identifier
  deviceName  String?   // User-friendly device name
  paired      Boolean   @default(false)
  createdAt   DateTime  @default(now())
  pairedAt    DateTime?
  lastSyncAt  DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([pairingCode])
}

// Raw HealthKit workout data
model HealthKitWorkout {
  id              String   @id @default(uuid())
  userId          String
  workoutType     String   // "running", "cycling", "strength_training", etc.
  startTime       DateTime
  endTime         DateTime
  durationSeconds Int
  caloriesActive  Int?
  distanceMeters  Float?
  avgHeartRate    Int?
  sourceDevice    String?
  syncedAt        DateTime @default(now())
  aggregated      Boolean  @default(false) // Has this been aggregated to Entry?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, startTime]) // Prevent duplicates
  @@index([userId, startTime])
  @@index([aggregated])
}

// Raw HealthKit body metrics
model HealthKitBodyMetric {
  id         String   @id @default(uuid())
  userId     String
  metric     String   // "weight" | "height" | "body_fat"
  value      Float
  unit       String   // "lbs" | "inches" | "percent"
  measuredAt DateTime
  syncedAt   DateTime @default(now())
  aggregated Boolean  @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, measuredAt])
  @@index([aggregated])
}

// Daily step counts from HealthKit
model HealthKitSteps {
  id         String   @id @default(uuid())
  userId     String
  date       DateTime @db.Date
  stepCount  Int
  syncedAt   DateTime @default(now())
  aggregated Boolean  @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([aggregated])
}

// Sleep data from HealthKit
model HealthKitSleep {
  id              String   @id @default(uuid())
  userId          String
  date            DateTime @db.Date // Date the sleep belongs to (end date)
  inBedTime       DateTime
  asleepTime      DateTime
  awakeTime       DateTime
  durationMinutes Int
  syncedAt        DateTime @default(now())
  aggregated      Boolean  @default(false)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([aggregated])
}

// Update User model - add relations
model User {
  // ... existing fields ...
  DevicePairing       DevicePairing[]
  HealthKitWorkout    HealthKitWorkout[]
  HealthKitBodyMetric HealthKitBodyMetric[]
  HealthKitSteps      HealthKitSteps[]
  HealthKitSleep      HealthKitSleep[]
}

// Update Entry model - add source tracking
model Entry {
  // ... existing fields ...

  // Data source tracking (JSONB)
  dataSources Json? // { "weight": "healthkit", "steps": "manual", "calories": "healthkit" }
}
```

#### Migration Commands
```bash
npx prisma migrate dev --name add-healthkit-models
npx prisma generate
```

**Deliverables:**
- [ ] Prisma schema updated
- [ ] Migration created and tested
- [ ] Prisma client regenerated

---

### 1.2 API Route: Device Pairing (4 hours)

**File:** `app/api/healthkit/pair/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

// POST /api/healthkit/pair
// Body: { pairingCode: string, deviceId: string, deviceName: string }
// Returns: { success: boolean, userId: string, clientId: string }

const pairSchema = z.object({
  pairingCode: z.string().length(6),
  deviceId: z.string(),
  deviceName: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { pairingCode, deviceId, deviceName } = pairSchema.parse(body)

    // Find unpaired device pairing
    const pairing = await db.devicePairing.findUnique({
      where: { pairingCode: pairingCode.toUpperCase() },
      include: { user: { select: { id: true, email: true, name: true } } },
    })

    if (!pairing) {
      return NextResponse.json(
        { error: "Invalid pairing code" },
        { status: 404 }
      )
    }

    if (pairing.paired) {
      return NextResponse.json(
        { error: "Pairing code already used" },
        { status: 409 }
      )
    }

    // Mark as paired
    await db.devicePairing.update({
      where: { id: pairing.id },
      data: {
        paired: true,
        deviceId,
        deviceName: deviceName || "iOS Device",
        pairedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      userId: pairing.userId,
      clientId: pairing.userId, // For compatibility with GymDashSync
      clientName: pairing.user.name || pairing.user.email,
    })
  } catch (error) {
    console.error("Pairing error:", error)
    return NextResponse.json(
      { error: "Pairing failed" },
      { status: 500 }
    )
  }
}
```

**Deliverables:**
- [ ] Pairing endpoint implemented
- [ ] Validation with Zod
- [ ] Error handling
- [ ] Tested with curl/Postman

---

### 1.3 API Route: Workout Ingestion (6 hours)

**File:** `app/api/healthkit/ingest/workouts/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

const workoutSchema = z.object({
  userId: z.string().uuid(),
  workouts: z.array(
    z.object({
      workoutType: z.string(),
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      durationSeconds: z.number().int().positive(),
      caloriesActive: z.number().int().optional(),
      distanceMeters: z.number().optional(),
      avgHeartRate: z.number().int().optional(),
      sourceDevice: z.string().optional(),
    })
  ),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, workouts } = workoutSchema.parse(body)

    // Verify device is paired
    const pairing = await db.devicePairing.findFirst({
      where: { userId, paired: true },
    })

    if (!pairing) {
      return NextResponse.json(
        { error: "Device not paired" },
        { status: 403 }
      )
    }

    let inserted = 0
    let skipped = 0

    for (const workout of workouts) {
      try {
        await db.healthKitWorkout.create({
          data: {
            userId,
            workoutType: workout.workoutType,
            startTime: new Date(workout.startTime),
            endTime: new Date(workout.endTime),
            durationSeconds: workout.durationSeconds,
            caloriesActive: workout.caloriesActive,
            distanceMeters: workout.distanceMeters,
            avgHeartRate: workout.avgHeartRate,
            sourceDevice: workout.sourceDevice,
          },
        })
        inserted++
      } catch (error: any) {
        // Duplicate entry (unique constraint)
        if (error.code === "P2002") {
          skipped++
        } else {
          throw error
        }
      }
    }

    // Update last sync time
    await db.devicePairing.updateMany({
      where: { userId, paired: true },
      data: { lastSyncAt: new Date() },
    })

    return NextResponse.json({
      success: true,
      inserted,
      skipped,
      total: workouts.length,
    })
  } catch (error) {
    console.error("Workout ingestion error:", error)
    return NextResponse.json(
      { error: "Ingestion failed" },
      { status: 500 }
    )
  }
}
```

**Similar implementations needed for:**
- `/api/healthkit/ingest/body-metrics`
- `/api/healthkit/ingest/steps`
- `/api/healthkit/ingest/sleep`

**Deliverables:**
- [ ] Workout ingestion endpoint
- [ ] Body metrics ingestion endpoint
- [ ] Steps ingestion endpoint
- [ ] Sleep ingestion endpoint
- [ ] Duplicate detection
- [ ] Validation
- [ ] Error handling
- [ ] Testing

---

### 1.4 API Route: Pairing Code Generation (4 hours)

**File:** `app/api/healthkit/generate-pairing-code/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { auth } from "@/lib/auth"

function generatePairingCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Exclude ambiguous chars
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    // Check if user already has an active pairing
    const existingPairing = await db.devicePairing.findFirst({
      where: {
        userId: session.user.id,
        paired: true,
      },
    })

    if (existingPairing) {
      return NextResponse.json(
        {
          error: "Device already paired",
          deviceName: existingPairing.deviceName,
          pairedAt: existingPairing.pairedAt,
        },
        { status: 409 }
      )
    }

    // Generate unique pairing code
    let pairingCode = generatePairingCode()
    let attempts = 0
    while (attempts < 10) {
      const existing = await db.devicePairing.findUnique({
        where: { pairingCode },
      })
      if (!existing) break
      pairingCode = generatePairingCode()
      attempts++
    }

    // Create pairing record
    const pairing = await db.devicePairing.create({
      data: {
        userId: session.user.id,
        pairingCode,
      },
    })

    return NextResponse.json({
      success: true,
      pairingCode: pairing.pairingCode,
      expiresIn: 3600, // 1 hour (informational only)
    })
  } catch (error) {
    console.error("Pairing code generation error:", error)
    return NextResponse.json(
      { error: "Failed to generate pairing code" },
      { status: 500 }
    )
  }
}
```

**Deliverables:**
- [ ] Pairing code generation endpoint
- [ ] Collision detection
- [ ] Duplicate pairing prevention
- [ ] Authentication check
- [ ] Testing

---

### 1.5 Testing Backend API (4 hours)

**Test Script:** `scripts/test-healthkit-api.ts`

```typescript
// Test pairing
const pairingResponse = await fetch("http://localhost:3000/api/healthkit/pair", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    pairingCode: "ABC123",
    deviceId: "test-device-123",
    deviceName: "Test iPhone",
  }),
})

// Test workout ingestion
const workoutResponse = await fetch("http://localhost:3000/api/healthkit/ingest/workouts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "user-uuid",
    workouts: [
      {
        workoutType: "running",
        startTime: "2026-01-13T08:00:00Z",
        endTime: "2026-01-13T08:30:00Z",
        durationSeconds: 1800,
        caloriesActive: 250,
        distanceMeters: 5000,
        avgHeartRate: 145,
      },
    ],
  }),
})
```

**Deliverables:**
- [ ] Test script for all endpoints
- [ ] Validation test cases
- [ ] Error handling test cases
- [ ] Duplicate detection tests
- [ ] Documentation of test results

---

## Phase 2: iOS App Modifications (Week 2-3)
**Duration:** 24 hours
**Status:** 🟡 Not Started

### 2.1 Fork and Setup (2 hours)

**Tasks:**
1. Copy GymDashSync iOS app to `/mobile/ios/`
2. Rename project: GymDashSync → CoachFitSync
3. Update bundle identifier: `com.coachfit.sync`
4. Update Xcode project settings
5. Update Info.plist with HealthKit permissions

**Deliverables:**
- [ ] iOS app copied to CoachFit repo
- [ ] Project renamed
- [ ] Bundle identifier updated
- [ ] Builds successfully in Xcode

---

### 2.2 Update NetworkService (4 hours)

**File:** `mobile/ios/Sources/NetworkService.swift`

```swift
class NetworkService {
    static let shared = NetworkService()

    // Update base URL to CoachFit API
    #if DEBUG
    private let baseURL = "http://localhost:3000" // Local dev
    #else
    private let baseURL = "https://coach-fit-38pw.vercel.app" // Production
    #endif

    // Update endpoint paths
    func pair(code: String, deviceId: String) async throws -> PairingResponse {
        let url = URL(string: "\(baseURL)/api/healthkit/pair")!
        // ... implementation
    }

    func syncWorkouts(userId: String, workouts: [WorkoutExternalObject]) async throws {
        let url = URL(string: "\(baseURL)/api/healthkit/ingest/workouts")!
        // ... implementation
    }

    // Similar for body metrics, steps, sleep
}
```

**Deliverables:**
- [ ] NetworkService updated with new endpoints
- [ ] Environment-based URL switching
- [ ] Error handling updated
- [ ] Testing with local backend

---

### 2.3 Add Steps Collection (4 hours)

**File:** `mobile/ios/Sources/ExternalObjects.swift`

```swift
class StepsExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var date: String
    var stepCount: Int

    init(uuid: UUID, date: String, stepCount: Int) {
        self.uuid = uuid
        self.date = date
        self.stepCount = stepCount
    }

    static func authorizationTypes() -> [HKObjectType]? {
        return [HKQuantityType.quantityType(forIdentifier: .stepCount)!]
    }

    static func healthKitObjectType() -> HKObjectType? {
        return HKQuantityType.quantityType(forIdentifier: .stepCount)
    }

    static func externalObject(object: HKObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        guard let sample = object as? HKQuantitySample,
              sample.quantityType == HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            return nil
        }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        let date = formatter.string(from: sample.startDate)
        let steps = Int(sample.quantity.doubleValue(for: .count()))

        return StepsExternalObject(uuid: sample.uuid, date: date, stepCount: steps)
    }

    // ... other protocol methods
}
```

**Deliverables:**
- [ ] StepsExternalObject implemented
- [ ] HealthKit authorization updated
- [ ] Step counting aggregation (daily)
- [ ] Sync logic added to GymDashExternalStore
- [ ] Testing

---

### 2.4 Add Sleep Collection (4 hours)

**File:** `mobile/ios/Sources/ExternalObjects.swift`

```swift
class SleepExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var date: String // Date the sleep belongs to (end date)
    var inBedTime: String
    var asleepTime: String
    var awakeTime: String
    var durationMinutes: Int

    // ... implementation similar to steps

    static func authorizationTypes() -> [HKObjectType]? {
        return [HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!]
    }

    // ... parse HKCategoryValueSleepAnalysis
}
```

**Deliverables:**
- [ ] SleepExternalObject implemented
- [ ] Sleep analysis parsing
- [ ] Sync logic added
- [ ] Testing

---

### 2.5 Update GymDashExternalStore (6 hours)

**File:** `mobile/ios/Sources/GymDashExternalStore.swift`

Update to sync all data types:
- Workouts (existing)
- Body metrics (existing)
- Steps (new)
- Sleep (new)

Add batch syncing and error recovery.

**Deliverables:**
- [ ] Multi-type syncing implemented
- [ ] Batch operations
- [ ] Error recovery
- [ ] Sync status reporting
- [ ] Testing

---

### 2.6 iOS App Testing (4 hours)

**Test Checklist:**
- [ ] Pairing flow works end-to-end
- [ ] Workout sync successful
- [ ] Body metrics sync successful
- [ ] Steps sync successful
- [ ] Sleep sync successful
- [ ] Duplicate detection works
- [ ] Offline behavior correct
- [ ] Error messages clear
- [ ] Dev mode works
- [ ] Production URL works

---

## Phase 3: Web UI Integration (Week 3-4)
**Duration:** 18 hours
**Status:** 🟡 Not Started

### 3.1 Client Dashboard - Pairing Interface (6 hours)

**File:** `app/client-dashboard/page.tsx`

Add section for device pairing:

```tsx
<div className="bg-white rounded-lg p-6 border border-gray-200 mb-6">
  <h2 className="text-lg font-semibold mb-4">Device Sync</h2>

  {!devicePaired ? (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        Pair your iPhone to automatically sync weight, workouts, and more from Apple Health.
      </p>
      <button
        onClick={generatePairingCode}
        className="bg-blue-600 text-white px-4 py-2 rounded-md"
      >
        Generate Pairing Code
      </button>

      {pairingCode && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm font-medium text-blue-900 mb-2">
            Your Pairing Code:
          </p>
          <div className="text-3xl font-bold text-blue-600 mb-2">
            {pairingCode}
          </div>
          <p className="text-xs text-blue-700">
            Enter this code in the CoachFit Sync iOS app
          </p>
        </div>
      )}
    </div>
  ) : (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{deviceName}</p>
          <p className="text-sm text-gray-500">
            Last synced: {lastSyncTime}
          </p>
        </div>
        <button className="text-red-600 text-sm">Unpair Device</button>
      </div>
    </div>
  )}
</div>
```

**Deliverables:**
- [ ] Pairing code generation UI
- [ ] Device status display
- [ ] Unpair functionality
- [ ] Last sync time display
- [ ] Responsive design
- [ ] Testing

---

### 3.2 Entry Display - Data Source Indicators (4 hours)

**File:** `app/client-dashboard/page.tsx` and coach dashboard

Update entry display to show data sources:

```tsx
<div className="flex items-center gap-2">
  <span className="font-medium">Weight:</span>
  <span>{entry.weightLbs} lbs</span>
  {entry.dataSources?.weight === "healthkit" && (
    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
      HealthKit
    </span>
  )}
  {entry.dataSources?.weight === "manual" && (
    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
      Manual
    </span>
  )}
</div>
```

**Deliverables:**
- [ ] Data source badges implemented
- [ ] Tooltip with sync timestamp
- [ ] Visual distinction (HealthKit vs Manual)
- [ ] Coach dashboard updated
- [ ] Testing

---

### 3.3 HealthKit Data Explorer (4 hours)

**File:** `app/client-dashboard/healthkit/page.tsx`

New page to view raw HealthKit data:

```tsx
<div className="space-y-6">
  {/* Workout History */}
  <section>
    <h2 className="text-lg font-semibold mb-4">Workouts</h2>
    <div className="space-y-2">
      {workouts.map(workout => (
        <div key={workout.id} className="p-4 border rounded-lg">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">{workout.workoutType}</p>
              <p className="text-sm text-gray-500">
                {formatDuration(workout.durationSeconds)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm">{workout.caloriesActive} kcal</p>
              <p className="text-xs text-gray-500">
                {formatDate(workout.startTime)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>

  {/* Body Metrics History */}
  <section>
    <h2 className="text-lg font-semibold mb-4">Body Metrics</h2>
    {/* Chart or table of weight/height over time */}
  </section>
</div>
```

**Deliverables:**
- [ ] Workout history view
- [ ] Body metrics timeline
- [ ] Steps/sleep data view
- [ ] Filtering and search
- [ ] Export functionality
- [ ] Testing

---

### 3.4 Coach Dashboard Updates (4 hours)

**File:** `app/coach-dashboard/page.tsx`

Add indicators for HealthKit-synced clients:

```tsx
<div className="flex items-center gap-2">
  <span>{client.name}</span>
  {client.hasDevicePaired && (
    <svg className="w-4 h-4 text-blue-600" /* Apple Health icon */>
      <use href="#apple-health-icon" />
    </svg>
  )}
</div>
```

**Deliverables:**
- [ ] Device pairing indicators
- [ ] Filter: "Show only synced clients"
- [ ] Sync status column
- [ ] Workout summary cards
- [ ] Testing

---

## Phase 4: Daily Aggregation Job (Week 4-5)
**Duration:** 20 hours
**Status:** 🟡 Not Started

### 4.1 Aggregation Logic (10 hours)

**File:** `lib/healthkit-aggregation.ts`

```typescript
import { db } from "./db"

export async function aggregateHealthKitData() {
  console.log("Starting HealthKit data aggregation...")

  // Get all non-aggregated HealthKit data
  const workouts = await db.healthKitWorkout.findMany({
    where: { aggregated: false },
    orderBy: { startTime: "asc" },
  })

  const bodyMetrics = await db.healthKitBodyMetric.findMany({
    where: { aggregated: false },
    orderBy: { measuredAt: "asc" },
  })

  const steps = await db.healthKitSteps.findMany({
    where: { aggregated: false },
  })

  const sleep = await db.healthKitSleep.findMany({
    where: { aggregated: false },
  })

  // Group by user and date
  const aggregationMap = new Map<string, DailyAggregation>()

  // Aggregate workouts to daily calories
  for (const workout of workouts) {
    const date = workout.startTime.toISOString().split("T")[0]
    const key = `${workout.userId}:${date}`

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        userId: workout.userId,
        date: new Date(date),
        calories: 0,
        weight: null,
        height: null,
        steps: null,
        sleepQuality: null,
      })
    }

    const agg = aggregationMap.get(key)!
    agg.calories += workout.caloriesActive || 0
  }

  // Latest body metrics
  for (const metric of bodyMetrics) {
    const date = metric.measuredAt.toISOString().split("T")[0]
    const key = `${metric.userId}:${date}`

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        userId: metric.userId,
        date: new Date(date),
        calories: null,
        weight: null,
        height: null,
        steps: null,
        sleepQuality: null,
      })
    }

    const agg = aggregationMap.get(key)!
    if (metric.metric === "weight") {
      agg.weight = metric.value
    } else if (metric.metric === "height") {
      agg.height = metric.value
    }
  }

  // Steps
  for (const step of steps) {
    const date = step.date.toISOString().split("T")[0]
    const key = `${step.userId}:${date}`

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        userId: step.userId,
        date: step.date,
        calories: null,
        weight: null,
        height: null,
        steps: null,
        sleepQuality: null,
      })
    }

    const agg = aggregationMap.get(key)!
    agg.steps = step.stepCount
  }

  // Upsert to Entry table
  for (const [key, agg] of aggregationMap) {
    const existingEntry = await db.entry.findUnique({
      where: {
        userId_date: {
          userId: agg.userId,
          date: agg.date,
        },
      },
    })

    if (existingEntry) {
      // Merge with existing entry (HealthKit takes priority for objective metrics)
      await db.entry.update({
        where: { id: existingEntry.id },
        data: {
          weightLbs: agg.weight ?? existingEntry.weightLbs,
          heightInches: agg.height ?? existingEntry.heightInches,
          steps: agg.steps ?? existingEntry.steps,
          calories: agg.calories ?? existingEntry.calories,
          dataSources: {
            weight: agg.weight ? "healthkit" : existingEntry.dataSources?.weight || "manual",
            height: agg.height ? "healthkit" : existingEntry.dataSources?.height || "manual",
            steps: agg.steps ? "healthkit" : existingEntry.dataSources?.steps || "manual",
            calories: agg.calories ? "healthkit" : existingEntry.dataSources?.calories || "manual",
          },
        },
      })
    } else {
      // Create new entry
      await db.entry.create({
        data: {
          userId: agg.userId,
          date: agg.date,
          weightLbs: agg.weight,
          heightInches: agg.height,
          steps: agg.steps,
          calories: agg.calories,
          dataSources: {
            weight: agg.weight ? "healthkit" : null,
            height: agg.height ? "healthkit" : null,
            steps: agg.steps ? "healthkit" : null,
            calories: agg.calories ? "healthkit" : null,
          },
        },
      })
    }
  }

  // Mark all as aggregated
  await db.healthKitWorkout.updateMany({
    where: { aggregated: false },
    data: { aggregated: true },
  })

  await db.healthKitBodyMetric.updateMany({
    where: { aggregated: false },
    data: { aggregated: true },
  })

  await db.healthKitSteps.updateMany({
    where: { aggregated: false },
    data: { aggregated: true },
  })

  await db.healthKitSleep.updateMany({
    where: { aggregated: false },
    data: { aggregated: true },
  })

  console.log(`Aggregated ${aggregationMap.size} daily entries`)
}
```

**Deliverables:**
- [ ] Aggregation logic implemented
- [ ] Merge strategy (HealthKit priority for objective metrics)
- [ ] Conflict resolution
- [ ] Testing with sample data
- [ ] Performance optimization

---

### 4.2 Cron Job Setup (6 hours)

**Option A: Vercel Cron (Recommended for production)**

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/aggregate-healthkit",
      "schedule": "0 1 * * *"
    }
  ]
}
```

**File:** `app/api/cron/aggregate-healthkit/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server"
import { aggregateHealthKitData } from "@/lib/healthkit-aggregation"

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    await aggregateHealthKitData()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Aggregation failed:", error)
    return NextResponse.json({ error: "Aggregation failed" }, { status: 500 })
  }
}
```

**Option B: Local Development (node-cron)**

**File:** `scripts/start-cron.ts`

```typescript
import cron from "node-cron"
import { aggregateHealthKitData } from "../lib/healthkit-aggregation"

// Run daily at 1:00 AM
cron.schedule("0 1 * * *", async () => {
  console.log("Running scheduled HealthKit aggregation...")
  await aggregateHealthKitData()
})

console.log("Cron scheduler started")
```

**Deliverables:**
- [ ] Vercel cron configured
- [ ] Cron endpoint with auth
- [ ] Local development cron
- [ ] Error notifications (email/Slack)
- [ ] Monitoring and logging
- [ ] Testing

---

### 4.3 Testing Aggregation (4 hours)

**Test scenarios:**
1. First-time aggregation (no existing Entry)
2. Merge with existing manual Entry
3. HealthKit overrides manual for objective metrics
4. Manual data preserved for subjective metrics
5. Multiple workouts same day → summed calories
6. Multiple weight readings same day → latest used
7. Empty HealthKit data → no changes to Entry

**Deliverables:**
- [ ] Unit tests for aggregation logic
- [ ] Integration tests with sample data
- [ ] Edge case tests
- [ ] Performance tests (large datasets)
- [ ] Documentation

---

## Phase 5: Documentation & Deployment (Week 5)
**Duration:** 16 hours
**Status:** 🟡 Not Started

### 5.1 API Documentation (4 hours)

**File:** `docs/HEALTHKIT_API.md`

Document all HealthKit API endpoints:
- Request/response formats
- Authentication
- Error codes
- Rate limits
- Examples

**Deliverables:**
- [ ] API documentation complete
- [ ] OpenAPI/Swagger spec (optional)
- [ ] Example requests
- [ ] Error handling guide

---

### 5.2 User Guide (4 hours)

**File:** `docs/HEALTHKIT_USER_GUIDE.md`

Guide for clients and coaches:
- How to download CoachFit Sync iOS app
- How to pair device
- What data is synced
- Privacy and permissions
- Troubleshooting

**Deliverables:**
- [ ] User guide written
- [ ] Screenshots included
- [ ] FAQ section
- [ ] Video tutorial (optional)

---

### 5.3 App Store Submission (6 hours)

**Tasks:**
1. Create App Store Connect account
2. Generate app icons and screenshots
3. Write app description
4. Privacy policy updates
5. Submit for review
6. Address feedback (if any)

**Deliverables:**
- [ ] App Store listing created
- [ ] App submitted for review
- [ ] Privacy policy updated
- [ ] App approved and live

---

### 5.4 Privacy Policy Updates (2 hours)

**File:** `docs/PRIVACY_POLICY.md`

Update privacy policy to include:
- HealthKit data collection
- Data storage and retention
- Data sharing (none)
- User rights (deletion, export)
- Apple's HealthKit requirements

**Deliverables:**
- [ ] Privacy policy updated
- [ ] Legal review (if needed)
- [ ] Published on website
- [ ] Users notified of changes

---

## Testing Strategy

### Unit Tests
- [ ] Prisma models validation
- [ ] API route input validation
- [ ] Aggregation logic
- [ ] Data source priority rules

### Integration Tests
- [ ] End-to-end pairing flow
- [ ] Data ingestion → aggregation → display
- [ ] Conflict resolution
- [ ] Error recovery

### User Acceptance Testing (UAT)
- [ ] 5-10 beta testers (clients)
- [ ] 2-3 coaches
- [ ] Feedback collection
- [ ] Bug fixes

### Load Testing
- [ ] Simulate 100+ users syncing
- [ ] API rate limit testing
- [ ] Database performance
- [ ] Aggregation job performance

---

## Deployment Plan

### Development Environment
1. Local Next.js dev server
2. Local PostgreSQL database
3. Xcode Simulator for iOS testing
4. ngrok/localtunnel for device testing

### Staging Environment
1. Vercel preview deployment
2. Separate PostgreSQL database
3. TestFlight for iOS beta testing
4. Limited user access

### Production Rollout
1. **Phase 1:** Beta (5-10 users, 1 week)
2. **Phase 2:** Limited release (20-30 users, 2 weeks)
3. **Phase 3:** General availability (all users)
4. Monitor:
   - Error rates
   - Sync success rates
   - User adoption
   - Performance metrics

---

## Success Metrics

Track these KPIs post-launch:

### Adoption
- **Target:** 50% of iOS users pair device within 30 days
- **Measurement:** DevicePairing.paired count / total iOS users

### Data Quality
- **Target:** 80% of entries have HealthKit data
- **Measurement:** Entries with dataSources.weight = "healthkit"

### Compliance
- **Target:** 20% increase in daily check-in rate
- **Measurement:** Compare Entry count before/after launch

### Accuracy
- **Target:** <5% discrepancy between manual and HealthKit data
- **Measurement:** Compare overlapping manual/HealthKit entries

### Satisfaction
- **Target:** 4.0+ star rating on App Store
- **Target:** 80%+ positive feedback from beta testers
- **Measurement:** Surveys and App Store reviews

---

## Risk Mitigation

### Risk: Low Adoption
- **Mitigation:** Clear onboarding, in-app tutorials, coach encouragement

### Risk: Data Sync Issues
- **Mitigation:** Robust error handling, manual override option, support team

### Risk: Privacy Concerns
- **Mitigation:** Transparent privacy policy, opt-in flow, data export/deletion

### Risk: iOS App Maintenance
- **Mitigation:** Automated tests, staged rollouts, monitoring

### Risk: HealthKit API Changes
- **Mitigation:** Subscribe to Apple developer updates, buffer time for updates

---

## Team & Resources

### Required Skills
- **Backend:** TypeScript, Next.js, Prisma, PostgreSQL
- **iOS:** Swift, SwiftUI, HealthKit, Xcode
- **DevOps:** Vercel, cron jobs, monitoring
- **Design:** UI/UX for pairing flow, data visualization

### External Dependencies
- Microsoft Health Data Sync library (already in use)
- Apple HealthKit framework
- Vercel cron (or alternative)
- App Store account ($99/year)

---

## Timeline Summary

| Phase | Duration | Status |
|-------|----------|--------|
| Phase 1: Backend API | 22 hours (Week 1-2) | 🟡 Not Started |
| Phase 2: iOS App | 24 hours (Week 2-3) | 🟡 Not Started |
| Phase 3: Web UI | 18 hours (Week 3-4) | 🟡 Not Started |
| Phase 4: Aggregation | 20 hours (Week 4-5) | 🟡 Not Started |
| Phase 5: Docs & Deploy | 16 hours (Week 5) | 🟡 Not Started |
| **Total** | **100 hours** | **🟡 Not Started** |

**Part-time (20 hours/week):** 5 weeks
**Full-time (40 hours/week):** 2.5 weeks

---

## Next Steps

1. **Review this plan** with stakeholders (Gav, co-founder)
2. **Get approval** for 100-hour investment
3. **Assign developer(s)** or allocate time
4. **Set up development environment**
   - Local PostgreSQL
   - Xcode
   - iOS device for testing
5. **Kickoff Phase 1** (Backend API)

---

## Appendix

### Related Documents
- [IOS_APP_INTEGRATION_FEASIBILITY.md](./IOS_APP_INTEGRATION_FEASIBILITY.md) - Full feasibility analysis
- [sundayemail.md](./sundayemail.md) - Weekly check-in feature (potential integration)
- [TEST_DATA_DOCUMENTATION.md](./TEST_DATA_DOCUMENTATION.md) - Test data for development

### Useful Links
- [Microsoft Health Data Sync](https://github.com/microsoft/health-data-sync)
- [Apple HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Prisma Documentation](https://www.prisma.io/docs)

---

*Integration plan created: 2026-01-13*
*Next review: After Phase 1 completion*
