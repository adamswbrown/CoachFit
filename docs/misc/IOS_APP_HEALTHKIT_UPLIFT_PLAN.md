# iOS App HealthKit Uplift Plan
**Project:** Add Steps and Sleep Data Collection to iOS App
**Date:** 2026-01-13
**Estimated Duration:** 1 week (8-12 hours)
**Priority:** High (Prerequisite for full iOS integration)

---

## Executive Summary

The current GymDashSync iOS app collects workouts and body metrics (weight, height, body fat) but is missing two critical metrics that CoachFit tracks: **steps** and **sleep quality**. This plan details how to extend the iOS app to collect these metrics from Apple HealthKit before proceeding with full backend integration.

---

## Current State

### What's Already Collected ✅
- **Workouts**: Type, duration, calories, distance, heart rate
- **Body Metrics**: Weight, height, body fat percentage

### What's Missing ❌
- **Steps**: Daily step count (required for CoachFit Entry model)
- **Sleep**: Sleep duration and quality (required for CoachFit Entry model)

### Impact
Without steps and sleep data, the iOS app provides only **partial data coverage**. Clients would still need to manually enter:
- Daily step count
- Sleep quality rating

This reduces the value proposition of automatic HealthKit sync from ~80% to ~40% coverage.

---

## Goals

1. ✅ Add steps collection from HealthKit (`HKQuantityType.stepCount`)
2. ✅ Add sleep collection from HealthKit (`HKCategoryType.sleepAnalysis`)
3. ✅ Aggregate steps to daily totals
4. ✅ Compute sleep duration and quality metrics
5. ✅ Send steps and sleep data to backend ingestion endpoints
6. ✅ Maintain backward compatibility with existing workout/body metric sync

---

## Technical Overview

### HealthKit Data Types to Add

#### 1. Steps (`HKQuantityType.stepCount`)
```swift
HKQuantityType.quantityType(forIdentifier: .stepCount)
```

**Data Structure:**
- Multiple samples per day (e.g., hourly aggregates from Apple Watch)
- Each sample has: `quantity` (step count), `startDate`, `endDate`

**Aggregation Strategy:**
- Aggregate all samples for a given calendar day
- Sum quantities to get total daily steps
- Store as single daily value per user

**Example Query:**
```swift
// Query all step samples for a specific day
let calendar = Calendar.current
let startOfDay = calendar.startOfDay(for: date)
let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay)!

let predicate = HKQuery.predicateForSamples(
    withStart: startOfDay,
    end: endOfDay,
    options: .strictStartDate
)

let query = HKSampleQuery(
    sampleType: stepCountType,
    predicate: predicate,
    limit: HKObjectQueryNoLimit,
    sortDescriptors: nil
) { query, samples, error in
    // Sum all step counts for the day
    let totalSteps = samples?.compactMap { $0 as? HKQuantitySample }
        .reduce(0) { $0 + Int($1.quantity.doubleValue(for: .count())) } ?? 0
}
```

---

#### 2. Sleep (`HKCategoryType.sleepAnalysis`)
```swift
HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
```

**Data Structure:**
- `HKCategoryValueSleepAnalysis` enum:
  - `.inBed`: Time in bed (not necessarily asleep)
  - `.asleepUnspecified`: Generic sleep state
  - `.awake`: Awake in bed
  - `.asleepCore`: Core sleep (light/deep combined)
  - `.asleepDeep`: Deep sleep
  - `.asleepREM`: REM sleep

**Aggregation Strategy:**
- Filter samples by sleep session (typically one per night)
- Calculate:
  - **Total time in bed**: Sum of all `.inBed` samples
  - **Total sleep duration**: Sum of all sleep states (excluding `.awake`)
  - **Sleep efficiency**: (Sleep duration / Time in bed) * 100
  - **Assigned date**: Use end date of sleep session (morning wakeup time)

