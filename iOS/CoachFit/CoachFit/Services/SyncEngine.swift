import Foundation
import HealthKit

@Observable
final class SyncEngine {
    private let healthKit: HealthKitManager
    private let api: APIClient

    private(set) var isSyncing = false
    private(set) var lastSyncTime: Date?
    private(set) var lastSyncError: String?

    // Per-type status visible to UI
    struct TypeStatus: Sendable {
        var lastSync: Date?
        var lastCount: Int = 0       // items synced in last run
        var lastError: String?
    }

    private(set) var workoutsStatus = TypeStatus()
    private(set) var sleepStatus = TypeStatus()
    private(set) var stepsStatus = TypeStatus()
    private(set) var weightStatus = TypeStatus()

    // Sync timestamps per data type — persisted in UserDefaults
    private enum SyncKey: String, CaseIterable {
        case workouts   = "lastSync.workouts"
        case sleep      = "lastSync.sleep"
        case steps      = "lastSync.steps"
        case weight     = "lastSync.weight"
    }

    // Offline queue keys
    private static let offlineQueueKey = "offlineQueue"

    init(healthKit: HealthKitManager, api: APIClient) {
        self.healthKit = healthKit
        self.api = api
        self.lastSyncTime = UserDefaults.standard.object(forKey: "lastSync.any") as? Date

        // Restore per-type timestamps
        workoutsStatus.lastSync = UserDefaults.standard.object(forKey: SyncKey.workouts.rawValue) as? Date
        sleepStatus.lastSync = UserDefaults.standard.object(forKey: SyncKey.sleep.rawValue) as? Date
        stepsStatus.lastSync = UserDefaults.standard.object(forKey: SyncKey.steps.rawValue) as? Date
        weightStatus.lastSync = UserDefaults.standard.object(forKey: SyncKey.weight.rawValue) as? Date
    }

    // MARK: - Full Sync (all data types)

    func syncAll() async {
        guard !isSyncing else { return }
        isSyncing = true
        lastSyncError = nil
        defer {
            isSyncing = false
            lastSyncTime = .now
            UserDefaults.standard.set(Date.now, forKey: "lastSync.any")
        }

        // Retry any queued offline requests first
        await retryOfflineQueue()

        // Sync each data type independently — one failure shouldn't block others
        await withTaskGroup(of: Void.self) { group in
            group.addTask { await self.syncWorkouts() }
            group.addTask { await self.syncSleep() }
            group.addTask { await self.syncSteps() }
            group.addTask { await self.syncWeight() }
        }
    }

    /// Sync a single data type — called by observer query when new data arrives
    func syncType(_ type: HKObjectType) async {
        switch type {
        case HKWorkoutType.workoutType():
            await syncWorkouts()
        case HKCategoryType(.sleepAnalysis):
            await syncSleep()
        case HKQuantityType(.stepCount):
            await syncSteps()
        case HKQuantityType(.bodyMass):
            await syncWeight()
        default:
            break
        }
    }

    /// Initial 30-day backfill after first pairing
    func performInitialBackfill() async {
        let thirtyDaysAgo = Calendar.current.date(byAdding: .day, value: -30, to: .now)!

        // Reset all sync dates to 30 days ago to trigger full backfill
        for key in SyncKey.allCases {
            UserDefaults.standard.set(thirtyDaysAgo, forKey: key.rawValue)
        }

        await syncAll()
    }

    // MARK: - Sync Workouts

    private func syncWorkouts() async {
        guard let clientId = KeychainService.clientId else { return }
        let since = lastSyncDate(for: .workouts)
        workoutsStatus.lastError = nil

        do {
            let workouts = try await healthKit.fetchWorkouts(since: since)
            workoutsStatus.lastCount = workouts.count
            guard !workouts.isEmpty else { return }

            for chunk in workouts.chunked(into: 100) {
                let payload = WorkoutsPayload(
                    client_id: clientId,
                    workouts: chunk.map { w in
                        WorkoutsPayload.Item(
                            workout_type: w.workoutType,
                            start_time: w.startTime.iso8601String,
                            end_time: w.endTime.iso8601String,
                            duration_seconds: w.durationSeconds,
                            calories_active: w.caloriesActive,
                            distance_meters: w.distanceMeters,
                            avg_heart_rate: w.avgHeartRate,
                            max_heart_rate: w.maxHeartRate,
                            source_device: w.sourceDevice
                        )
                    }
                )
                try await sendOrQueue(path: "api/ingest/workouts", payload: payload)
            }

            updateSyncDate(for: .workouts)
            workoutsStatus.lastSync = .now
        } catch {
            print("[SyncEngine] Workouts sync failed: \(error.localizedDescription)")
            workoutsStatus.lastError = error.localizedDescription
            lastSyncError = "Workouts: \(error.localizedDescription)"
        }
    }

