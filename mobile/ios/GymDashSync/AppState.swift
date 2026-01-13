import SwiftUI
import Foundation

class AppState: ObservableObject {
    @Published var clientId: String? = nil
    @Published var isDevMode: Bool = true
    @Published var errors: [AppError] = []
    @Published var lastSyncSummary: SyncSummary? = nil
    @Published var isPaired: Bool = false
    @Published var syncStatus: SyncStatus = .idle
    @Published var lastSyncTime: Date? = nil
    
    init() {
        loadClientId()
    }
    
    func loadClientId() {
        clientId = UserDefaults.standard.string(forKey: "gym_dash_client_id")
        isPaired = clientId != nil
    }
    
    func saveClientId(_ id: String) {
        clientId = id
        isPaired = true
        UserDefaults.standard.set(id, forKey: "gym_dash_client_id")
    }
    
    func clearClientId() {
        clientId = nil
        isPaired = false
        UserDefaults.standard.removeObject(forKey: "gym_dash_client_id")
    }
    
    func addError(_ error: AppError) {
        DispatchQueue.main.async {
            self.errors.insert(error, at: 0)
            if self.errors.count > 50 {
                self.errors.removeLast()
            }
        }
    }
    
    func clearErrors() {
        errors.removeAll()
    }
    
    func updateSyncStatus(_ status: SyncStatus) {
        DispatchQueue.main.async {
            self.syncStatus = status
        }
    }
    
    func recordSyncSummary(_ summary: SyncSummary) {
        DispatchQueue.main.async {
            self.lastSyncSummary = summary
            self.lastSyncTime = Date()
        }
    }
}

struct AppError: Identifiable, Codable {
    let id: UUID
    let category: ErrorCategory
    let message: String
    let detail: String?
    let timestamp: Date
    let context: [String: String]?
    
    init(category: ErrorCategory, message: String, detail: String? = nil, context: [String: String]? = nil) {
        self.id = UUID()
        self.category = category
        self.message = message
        self.detail = detail
        self.timestamp = Date()
        self.context = context
    }
    
    enum ErrorCategory: String, Codable, CaseIterable {
        case pairing = "Pairing"
        case healthkit = "HealthKit"
        case network = "Network"
        case backend = "Backend"
        case validation = "Validation"
        case unknown = "Unknown"
    }
}

enum SyncStatus {
    case idle
    case pairing
    case syncing
    case error(String)
}

struct SyncSummary {
    let workoutsIngested: Int
    let profileMetricsIngested: Int
    let workoutsDuplicated: Int
    let errors: Int
    let timestamp: Date
    
    init(workoutsIngested: Int = 0, profileMetricsIngested: Int = 0, workoutsDuplicated: Int = 0, errors: Int = 0) {
        self.workoutsIngested = workoutsIngested
        self.profileMetricsIngested = profileMetricsIngested
        self.workoutsDuplicated = workoutsDuplicated
        self.errors = errors
        self.timestamp = Date()
    }
}