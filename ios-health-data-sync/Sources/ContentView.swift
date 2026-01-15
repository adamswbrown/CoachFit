import SwiftUI
import HealthKit

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var healthDataManager: HealthDataManager
    @StateObject private var healthKitManager = HealthKitManager()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                if !appState.isPaired {
                    PairingView()
                } else {
                    MainView()
                }
            }
            .navigationTitle("GymDashSync")
            .navigationBarItems(trailing: settingsButton)
        }
        .environmentObject(healthKitManager)
        .onAppear {
            healthKitManager.setHDSManager(healthDataManager.manager)
        }
    }
    
    private var settingsButton: some View {
        NavigationLink(destination: SettingsView()) {
            Image(systemName: "gear")
        }
    }
}

struct MainView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var healthKitManager: HealthKitManager
    
    var body: some View {
        VStack(spacing: 20) {
            ErrorBannerView()
            
            SyncStatusView()
            
            HealthKitPermissionStatusView()
            
            VStack(spacing: 15) {
                Button("Request HealthKit Permissions") {
                    healthKitManager.requestPermissions()
                }
                .disabled(!healthKitManager.canRequestPermissions)
                
                Button("Start Sync") {
                    healthKitManager.startObserving()
                }
                .disabled(!healthKitManager.hasPermissions)
                
                Button("Stop Sync") {
                    healthKitManager.stopObserving()
                }
                
                Button("Manual Sync") {
                    healthKitManager.performManualSync()
                }
                .disabled(!healthKitManager.hasPermissions)
            }
            
            if appState.isDevMode {
                DevControlsView()
            }
            
            Spacer()
        }
        .padding()
    }
}

class HealthKitManager: ObservableObject {
    @Published var hasPermissions: Bool = false
    @Published var canRequestPermissions: Bool = true
    @Published var isObserving: Bool = false
    @Published var lastSyncDate: Date? = nil
    
    private var manager: HDSManager?
    
    init() {
        checkPermissions()
    }
    
    func setHDSManager(_ manager: HDSManager) {
        self.manager = manager
    }
    
    func requestPermissions() {
        guard let manager = manager else { return }
        manager.requestPermissionsForAllObservers { [weak self] success, error in
            DispatchQueue.main.async {
                self?.hasPermissions = success
                if let error = error {
                    self?.logError(.healthkit, "Permission request failed", error.localizedDescription)
                }
            }
        }
    }
    
    func startObserving() {
        guard let manager = manager else { return }
        manager.startObserving()
        isObserving = true
    }
    
    func stopObserving() {
        guard let manager = manager else { return }
        manager.stopObserving()
        isObserving = false
    }
    
    func performManualSync() {
        // Trigger a manual sync by restarting observers
        stopObserving()
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) {
            self.startObserving()
            self.lastSyncDate = Date()
        }
    }
    
    private func checkPermissions() {
        let healthStore = HKHealthStore()
        let typesToCheck: Set<HKObjectType> = [
            HKWorkoutType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .height)!,
            HKQuantityType.quantityType(forIdentifier: .bodyMass)!,
            HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)!
        ]
        
        for type in typesToCheck {
            let status = healthStore.authorizationStatus(for: type)
            if status != .sharingAuthorized {
                hasPermissions = false
                return
            }
        }
        hasPermissions = true
    }
    
    private func logError(_ category: AppError.ErrorCategory, _ message: String, _ detail: String? = nil) {
        let error = AppError(category: category, message: message, detail: detail, context: nil)
        // Would need appState reference to log errors properly
        print("HealthKitManager Error: \(message)")
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}