    // MARK: - Sync Sleep

    private func syncSleep() async {
        guard let clientId = KeychainService.clientId else { return }
        let since = lastSyncDate(for: .sleep)
        sleepStatus.lastError = nil

        do {
            let records = try await healthKit.fetchSleep(since: since)
            sleepStatus.lastCount = records.count
            guard !records.isEmpty else { return }

            for chunk in records.chunked(into: 400) {
                let payload = SleepPayload(
                    client_id: clientId,
                    sleep_records: chunk.map { r in
                        SleepPayload.Item(
                            date: r.date,
                            total_sleep_minutes: r.totalSleepMinutes,
                            in_bed_minutes: r.inBedMinutes,
                            awake_minutes: r.awakeMinutes,
                            asleep_core_minutes: r.asleepCoreMinutes,
                            asleep_deep_minutes: r.asleepDeepMinutes,
                            asleep_rem_minutes: r.asleepREMMinutes,
                            sleep_start: r.sleepStart?.iso8601String,
                            sleep_end: r.sleepEnd?.iso8601String,
                            source_devices: r.sourceDevices
                        )
                    }
                )
                try await sendOrQueue(path: "api/ingest/sleep", payload: payload)
            }

            updateSyncDate(for: .sleep)
            sleepStatus.lastSync = .now
        } catch {
            print("[SyncEngine] Sleep sync failed: \(error.localizedDescription)")
            sleepStatus.lastError = error.localizedDescription
            lastSyncError = "Sleep: \(error.localizedDescription)"
        }
    }

    // MARK: - Sync Steps

    private func syncSteps() async {
        guard let clientId = KeychainService.clientId else { return }
        let since = lastSyncDate(for: .steps)
        stepsStatus.lastError = nil

        do {
            let records = try await healthKit.fetchSteps(since: since)
            stepsStatus.lastCount = records.count
            guard !records.isEmpty else { return }

            for chunk in records.chunked(into: 400) {
                let payload = StepsPayload(
                    client_id: clientId,
                    steps: chunk.map { r in
                        StepsPayload.Item(date: r.date, total_steps: r.totalSteps)
                    }
                )
                try await sendOrQueue(path: "api/ingest/steps", payload: payload)
            }

            updateSyncDate(for: .steps)
            stepsStatus.lastSync = .now
        } catch {
            print("[SyncEngine] Steps sync failed: \(error.localizedDescription)")
            stepsStatus.lastError = error.localizedDescription
            lastSyncError = "Steps: \(error.localizedDescription)"
        }
    }

    // MARK: - Sync Weight

    private func syncWeight() async {
        guard let clientId = KeychainService.clientId else { return }
        let since = lastSyncDate(for: .weight)
        weightStatus.lastError = nil

        do {
            let weights = try await healthKit.fetchWeight(since: since)
            let heights = try await healthKit.fetchHeight(since: since)

            var metrics: [ProfilePayload.Metric] = []

            for w in weights {
                metrics.append(ProfilePayload.Metric(
                    metric: "weight",
                    value: w.weightKg,
                    unit: "kg",
                    measured_at: w.measuredAt.iso8601String
                ))
            }

            for h in heights {
                metrics.append(ProfilePayload.Metric(
                    metric: "height",
                    value: h.heightMeters,
                    unit: "m",
                    measured_at: h.measuredAt.iso8601String
                ))
            }

            weightStatus.lastCount = metrics.count
            guard !metrics.isEmpty else { return }

            for chunk in metrics.chunked(into: 50) {
                let payload = ProfilePayload(client_id: clientId, metrics: chunk)
                try await sendOrQueue(path: "api/ingest/profile", payload: payload)
            }

            updateSyncDate(for: .weight)
            weightStatus.lastSync = .now
        } catch {
            print("[SyncEngine] Weight sync failed: \(error.localizedDescription)")
            weightStatus.lastError = error.localizedDescription
            lastSyncError = "Weight: \(error.localizedDescription)"
        }
    }

    // MARK: - Nutrition Sync

    func syncScannedProduct(name: String, brand: String?, servingGrams: Double,
                             calories: Double, protein: Double, fat: Double, carbs: Double,
                             date: String) async {
        guard let clientId = KeychainService.clientId else { return }

        struct NutritionPayload: Encodable {
            let client_id: String
            let rows: [Row]
            struct Row: Encodable {
                let date: String
                let calories: Int?
                let proteinGrams: Double?
                let carbsGrams: Double?
                let fatGrams: Double?
            }
        }

        let payload = NutritionPayload(
            client_id: clientId,
            rows: [.init(
                date: date,
                calories: Int(calories),
                proteinGrams: protein,
                carbsGrams: carbs,
                fatGrams: fat
            )]
        )

        try? await sendOrQueue(path: "/api/ingest/cronometer", payload: payload)
    }