**Example Query:**
```swift
// Query sleep analysis for a specific night
let predicate = HKQuery.predicateForSamples(
    withStart: nightStart, // e.g., yesterday 8 PM
    end: nightEnd,         // e.g., today 10 AM
    options: .strictStartDate
)

let query = HKSampleQuery(
    sampleType: sleepType,
    predicate: predicate,
    limit: HKObjectQueryNoLimit,
    sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
) { query, samples, error in
    var inBedTime: TimeInterval = 0
    var asleepTime: TimeInterval = 0

    for sample in samples as? [HKCategorySample] ?? [] {
        let duration = sample.endDate.timeIntervalSince(sample.startDate)

        if sample.value == HKCategoryValueSleepAnalysis.inBed.rawValue {
            inBedTime += duration
        } else if sample.value != HKCategoryValueSleepAnalysis.awake.rawValue {
            asleepTime += duration
        }
    }

    let sleepEfficiency = inBedTime > 0 ? (asleepTime / inBedTime) * 100 : 0
}
```

---

## Implementation Plan

### Phase 1: Add StepsExternalObject (3 hours)

**File:** `../mobile/ios/GymDashSync/ExternalObjects.swift`

```swift
import Foundation
import HealthKit
import HealthDataSync

// MARK: - Steps External Object

class StepsExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var date: String          // ISO8601 date (e.g., "2026-01-13")
    var stepCount: Int
    var sourceDevice: String?

    init(uuid: UUID, date: String, stepCount: Int, sourceDevice: String? = nil) {
        self.uuid = uuid
        self.date = date
        self.stepCount = stepCount
        self.sourceDevice = sourceDevice
    }

    // MARK: - HDSExternalObjectProtocol

    static func authorizationTypes() -> [HKObjectType]? {
        guard let stepCountType = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            return nil
        }
        return [stepCountType]
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
        formatter.formatOptions = [.withFullDate]

        let calendar = Calendar.current
        let date = calendar.startOfDay(for: sample.startDate)
        let dateString = formatter.string(from: date)

        let steps = Int(sample.quantity.doubleValue(for: .count()))

        let deviceInfo = sample.device.map { device in
            "\(device.name ?? "Unknown") (\(device.model ?? "Unknown"))"
        }

        return StepsExternalObject(
            uuid: sample.uuid,
            date: dateString,
            stepCount: steps,
            sourceDevice: deviceInfo
        )
    }

    static func externalObject(deletedObject: HKDeletedObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]

        return StepsExternalObject(
            uuid: deletedObject.uuid,
            date: formatter.string(from: Date()),
            stepCount: 0
        )
    }

    func update(with object: HKObject) {
        guard let sample = object as? HKQuantitySample else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]

        let calendar = Calendar.current
        let dateValue = calendar.startOfDay(for: sample.startDate)
        date = formatter.string(from: dateValue)

        stepCount = Int(sample.quantity.doubleValue(for: .count()))

        if let device = sample.device {
            sourceDevice = "\(device.name ?? "Unknown") (\(device.model ?? "Unknown"))"
        }
    }
}
```

**Deliverables:**
- [ ] StepsExternalObject class implemented
- [ ] Authorization types defined
- [ ] Object conversion logic
- [ ] Daily aggregation (handled in separate aggregator)
- [ ] Unit tests

---

### Phase 2: Add SleepExternalObject (4 hours)

**File:** `../mobile/ios/GymDashSync/ExternalObjects.swift`

