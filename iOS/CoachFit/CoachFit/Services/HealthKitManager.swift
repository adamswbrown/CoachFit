import HealthKit

@Observable
final class HealthKitManager {
    private let store = HKHealthStore()

    private(set) var isAuthorized = false

    // Types we read from HealthKit
    private let readTypes: Set<HKObjectType> = [
        HKWorkoutType.workoutType(),
        HKCategoryType(.sleepAnalysis),
        HKQuantityType(.stepCount),
        HKQuantityType(.bodyMass),
        HKQuantityType(.height),
    ]

    var isAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    // MARK: - Authorization

    func requestAuthorization() async throws {
        guard isAvailable else { return }
        try await store.requestAuthorization(toShare: [], read: readTypes)
        isAuthorized = true
    }

    // MARK: - Background Delivery

    /// Register observer queries and enable background delivery for each data type.
    /// Call once after authorization succeeds.
    func enableBackgroundDelivery(onUpdate: @escaping @Sendable (HKObjectType) -> Void) {
        guard isAvailable else { return }

        let types: [(HKObjectType, HKUpdateFrequency)] = [
            (HKWorkoutType.workoutType(), .immediate),
            (HKCategoryType(.sleepAnalysis), .hourly),
            (HKQuantityType(.bodyMass), .immediate),
            (HKQuantityType(.stepCount), .hourly),
        ]

        for (sampleType, frequency) in types {
            // Observer query — fires when new data arrives (foreground or background)
            let query = HKObserverQuery(sampleType: sampleType as! HKSampleType, predicate: nil) {
                _, completionHandler, error in
                if let error {
                    print("[HealthKit] Observer error for \(sampleType): \(error.localizedDescription)")
                }
                // Notify the sync engine, then MUST call completionHandler per Apple docs
                onUpdate(sampleType)
                completionHandler()
            }
            store.execute(query)

            // Enable background delivery so iOS wakes the app
            store.enableBackgroundDelivery(for: sampleType, frequency: frequency) { success, error in
                if let error {
                    print("[HealthKit] Background delivery registration failed for \(sampleType): \(error.localizedDescription)")
                }
            }
        }
    }

    // MARK: - Fetch Workouts

    struct WorkoutSample: Sendable {
        let workoutType: String
        let startTime: Date
        let endTime: Date
        let durationSeconds: Double
        let caloriesActive: Double?
        let distanceMeters: Double?
        let avgHeartRate: Double?
        let maxHeartRate: Double?
        let sourceDevice: String?
    }

