import SwiftUI
import HealthKit

@main
struct GymDashSyncApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var healthDataManager = HealthDataManager()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environmentObject(healthDataManager)
        }
    }
    
    init() {
        setupHealthDataSync()
    }
    
    private func setupHealthDataSync() {
        let manager = HDSManagerFactory.manager()
        let externalStore = GymDashExternalStore(appState: appState)
        
        manager.addObjectTypes([
            WorkoutExternalObject.self,
            HeightExternalObject.self,
            WeightExternalObject.self,
            BodyFatExternalObject.self
        ], externalStore: externalStore)
    }
}

class HealthDataManager: ObservableObject {
    let manager: HDSManager
    
    init() {
        self.manager = HDSManagerFactory.manager()
    }
}

class AppState: ObservableObject {
    @Published var isDevMode: Bool = true
    @Published var clientId: String? = nil
    @Published var isPaired: Bool = false
    @Published var errors: [AppError] = []
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
}

enum SyncStatus {
    case idle
    case pairing
    case syncing
    case error(String)
}

struct AppError: Identifiable, Codable {
    let id = UUID()
    let category: ErrorCategory
    let message: String
    let detail: String?
    let timestamp = Date()
    let context: [String: String]?
    
    enum ErrorCategory: String, Codable, CaseIterable {
        case pairing = "Pairing"
        case healthkit = "HealthKit"
        case sync = "Sync"
        case network = "Network"
        case validation = "Validation"
    }
}