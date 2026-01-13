import Foundation
import HealthDataSync

class GymDashExternalStore: HDSExternalStoreProtocol {
    private weak var appState: AppState?
    
    init(appState: AppState) {
        self.appState = appState
    }
    
    private func getClientId() -> String? {
        return UserDefaults.standard.string(forKey: "gym_dash_client_id")
    }
    
    private func logError(_ category: AppError.ErrorCategory, _ message: String, _ detail: String? = nil, context: [String: String]? = nil) {
        let error = AppError(category: category, message: message, detail: detail, context: context)
        appState?.addError(error)
    }
    
    func fetchObjects(with objects: [HDSExternalObjectProtocol], completion: @escaping ([HDSExternalObjectProtocol]?, Error?) -> Void) {
        completion([], nil)
    }
    
    func add(objects: [HDSExternalObjectProtocol], completion: @escaping (Error?) -> Void) {
        guard let clientId = getClientId() else {
            let error = NSError(domain: "GymDashSync", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Device not paired"])
            logError(.backend, "No client ID available", "Device not paired")
            completion(error)
            return
        }
        
        appState?.updateSyncStatus(.syncing)
        
        let workouts = objects.compactMap { $0 as? WorkoutExternalObject }
        let profileMetrics = objects.filter { !($0 is WorkoutExternalObject) }
        
        let group = DispatchGroup()
        var errors: [Error] = []
        var totalWorkouts = 0
        var totalProfile = 0
        var totalDuplicates = 0
        var totalErrors = 0
        
        if !workouts.isEmpty {
            group.enter()
            let workoutData = workouts.map { workout in
                WorkoutData(
                    workoutType: workout.workoutType,
                    startTime: workout.startTime,
                    endTime: workout.endTime,
                    durationSeconds: workout.durationSeconds,
                    caloriesActive: workout.caloriesActive,
                    distanceMeters: workout.distanceMeters,
                    avgHeartRate: workout.avgHeartRate,
                    sourceDevice: workout.sourceDevice,
                    source: "apple_health"
                )
            }
            
            NetworkService.shared.ingestWorkouts(clientId: clientId, workouts: workoutData) { result in
                defer { group.leave() }
                
                switch result {
                case .success(let response):
                    totalWorkouts = response.inserted
                    totalDuplicates += response.duplicates
                    totalErrors += response.errors.count
                    
                    print("✅ Synced \(response.inserted) workouts, \(response.duplicates) duplicates")
                    
                case .failure(let error):
                    errors.append(error)
                    self.logError(.network, "Failed to sync workouts", error.localizedDescription)
                }
            }
        }
        
        if !profileMetrics.isEmpty {
            group.enter()
            let metricData = profileMetrics.compactMap { object -> ProfileMetricData? in
                if let height = object as? HeightExternalObject {
                    return ProfileMetricData(
                        metric: "height",
                        value: height.value,
                        unit: height.unit,
                        measuredAt: height.measuredAt,
                        source: "apple_health"
                    )
                } else if let weight = object as? WeightExternalObject {
                    return ProfileMetricData(
                        metric: "weight",
                        value: weight.value,
                        unit: weight.unit,
                        measuredAt: weight.measuredAt,
                        source: "apple_health"
                    )
                } else if let bodyFat = object as? BodyFatExternalObject {
                    return ProfileMetricData(
                        metric: "body_fat",
                        value: bodyFat.value,
                        unit: bodyFat.unit,
                        measuredAt: bodyFat.measuredAt,
                        source: "apple_health"
                    )
                }
                return nil
            }
            
            NetworkService.shared.ingestProfile(clientId: clientId, metrics: metricData) { result in
                defer { group.leave() }
                
                switch result {
                case .success(let response):
                    totalProfile = response.inserted
                    totalErrors += response.errors.count
                    
                    print("✅ Synced \(response.inserted) profile metrics")
                    
                case .failure(let error):
                    errors.append(error)
                    self.logError(.network, "Failed to sync profile metrics", error.localizedDescription)
                }
            }
        }
        
        group.notify(queue: .main) {
            let summary = SyncSummary(
                workoutsIngested: totalWorkouts,
                profileMetricsIngested: totalProfile,
                workoutsDuplicated: totalDuplicates,
                errors: totalErrors
            )
            self.appState?.recordSyncSummary(summary)
            self.appState?.updateSyncStatus(.idle)
            
            completion(errors.first)
        }
    }
    
    func update(objects: [HDSExternalObjectProtocol], completion: @escaping (Error?) -> Void) {
        add(objects: objects, completion: completion)
    }
    
    func delete(deletedObjects: [HDSExternalObjectProtocol], completion: @escaping (Error?) -> Void) {
        print("🗑️ Delete request received for \(deletedObjects.count) objects - ignoring (append-only)")
        completion(nil)
    }
}