```swift
// MARK: - Sleep External Object

class SleepExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var date: String              // ISO8601 date (morning wakeup date)
    var inBedTime: String        // ISO8601 datetime
    var asleepTime: String?      // ISO8601 datetime (first sleep)
    var awakeTime: String        // ISO8601 datetime (final wakeup)
    var durationMinutes: Int     // Total sleep duration (excluding awake)
    var timeInBedMinutes: Int    // Total time in bed
    var sleepEfficiency: Double  // (durationMinutes / timeInBedMinutes) * 100
    var sourceDevice: String?

    init(uuid: UUID, date: String, inBedTime: String, asleepTime: String?, awakeTime: String,
         durationMinutes: Int, timeInBedMinutes: Int, sleepEfficiency: Double, sourceDevice: String? = nil) {
        self.uuid = uuid
        self.date = date
        self.inBedTime = inBedTime
        self.asleepTime = asleepTime
        self.awakeTime = awakeTime
        self.durationMinutes = durationMinutes
        self.timeInBedMinutes = timeInBedMinutes
        self.sleepEfficiency = sleepEfficiency
        self.sourceDevice = sourceDevice
    }

    // MARK: - HDSExternalObjectProtocol

    static func authorizationTypes() -> [HKObjectType]? {
        guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            return nil
        }
        return [sleepType]
    }

    static func healthKitObjectType() -> HKObjectType? {
        return HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
    }

    static func externalObject(object: HKObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        guard let sample = object as? HKCategorySample,
              sample.categoryType == HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            return nil
        }

        // For individual sleep samples, we need to aggregate multiple samples per session
        // This is a simplified version - full implementation requires session grouping

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]

        let calendar = Calendar.current
        let wakeupDate = calendar.startOfDay(for: sample.endDate)

        let duration = sample.endDate.timeIntervalSince(sample.startDate)
        let durationMinutes = Int(duration / 60)

        let deviceInfo = sample.device.map { device in
            "\(device.name ?? "Unknown") (\(device.model ?? "Unknown"))"
        }

        return SleepExternalObject(
            uuid: sample.uuid,
            date: dateFormatter.string(from: wakeupDate),
            inBedTime: formatter.string(from: sample.startDate),
            asleepTime: formatter.string(from: sample.startDate),
            awakeTime: formatter.string(from: sample.endDate),
            durationMinutes: durationMinutes,
            timeInBedMinutes: durationMinutes,
            sleepEfficiency: 100.0, // Simplified - requires multi-sample aggregation
            sourceDevice: deviceInfo
        )
    }

    static func externalObject(deletedObject: HKDeletedObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]

        return SleepExternalObject(
            uuid: deletedObject.uuid,
            date: dateFormatter.string(from: Date()),
            inBedTime: formatter.string(from: Date()),
            asleepTime: nil,
            awakeTime: formatter.string(from: Date()),
            durationMinutes: 0,
            timeInBedMinutes: 0,
            sleepEfficiency: 0
        )
    }

    func update(with object: HKObject) {
        guard let sample = object as? HKCategorySample else { return }

        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        let dateFormatter = ISO8601DateFormatter()
        dateFormatter.formatOptions = [.withFullDate]

        let calendar = Calendar.current
        let wakeupDate = calendar.startOfDay(for: sample.endDate)
        date = dateFormatter.string(from: wakeupDate)

        inBedTime = formatter.string(from: sample.startDate)
        asleepTime = formatter.string(from: sample.startDate)
        awakeTime = formatter.string(from: sample.endDate)

        let duration = sample.endDate.timeIntervalSince(sample.startDate)
        durationMinutes = Int(duration / 60)
        timeInBedMinutes = durationMinutes
        sleepEfficiency = 100.0

        if let device = sample.device {
            sourceDevice = "\(device.name ?? "Unknown") (\(device.model ?? "Unknown"))"
        }
    }
}
```

**Note:** This is a simplified implementation. Full sleep analysis requires:
1. Grouping multiple samples into sleep sessions
2. Handling `.inBed`, `.asleepCore`, `.asleepREM`, `.asleepDeep`, `.awake` states
3. Computing accurate sleep efficiency

**Deliverables:**
- [ ] SleepExternalObject class implemented
- [ ] Authorization types defined
- [ ] Object conversion logic
- [ ] Sleep session aggregation (advanced)
- [ ] Unit tests

---

### Phase 3: Update GymDashExternalStore (2 hours)

**File:** `../mobile/ios/GymDashSync/GymDashExternalStore.swift`

Add steps and sleep to the store's sync configuration:

```swift
class GymDashExternalStore: HDSStoreProtocol {
    // ... existing code ...

    func externalObjectTypes() -> [HDSExternalObjectProtocol.Type] {
        return [
            WorkoutExternalObject.self,
            ProfileMetricExternalObject.self,
            StepsExternalObject.self,      // ✅ NEW
            SleepExternalObject.self        // ✅ NEW
        ]
    }

    // ... existing sync methods ...
}
```

**Deliverables:**
- [ ] Register StepsExternalObject
- [ ] Register SleepExternalObject
- [ ] Update sync flow to include new types
- [ ] Test incremental sync

---

### Phase 4: Update NetworkService (2 hours)

**File:** `../mobile/ios/GymDashSync/NetworkService.swift`