    func fetchWorkouts(since startDate: Date) async throws -> [WorkoutSample] {
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: .now, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKWorkoutType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let workouts = (results as? [HKWorkout] ?? []).map { w in
                    WorkoutSample(
                        workoutType: w.workoutActivityType.apiName,
                        startTime: w.startDate,
                        endTime: w.endDate,
                        durationSeconds: w.duration,
                        caloriesActive: w.statistics(for: .init(.activeEnergyBurned))?
                            .sumQuantity()?.doubleValue(for: .kilocalorie()),
                        distanceMeters: w.statistics(for: .init(.distanceWalkingRunning))?
                            .sumQuantity()?.doubleValue(for: .meter()),
                        avgHeartRate: nil,  // Requires separate statistics query; omit for v1
                        maxHeartRate: nil,
                        sourceDevice: w.sourceRevision.source.name
                    )
                }
                continuation.resume(returning: workouts)
            }
            store.execute(query)
        }
    }

    // MARK: - Fetch Sleep

    struct SleepDaySummary: Sendable {
        let date: String          // YYYY-MM-DD
        let totalSleepMinutes: Int
        let inBedMinutes: Int?
        let awakeMinutes: Int?
        let asleepCoreMinutes: Int?
        let asleepDeepMinutes: Int?
        let asleepREMMinutes: Int?
        let sleepStart: Date?
        let sleepEnd: Date?
        let sourceDevices: [String]
    }

    func fetchSleep(since startDate: Date) async throws -> [SleepDaySummary] {
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: .now, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKCategoryType(.sleepAnalysis),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let samples = results as? [HKCategorySample] ?? []
                let summaries = Self.aggregateSleepByDate(samples)
                continuation.resume(returning: summaries)
            }
            store.execute(query)
        }
    }

    /// Aggregate individual sleep samples into per-date summaries.
    /// Sleep sessions that start before midnight are attributed to the date they started.
    private static func aggregateSleepByDate(_ samples: [HKCategorySample]) -> [SleepDaySummary] {
        let calendar = Calendar.current
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.timeZone = calendar.timeZone

        // Group samples by the date they started
        var grouped: [String: [HKCategorySample]] = [:]
        for sample in samples {
            let dateKey = dateFormatter.string(from: sample.startDate)
            grouped[dateKey, default: []].append(sample)
        }

        return grouped.map { dateKey, daySamples in
            var inBed = 0, awake = 0, core = 0, deep = 0, rem = 0
            var sources = Set<String>()
            var earliest: Date?
            var latest: Date?

            for s in daySamples {
                let mins = Int(s.endDate.timeIntervalSince(s.startDate) / 60)
                sources.insert(s.sourceRevision.source.name)

                if earliest == nil || s.startDate < earliest! { earliest = s.startDate }
                if latest == nil || s.endDate > latest! { latest = s.endDate }

                switch HKCategoryValueSleepAnalysis(rawValue: s.value) {
                case .inBed:
                    inBed += mins
                case .awake:
                    awake += mins
                case .asleepCore:
                    core += mins
                case .asleepDeep:
                    deep += mins
                case .asleepREM:
                    rem += mins
                case .asleepUnspecified:
                    core += mins  // Attribute unspecified sleep to core
                default:
                    break
                }
            }

            let totalSleep = core + deep + rem

            return SleepDaySummary(
                date: dateKey,
                totalSleepMinutes: totalSleep,
                inBedMinutes: inBed > 0 ? inBed : nil,
                awakeMinutes: awake > 0 ? awake : nil,
                asleepCoreMinutes: core > 0 ? core : nil,
                asleepDeepMinutes: deep > 0 ? deep : nil,
                asleepREMMinutes: rem > 0 ? rem : nil,
                sleepStart: earliest,
                sleepEnd: latest,
                sourceDevices: Array(sources)
            )
        }
    }

    // MARK: - Fetch Steps (daily aggregation)

    struct DailySteps: Sendable {
        let date: String    // YYYY-MM-DD
        let totalSteps: Int
    }

    func fetchSteps(since startDate: Date) async throws -> [DailySteps] {
        let calendar = Calendar.current
        let anchorDate = calendar.startOfDay(for: startDate)
        let interval = DateComponents(day: 1)
        let stepType = HKQuantityType(.stepCount)
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: .now, options: .strictStartDate)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: anchorDate,
                intervalComponents: interval
            )

            query.initialResultsHandler = { _, collection, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let dateFormatter = DateFormatter()
                dateFormatter.dateFormat = "yyyy-MM-dd"
                dateFormatter.timeZone = calendar.timeZone

                var results: [DailySteps] = []
                collection?.enumerateStatistics(from: startDate, to: .now) { stats, _ in
                    if let sum = stats.sumQuantity() {
                        let steps = Int(sum.doubleValue(for: .count()))
                        if steps > 0 {
                            results.append(DailySteps(
                                date: dateFormatter.string(from: stats.startDate),
                                totalSteps: steps
                            ))
                        }
                    }
                }
                continuation.resume(returning: results)
            }
            store.execute(query)
        }
    }

    // MARK: - Fetch Weight

    struct WeightSample: Sendable {
        let weightKg: Double
        let measuredAt: Date
    }

    func fetchWeight(since startDate: Date) async throws -> [WeightSample] {
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: .now, options: .strictStartDate)
        let weightType = HKQuantityType(.bodyMass)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: weightType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let samples = (results as? [HKQuantitySample] ?? []).map { s in
                    WeightSample(
                        weightKg: s.quantity.doubleValue(for: .gramUnit(with: .kilo)),
                        measuredAt: s.startDate
                    )
                }
                continuation.resume(returning: samples)
            }
            store.execute(query)
        }
    }

    // MARK: - Fetch Height

    struct HeightSample: Sendable {
        let heightMeters: Double
        let measuredAt: Date
    }

    func fetchHeight(since startDate: Date) async throws -> [HeightSample] {
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: .now, options: .strictStartDate)
        let heightType = HKQuantityType(.height)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: heightType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, results, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let samples = (results as? [HKQuantitySample] ?? []).map { s in
                    HeightSample(
                        heightMeters: s.quantity.doubleValue(for: .meter()),
                        measuredAt: s.startDate
                    )
                }
                continuation.resume(returning: samples)
            }
            store.execute(query)
        }
    }

    // MARK: - Today's Data (for pre-populating check-in)

    struct TodayHealthData: Sendable {
        let steps: Int?
        let weightLbs: Double?
        let weightDate: Date?
        let recentWorkouts: [WorkoutSample]
        let lastNightSleep: SleepDaySummary?
    }

    func fetchTodayData() async throws -> TodayHealthData {
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: .now)

        // Fetch today's steps
        let steps = try await fetchSteps(since: startOfDay)
        let todaySteps = steps.first?.totalSteps

        // Fetch most recent weight (last 30 days)
        let thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: .now)!
        let weights = try await fetchWeight(since: thirtyDaysAgo)
        let latestWeight = weights.last
        let latestWeightLbs = latestWeight.map { $0.weightKg * 2.20462 }

        // Fetch recent workouts (last 7 days)
        let sevenDaysAgo = calendar.date(byAdding: .day, value: -7, to: .now)!
        let workouts = try await fetchWorkouts(since: sevenDaysAgo)

        // Fetch last night's sleep
        let yesterday = calendar.date(byAdding: .day, value: -1, to: startOfDay)!
        let sleepRecords = try await fetchSleep(since: yesterday)
        let lastNightSleep = sleepRecords.last

        return TodayHealthData(
            steps: todaySteps,
            weightLbs: latestWeightLbs,
            weightDate: latestWeight?.measuredAt,
            recentWorkouts: workouts,
            lastNightSleep: lastNightSleep
        )
    }
}

