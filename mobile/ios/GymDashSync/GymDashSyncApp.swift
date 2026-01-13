import SwiftUI
import HealthDataSync

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
        
        healthDataManager.setHDSManager(manager as! HDSManager)
    }
}

class HealthDataManager: ObservableObject {
    @Published var hasPermissions: Bool = false
    @Published var canRequestPermissions: Bool = false
    @Published var isObserving: Bool = false
    @Published var lastSyncDate: Date? = nil
    
    private var hdsManager: HDSManager?
    
    func setHDSManager(_ manager: HDSManager) {
        self.hdsManager = manager
        checkPermissions()
    }
    
    func requestPermissions() {
        guard let manager = hdsManager else { return }
        
        manager.requestPermissionsForAllObservers { [weak self] success, error in
            DispatchQueue.main.async {
                self?.hasPermissions = success
                if let error = error {
                    print("Permission request failed: \(error.localizedDescription)")
                }
            }
        }
    }
    
    func startObserving() {
        guard let manager = hdsManager, hasPermissions else { return }
        manager.startObserving()
        isObserving = true
        lastSyncDate = Date()
    }
    
    func stopObserving() {
        guard let manager = hdsManager else { return }
        manager.stopObserving()
        isObserving = false
    }
    
    func performManualSync() {
        stopObserving()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.startObserving()
        }
    }
    
    private func checkPermissions() {
        canRequestPermissions = true
    }
}