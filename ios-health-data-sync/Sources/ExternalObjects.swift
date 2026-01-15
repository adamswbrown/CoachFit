import Foundation
import HealthKit

// MARK: - Workout External Object

class WorkoutExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var workoutType: String
    var startTime: String
    var endTime: String
    var durationSeconds: Int
    var caloriesActive: Int?
    var distanceMeters: Double?
    var avgHeartRate: Int?
    var sourceDevice: String?
    
    init(uuid: UUID, workoutType: String, startTime: String, endTime: String, durationSeconds: Int) {
        self.uuid = uuid
        self.workoutType = workoutType
        self.startTime = startTime
        self.endTime = endTime
        self.durationSeconds = durationSeconds
    }
    
    static func authorizationTypes() -> [HKObjectType]? {
        return [HKWorkoutType.workoutType()]
    }
    
    static func healthKitObjectType() -> HKObjectType? {
        return HKWorkoutType.workoutType()
    }
    
    static func externalObject(object: HKObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        guard let workout = object as? HKWorkout else { return nil }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        let workoutTypeString = mapWorkoutType(workout.workoutActivityType)
        let startTime = formatter.string(from: workout.startDate)
        let endTime = formatter.string(from: workout.endDate)
        let duration = Int(workout.duration)
        
        let externalObject = WorkoutExternalObject(
            uuid: workout.uuid,
            workoutType: workoutTypeString,
            startTime: startTime,
            endTime: endTime,
            durationSeconds: duration
        )
        
        // Extract additional metrics
        if let activeCalories = workout.totalEnergyBurned {
            externalObject.caloriesActive = Int(activeCalories.doubleValue(for: .kilocalorie()))
        }
        
        if let distance = workout.totalDistance {
            externalObject.distanceMeters = distance.doubleValue(for: .meter())
        }
        
        if let device = workout.device {
            externalObject.sourceDevice = "\(device.name) (\(device.model ?? "Unknown"))"
        }
        
        // For heart rate, we would need to query separately as it's not directly available on HKWorkout
        // This is a simplified implementation
        
        return externalObject
    }
    
    static func externalObject(deletedObject: HKDeletedObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return WorkoutExternalObject(
            uuid: deletedObject.uuid,
            workoutType: "deleted",
            startTime: formatter.string(from: Date()),
            endTime: formatter.string(from: Date()),
            durationSeconds: 0
        )
    }
    
    func update(with object: HKObject) {
        guard let workout = object as? HKWorkout else { return }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        workoutType = Self.mapWorkoutType(workout.workoutActivityType)
        startTime = formatter.string(from: workout.startDate)
        endTime = formatter.string(from: workout.endDate)
        durationSeconds = Int(workout.duration)
        
        if let activeCalories = workout.totalEnergyBurned {
            caloriesActive = Int(activeCalories.doubleValue(for: .kilocalorie()))
        }
        
        if let distance = workout.totalDistance {
            distanceMeters = distance.doubleValue(for: .meter())
        }
        
        if let device = workout.device {
            sourceDevice = "\(device.name) (\(device.model ?? "Unknown"))"
        }
    }
    
    private static func mapWorkoutType(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .running:
            return "running"
        case .cycling:
            return "cycling"
        case .walking:
            return "walking"
        case .swimming:
            return "swimming"
        case .traditionalStrengthTraining:
            return "strength_training"
        case .functionalStrengthTraining:
            return "functional_training"
        case .yoga:
            return "yoga"
        case .pilates:
            return "pilates"
        case .dance:
            return "dance"
        case .boxing:
            return "boxing"
        case .kickboxing:
            return "kickboxing"
        case .martialArts:
            return "martial_arts"
        case .tennis:
            return "tennis"
        case .basketball:
            return "basketball"
        case .soccer:
            return "soccer"
        case .americanFootball:
            return "american_football"
        case .baseball:
            return "baseball"
        case .golf:
            return "golf"
        case .hiking:
            return "hiking"
        case .rowing:
            return "rowing"
        case .elliptical:
            return "elliptical"
        case .stairClimbing:
            return "stair_climbing"
        default:
            return "other"
        }
    }
}

// MARK: - Height External Object

class HeightExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var value: Double
    var unit: String
    var measuredAt: String
    
    init(uuid: UUID, value: Double, unit: String, measuredAt: String) {
        self.uuid = uuid
        self.value = value
        self.unit = unit
        self.measuredAt = measuredAt
    }
    
    static func authorizationTypes() -> [HKObjectType]? {
        return [HKQuantityType.quantityType(forIdentifier: .height)!]
    }
    
    static func healthKitObjectType() -> HKObjectType? {
        return HKQuantityType.quantityType(forIdentifier: .height)
    }
    
    static func externalObject(object: HKObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        guard let sample = object as? HKQuantitySample,
              sample.quantityType == HKQuantityType.quantityType(forIdentifier: .height) else {
            return nil
        }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return HeightExternalObject(
            uuid: sample.uuid,
            value: sample.quantity.doubleValue(for: .meter()),
            unit: "m",
            measuredAt: formatter.string(from: sample.startDate)
        )
    }
    
    static func externalObject(deletedObject: HKDeletedObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return HeightExternalObject(
            uuid: deletedObject.uuid,
            value: 0,
            unit: "m",
            measuredAt: formatter.string(from: Date())
        )
    }
    
    func update(with object: HKObject) {
        guard let sample = object as? HKQuantitySample else { return }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        value = sample.quantity.doubleValue(for: .meter())
        unit = "m"
        measuredAt = formatter.string(from: sample.startDate)
    }
}

// MARK: - Weight External Object

class WeightExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var value: Double
    var unit: String
    var measuredAt: String
    
    init(uuid: UUID, value: Double, unit: String, measuredAt: String) {
        self.uuid = uuid
        self.value = value
        self.unit = unit
        self.measuredAt = measuredAt
    }
    
    static func authorizationTypes() -> [HKObjectType]? {
        return [HKQuantityType.quantityType(forIdentifier: .bodyMass)!]
    }
    
    static func healthKitObjectType() -> HKObjectType? {
        return HKQuantityType.quantityType(forIdentifier: .bodyMass)
    }
    
    static func externalObject(object: HKObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        guard let sample = object as? HKQuantitySample,
              sample.quantityType == HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            return nil
        }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return WeightExternalObject(
            uuid: sample.uuid,
            value: sample.quantity.doubleValue(for: .gramUnit(with: .kilo)),
            unit: "kg",
            measuredAt: formatter.string(from: sample.startDate)
        )
    }
    
    static func externalObject(deletedObject: HKDeletedObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return WeightExternalObject(
            uuid: deletedObject.uuid,
            value: 0,
            unit: "kg",
            measuredAt: formatter.string(from: Date())
        )
    }
    
    func update(with object: HKObject) {
        guard let sample = object as? HKQuantitySample else { return }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        value = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
        unit = "kg"
        measuredAt = formatter.string(from: sample.startDate)
    }
}

// MARK: - Body Fat External Object

class BodyFatExternalObject: HDSExternalObjectProtocol {
    var uuid: UUID
    var value: Double
    var unit: String
    var measuredAt: String
    
    init(uuid: UUID, value: Double, unit: String, measuredAt: String) {
        self.uuid = uuid
        self.value = value
        self.unit = unit
        self.measuredAt = measuredAt
    }
    
    static func authorizationTypes() -> [HKObjectType]? {
        return [HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)!]
    }
    
    static func healthKitObjectType() -> HKObjectType? {
        return HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)
    }
    
    static func externalObject(object: HKObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        guard let sample = object as? HKQuantitySample,
              sample.quantityType == HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage) else {
            return nil
        }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return BodyFatExternalObject(
            uuid: sample.uuid,
            value: sample.quantity.doubleValue(for: .percent()) * 100,
            unit: "percent",
            measuredAt: formatter.string(from: sample.startDate)
        )
    }
    
    static func externalObject(deletedObject: HKDeletedObject, converter: HDSConverterProtocol?) -> HDSExternalObjectProtocol? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        return BodyFatExternalObject(
            uuid: deletedObject.uuid,
            value: 0,
            unit: "percent",
            measuredAt: formatter.string(from: Date())
        )
    }
    
    func update(with object: HKObject) {
        guard let sample = object as? HKQuantitySample else { return }
        
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        
        value = sample.quantity.doubleValue(for: .percent()) * 100
        unit = "percent"
        measuredAt = formatter.string(from: sample.startDate)
    }
}