// MARK: - HKWorkoutActivityType → API String

extension HKWorkoutActivityType {
    var apiName: String {
        switch self {
        case .running:                  return "running"
        case .cycling:                  return "cycling"
        case .walking:                  return "walking"
        case .swimming:                 return "swimming"
        case .hiking:                   return "hiking"
        case .yoga:                     return "yoga"
        case .functionalStrengthTraining: return "strength_training"
        case .traditionalStrengthTraining: return "strength_training"
        case .highIntensityIntervalTraining: return "hiit"
        case .crossTraining:            return "cross_training"
        case .elliptical:               return "elliptical"
        case .rowing:                   return "rowing"
        case .stairClimbing:            return "stair_climbing"
        case .pilates:                  return "pilates"
        case .dance:                    return "dance"
        case .cooldown:                 return "cooldown"
        case .coreTraining:             return "core_training"
        case .flexibility:              return "flexibility"
        case .mixedCardio:              return "mixed_cardio"
        case .jumpRope:                 return "jump_rope"
        case .kickboxing:               return "kickboxing"
        case .stairs:                   return "stairs"
        case .stepTraining:             return "step_training"
        case .wheelchairWalkPace:       return "wheelchair_walk"
        case .wheelchairRunPace:        return "wheelchair_run"
        case .other:                    return "other"
        default:                        return "other"
        }
    }
}