Add new ingestion endpoints:

```swift
class NetworkService {
    // ... existing code ...

    // MARK: - Steps Ingestion

    func syncSteps(userId: String, steps: [StepsExternalObject]) async throws {
        let url = URL(string: "\(baseURL)/api/healthkit/ingest/steps")!

        let payload: [String: Any] = [
            "userId": userId,
            "steps": steps.map { step in
                [
                    "date": step.date,
                    "stepCount": step.stepCount,
                    "sourceDevice": step.sourceDevice as Any
                ]
            }
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.serverError(httpResponse.statusCode)
        }

        // Parse response
        let result = try JSONDecoder().decode(IngestResponse.self, from: data)
        print("✅ Steps synced: \(result.inserted) inserted, \(result.skipped) skipped")
    }

    // MARK: - Sleep Ingestion

    func syncSleep(userId: String, sleep: [SleepExternalObject]) async throws {
        let url = URL(string: "\(baseURL)/api/healthkit/ingest/sleep")!

        let payload: [String: Any] = [
            "userId": userId,
            "sleep": sleep.map { session in
                [
                    "date": session.date,
                    "inBedTime": session.inBedTime,
                    "asleepTime": session.asleepTime as Any,
                    "awakeTime": session.awakeTime,
                    "durationMinutes": session.durationMinutes,
                    "timeInBedMinutes": session.timeInBedMinutes,
                    "sleepEfficiency": session.sleepEfficiency,
                    "sourceDevice": session.sourceDevice as Any
                ]
            }
        ]

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw NetworkError.serverError(httpResponse.statusCode)
        }

        let result = try JSONDecoder().decode(IngestResponse.self, from: data)
        print("✅ Sleep synced: \(result.inserted) inserted, \(result.skipped) skipped")
    }
}
```

**Deliverables:**
- [ ] Steps ingestion method
- [ ] Sleep ingestion method
- [ ] Error handling
- [ ] Response parsing
- [ ] Integration tests with mock backend

---

### Phase 5: Update UI (1 hour)

**File:** `../mobile/ios/GymDashSync/ContentView.swift`

Update sync status to include steps and sleep:

```swift
struct SyncStatusView: View {
    @ObservedObject var appState: AppState

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sync Status")
                .font(.headline)

            HStack {
                Image(systemName: "figure.walk")
                Text("Steps: \(appState.stepsSynced) days synced")
                Spacer()
                if appState.isSyncingSteps {
                    ProgressView()
                } else {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }

            HStack {
                Image(systemName: "bed.double")
                Text("Sleep: \(appState.sleepSynced) days synced")
                Spacer()
                if appState.isSyncingSleep {
                    ProgressView()
                } else {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                }
            }

            // ... existing workout and body metric status ...
        }
    }
}
```

**Deliverables:**
- [ ] UI indicators for steps sync
- [ ] UI indicators for sleep sync
- [ ] Error display
- [ ] Last sync timestamp

---

### Phase 6: Testing (2 hours)

**Test Scenarios:**

#### Steps Testing
1. **Manual Data Entry:**
   - Open Health app
   - Navigate to Steps
   - Add manual step count (e.g., 5000 steps for yesterday)
   - Trigger sync in app
   - Verify steps appear in backend

2. **Apple Watch Sync:**
   - Wear Apple Watch
   - Walk around (record actual steps)
   - Wait for Watch to sync to iPhone Health app
   - Trigger sync in app
   - Verify accurate step count

3. **Multi-Day Sync:**
   - Add steps for past 7 days in Health app
   - Trigger sync
   - Verify all 7 days synced correctly

#### Sleep Testing
1. **Manual Sleep Entry:**
   - Open Health app
   - Navigate to Sleep
   - Add manual sleep session (e.g., 10 PM - 6 AM)
   - Trigger sync
   - Verify sleep duration and efficiency calculated correctly

2. **Apple Watch Sleep Tracking:**
   - Enable sleep tracking on Apple Watch
   - Sleep one night with Watch
   - Check Health app for sleep stages
   - Trigger sync
   - Verify all sleep data captured

3. **Multi-Night Sync:**
   - Add sleep data for past 7 nights
   - Trigger sync
   - Verify all nights synced