    // MARK: - Network + Offline Queue

    private func sendOrQueue(path: String, payload: some Encodable) async throws {
        do {
            let (_, response) = try await api.authenticatedRequest(
                path: path, method: "POST", body: payload
            )
            // 200 = all good, 207 = partial success (still counts)
            guard (200...299).contains(response.statusCode) || response.statusCode == 207 else {
                throw APIClient.APIError.server(
                    statusCode: response.statusCode, message: "Sync failed: HTTP \(response.statusCode)"
                )
            }
        } catch is URLError {
            // Network error — queue for later
            enqueue(path: path, payload: payload)
        }
    }

    private func enqueue(path: String, payload: some Encodable) {
        guard let data = try? JSONEncoder().encode(payload) else { return }

        var queue = UserDefaults.standard.array(forKey: Self.offlineQueueKey) as? [[String: Data]] ?? []

        // Cap at 50 items to avoid unbounded growth
        guard queue.count < 50 else {
            print("[SyncEngine] Offline queue full, dropping request")
            return
        }

        queue.append([path: data])
        UserDefaults.standard.set(queue, forKey: Self.offlineQueueKey)
        print("[SyncEngine] Queued offline request for \(path)")
    }

    private func retryOfflineQueue() async {
        guard let queue = UserDefaults.standard.array(forKey: Self.offlineQueueKey) as? [[String: Data]],
              !queue.isEmpty else { return }

        print("[SyncEngine] Retrying \(queue.count) queued requests")

        var remaining: [[String: Data]] = []

        for item in queue {
            guard let (path, data) = item.first else { continue }

            do {
                let url = api.baseURL.appendingPathComponent(path)
                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                if let token = KeychainService.deviceToken {
                    request.setValue(token, forHTTPHeaderField: "X-Pairing-Token")
                }
                request.httpBody = data

                let (_, response) = try await URLSession.shared.data(for: request)
                let httpResponse = response as! HTTPURLResponse

                if httpResponse.statusCode == 401 {
                    // Token revoked — clear queue, trigger unpair
                    remaining = []
                    api.onUnauthorized?()
                    break
                }

                if !(200...299).contains(httpResponse.statusCode) && httpResponse.statusCode != 207 {
                    remaining.append(item)  // Keep for next retry
                }
            } catch {
                remaining.append(item)  // Network still down
            }
        }

        UserDefaults.standard.set(remaining.isEmpty ? nil : remaining, forKey: Self.offlineQueueKey)
    }

    // MARK: - Sync Date Tracking

    private func lastSyncDate(for key: SyncKey) -> Date {
        UserDefaults.standard.object(forKey: key.rawValue) as? Date
            ?? Calendar.current.date(byAdding: .day, value: -30, to: .now)!
    }

    private func updateSyncDate(for key: SyncKey) {
        UserDefaults.standard.set(Date.now, forKey: key.rawValue)
    }
}

// MARK: - API Payloads

private struct WorkoutsPayload: Encodable {
    let client_id: String
    let workouts: [Item]

    struct Item: Encodable {
        let workout_type: String
        let start_time: String
        let end_time: String
        let duration_seconds: Double
        let calories_active: Double?
        let distance_meters: Double?
        let avg_heart_rate: Double?
        let max_heart_rate: Double?
        let source_device: String?
    }
}

private struct SleepPayload: Encodable {
    let client_id: String
    let sleep_records: [Item]

    struct Item: Encodable {
        let date: String
        let total_sleep_minutes: Int
        let in_bed_minutes: Int?
        let awake_minutes: Int?
        let asleep_core_minutes: Int?
        let asleep_deep_minutes: Int?
        let asleep_rem_minutes: Int?
        let sleep_start: String?
        let sleep_end: String?
        let source_devices: [String]?
    }
}

private struct StepsPayload: Encodable {
    let client_id: String
    let steps: [Item]

    struct Item: Encodable {
        let date: String
        let total_steps: Int
    }
}

private struct ProfilePayload: Encodable {
    let client_id: String
    let metrics: [Metric]

    struct Metric: Encodable {
        let metric: String
        let value: Double
        let unit: String
        let measured_at: String
    }
}

// MARK: - Helpers

extension Date {
    var iso8601String: String {
        ISO8601DateFormatter().string(from: self)
    }
}

extension Array {
    func chunked(into size: Int) -> [[Element]] {
        stride(from: 0, to: count, by: size).map {
            Array(self[$0..<Swift.min($0 + size, count)])
        }
    }
}
