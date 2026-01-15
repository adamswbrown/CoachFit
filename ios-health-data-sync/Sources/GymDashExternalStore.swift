import Foundation
import HealthKit

class GymDashExternalStore: HDSExternalStoreProtocol {
    private weak var appState: AppState?
    
    init(appState: AppState? = nil) {
        self.appState = appState
    }
    
    private func getClientId() -> String? {
        return UserDefaults.standard.string(forKey: "gym_dash_client_id")
    }
    
    private func logError(_ category: AppError.ErrorCategory, _ message: String, _ detail: String? = nil) {
        let error = AppError(category: category, message: message, detail: detail, context: nil)
        DispatchQueue.main.async {
            self.appState?.addError(error)
        }
    }
    
    func fetchObjects(with objects: [HDSExternalObjectProtocol], completion: @escaping ([HDSExternalObjectProtocol]?, Error?) -> Void) {
        // For this implementation, we don't fetch from the external store for comparison
        // We let the backend handle deduplication based on time/duration matching
        completion([], nil)
    }
    
    func add(objects: [HDSExternalObjectProtocol], completion: @escaping (Error?) -> Void) {
        guard let clientId = getClientId() else {
            logError(.sync, "No client ID available", "Device not paired")
            completion(NSError(domain: "GymDashSync", code: 1001, userInfo: [NSLocalizedDescriptionKey: "Device not paired"]))
            return
        }
        
        let workouts = objects.compactMap { $0 as? WorkoutExternalObject }
        let profileMetrics = objects.filter { !($0 is WorkoutExternalObject) }
        
        let group = DispatchGroup()
        var errors: [Error] = []
        
        // Sync workouts
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
                    print("Synced \(response.inserted) workouts, \(response.duplicates) duplicates")
                    if !response.errors.isEmpty {
                        self.logError(.validation, "Workout validation errors", "Errors: \(response.errors.count)")
                    }
                case .failure(let error):
                    errors.append(error)
                    self.logError(.network, "Failed to sync workouts", error.localizedDescription)
                }
            }
        }
        
        // Sync profile metrics
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
                    print("Synced \(response.inserted) profile metrics")
                    if !response.errors.isEmpty {
                        self.logError(.validation, "Profile validation errors", "Errors: \(response.errors.count)")
                    }
                case .failure(let error):
                    errors.append(error)
                    self.logError(.network, "Failed to sync profile metrics", error.localizedDescription)
                }
            }
        }
        
        group.notify(queue: .main) {
            completion(errors.first)
        }
    }
    
    func update(objects: [HDSExternalObjectProtocol], completion: @escaping (Error?) -> Void) {
        // For this implementation, we treat updates the same as adds
        // The backend will handle deduplication
        add(objects: objects, completion: completion)
    }
    
    func delete(deletedObjects: [HDSExternalObjectProtocol], completion: @escaping (Error?) -> Void) {
        // For this implementation, we don't handle deletes
        // HealthKit data is append-only in our system
        print("Delete request received for \(deletedObjects.count) objects - ignoring")
        completion(nil)
    }
}