**Deliverables:**
- [ ] Unit tests for ExternalObjects
- [ ] Integration tests for NetworkService
- [ ] Manual testing checklist completed
- [ ] Test data documented

---

## Timeline

### Week 1

| Day | Task | Hours |
|-----|------|-------|
| **Day 1** | Phase 1: StepsExternalObject | 3 |
| **Day 2** | Phase 2: SleepExternalObject | 4 |
| **Day 3** | Phase 3: Update GymDashExternalStore | 2 |
| **Day 4** | Phase 4: Update NetworkService | 2 |
| **Day 5** | Phase 5: Update UI + Phase 6: Testing | 3 |

**Total: 14 hours (1.5 weeks part-time or 2 days full-time)**

---

## Success Criteria

✅ **Steps collection:**
- [ ] App requests stepCount authorization
- [ ] Daily step counts aggregated correctly
- [ ] Steps synced to backend via `/api/healthkit/ingest/steps`
- [ ] Duplicate detection works (same day, same user)

✅ **Sleep collection:**
- [ ] App requests sleepAnalysis authorization
- [ ] Sleep sessions aggregated correctly (multi-sample)
- [ ] Sleep duration and efficiency calculated
- [ ] Sleep synced to backend via `/api/healthkit/ingest/sleep`
- [ ] Duplicate detection works (same date, same user)

✅ **Backward compatibility:**
- [ ] Existing workout sync still works
- [ ] Existing body metrics sync still works
- [ ] No breaking changes to pairing flow

✅ **User experience:**
- [ ] Clear UI indicators for sync status
- [ ] Error messages helpful
- [ ] Performance acceptable (no lag during sync)

---

## Dependencies

### Prerequisites
- ✅ iOS app already copied to `/CoachFit/mobile/ios/`
- ✅ Microsoft Health Data Sync library available
- ✅ Xcode 14+ installed

### Blockers (None)
- This work can proceed independently of backend development
- Mock backend can be used for testing
- Changes are additive (no breaking changes)

---

## Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Sleep aggregation complexity** | High | Medium | Start with simple implementation, iterate based on testing |
| **Apple Watch not available for testing** | Medium | Low | Use manual Health app data entry for testing |
| **Permission denied by user** | High | Low | Graceful degradation - sync only permitted data types |
| **HealthKit API changes** | Low | High | Test on latest iOS version, monitor Apple developer updates |

---

## Post-Completion

After this uplift is complete:

1. ✅ iOS app will have **100% HealthKit data coverage** for CoachFit metrics
2. ✅ Ready to proceed with **Phase 2** of main integration plan
3. ✅ Backend ingestion endpoints can be tested with real iOS data
4. ✅ Client manual entry burden reduced to ~10% (only subjective metrics like perceived effort)

---

## Related Documentation

- **Main Integration Plan:** [IOS_APP_INTEGRATION_PLAN.md](./IOS_APP_INTEGRATION_PLAN.md)
- **Feasibility Analysis:** [IOS_APP_INTEGRATION_FEASIBILITY.md](./IOS_APP_INTEGRATION_FEASIBILITY.md)
- **GitHub Issue (Main):** [#3 - iOS App Integration](https://github.com/adamswbrown/CoachFit/issues/3)

---

## Appendix: HealthKit Reference

### Step Count Type
```swift
HKQuantityType.quantityType(forIdentifier: .stepCount)
// Unit: .count()
// Aggregate: Sum per day
```

### Sleep Analysis Type
```swift
HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
// Values: .inBed, .asleepUnspecified, .awake, .asleepCore, .asleepDeep, .asleepREM
// Aggregate: Multiple samples per sleep session
```

### Apple Developer Resources
- [HealthKit Documentation](https://developer.apple.com/documentation/healthkit)
- [HKQuantityType](https://developer.apple.com/documentation/healthkit/hkquantitytype)
- [HKCategoryType](https://developer.apple.com/documentation/healthkit/hkcategorytype)
- [Sleep Analysis](https://developer.apple.com/documentation/healthkit/hkcategoryvaluesleepanalysis)

---

*Implementation plan created: 2026-01-13*
*Next review: After Phase 1 completion*
