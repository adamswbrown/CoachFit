import SwiftUI

// MARK: - Error Banner View
struct ErrorBannerView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        if let latestError = appState.errors.first {
            VStack(spacing: 8) {
                HStack {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(.red)
                    
                    VStack(alignment: .leading, spacing: 4) {
                        Text(latestError.message)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        if let detail = latestError.detail {
                            Text(detail)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Spacer()
                    
                    Button("Dismiss") {
                        if let index = appState.errors.firstIndex(where: { $0.id == latestError.id }) {
                            appState.errors.remove(at: index)
                        }
                    }
                    .font(.caption)
                }
                
                if appState.errors.count > 1 {
                    NavigationLink(destination: ErrorHistoryView()) {
                        Text("View \(appState.errors.count - 1) more errors")
                            .font(.caption)
                            .foregroundColor(.blue)
                    }
                }
            }
            .padding()
            .background(Color.red.opacity(0.1))
            .cornerRadius(8)
            .padding(.horizontal)
        }
    }
}

// MARK: - Sync Status View
struct SyncStatusView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Image(systemName: syncStatusIcon)
                    .foregroundColor(syncStatusColor)
                
                Text(syncStatusText)
                    .font(.headline)
                
                Spacer()
            }
            
            if let lastSync = appState.lastSyncTime {
                HStack {
                    Text("Last sync: \(lastSync, formatter: dateFormatter)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
        .padding(.horizontal)
    }
    
    private var syncStatusIcon: String {
        switch appState.syncStatus {
        case .idle:
            return "checkmark.circle.fill"
        case .pairing:
            return "link.circle.fill"
        case .syncing:
            return "arrow.clockwise.circle.fill"
        case .error(_):
            return "xmark.circle.fill"
        }
    }
    
    private var syncStatusColor: Color {
        switch appState.syncStatus {
        case .idle:
            return .green
        case .pairing, .syncing:
            return .blue
        case .error(_):
            return .red
        }
    }
    
    private var syncStatusText: String {
        switch appState.syncStatus {
        case .idle:
            return "Ready"
        case .pairing:
            return "Pairing..."
        case .syncing:
            return "Syncing..."
        case .error(let message):
            return "Error: \(message)"
        }
    }
    
    private var dateFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }
}

// MARK: - HealthKit Permission Status View
struct HealthKitPermissionStatusView: View {
    @EnvironmentObject var healthKitManager: HealthKitManager
    
    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Image(systemName: healthKitManager.hasPermissions ? "heart.fill" : "heart")
                    .foregroundColor(healthKitManager.hasPermissions ? .red : .gray)
                
                Text("HealthKit Permissions")
                    .font(.headline)
                
                Spacer()
                
                Text(healthKitManager.hasPermissions ? "Granted" : "Not Granted")
                    .font(.subheadline)
                    .foregroundColor(healthKitManager.hasPermissions ? .green : .orange)
            }
            
            if healthKitManager.isObserving {
                HStack {
                    Image(systemName: "eye.fill")
                        .foregroundColor(.blue)
                    
                    Text("Observing HealthKit changes")
                        .font(.caption)
                        .foregroundColor(.blue)
                    
                    Spacer()
                }
            }
        }
        .padding()
        .background(Color.blue.opacity(0.1))
        .cornerRadius(8)
        .padding(.horizontal)
    }
}

// MARK: - Dev Controls View
struct DevControlsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 15) {
            Text("Developer Controls")
                .font(.headline)
                .foregroundColor(.orange)
            
            VStack(spacing: 10) {
                Button("Reset Pairing") {
                    appState.clearClientId()
                }
                .foregroundColor(.red)
                
                NavigationLink(destination: ErrorHistoryView()) {
                    Text("Error History (\(appState.errors.count))")
                }
                
                NavigationLink(destination: SyncDiagnosticsPanelView()) {
                    Text("Sync Diagnostics")
                }
                
                Button("Clear Error History") {
                    appState.clearErrors()
                }
                .foregroundColor(.orange)
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(8)
        .padding(.horizontal)
    }
}

// MARK: - Error History View
struct ErrorHistoryView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        List {
            if appState.errors.isEmpty {
                Text("No errors recorded")
                    .foregroundColor(.secondary)
                    .italic()
            } else {
                ForEach(appState.errors) { error in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(error.category.rawValue)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(categoryColor(error.category))
                                .foregroundColor(.white)
                                .cornerRadius(4)
                            
                            Spacer()
                            
                            Text(error.timestamp, formatter: timeFormatter)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        Text(error.message)
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        if let detail = error.detail {
                            Text(detail)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        if let context = error.context, !context.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Context:")
                                    .font(.caption)
                                    .fontWeight(.medium)
                                
                                ForEach(context.sorted(by: { $0.key < $1.key }), id: \.key) { key, value in
                                    Text("\(key): \(value)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .onDelete(perform: deleteErrors)
            }
        }
        .navigationTitle("Error History")
        .navigationBarItems(trailing: clearButton)
    }
    
    private var clearButton: some View {
        Button("Clear All") {
            appState.clearErrors()
        }
        .foregroundColor(.red)
    }
    
    private var timeFormatter: DateFormatter {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .medium
        return formatter
    }
    
    private func categoryColor(_ category: AppError.ErrorCategory) -> Color {
        switch category {
        case .pairing:
            return .blue
        case .healthkit:
            return .red
        case .sync:
            return .green
        case .network:
            return .orange
        case .validation:
            return .purple
        }
    }
    
    private func deleteErrors(offsets: IndexSet) {
        appState.errors.remove(atOffsets: offsets)
    }
}

// MARK: - Sync Diagnostics Panel View
struct SyncDiagnosticsPanelView: View {
    @State private var diagnosticsText: String = "Loading diagnostics..."
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 15) {
                Text("Sync Diagnostics")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text(diagnosticsText)
                    .font(.system(.caption, design: .monospaced))
                    .padding()
                    .background(Color.black)
                    .foregroundColor(.green)
                    .cornerRadius(8)
                
                Button("Refresh Diagnostics") {
                    loadDiagnostics()
                }
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(8)
                
                Spacer()
            }
            .padding()
        }
        .navigationTitle("Diagnostics")
        .onAppear {
            loadDiagnostics()
        }
    }
    
    private func loadDiagnostics() {
        var output = ""
        
        output += "=== GymDashSync Diagnostics ===\n"
        output += "Timestamp: \(Date())\n\n"
        
        // Client ID info
        if let clientId = UserDefaults.standard.string(forKey: "gym_dash_client_id") {
            output += "Client ID: \(clientId)\n"
            output += "Pairing Status: ✓ Paired\n"
        } else {
            output += "Pairing Status: ✗ Not Paired\n"
        }
        
        output += "\n=== Backend Connection ===\n"
        output += "Backend URL: http://localhost:3000\n"
        
        // Test backend connection
        output += "Testing connection...\n"
        
        // HealthKit status
        output += "\n=== HealthKit Status ===\n"
        output += "HealthKit Available: \(HKHealthStore.isHealthDataAvailable())\n"
        
        let healthStore = HKHealthStore()
        let typesToCheck: [HKObjectType] = [
            HKWorkoutType.workoutType(),
            HKQuantityType.quantityType(forIdentifier: .height)!,
            HKQuantityType.quantityType(forIdentifier: .bodyMass)!,
            HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage)!
        ]
        
        for type in typesToCheck {
            let status = healthStore.authorizationStatus(for: type)
            let statusString = authorizationStatusString(status)
            output += "\(type): \(statusString)\n"
        }
        
        output += "\n=== HDSManager Status ===\n"
        let manager = HDSManagerFactory.manager()
        output += "Observers Count: \(manager.allObservers.count)\n"
        
        for (index, observer) in manager.allObservers.enumerated() {
            output += "Observer \(index + 1): \(observer.externalObjectType)\n"
        }
        
        diagnosticsText = output
    }
    
    private func authorizationStatusString(_ status: HKAuthorizationStatus) -> String {
        switch status {
        case .notDetermined:
            return "Not Determined"
        case .sharingDenied:
            return "Denied"
        case .sharingAuthorized:
            return "Authorized"
        @unknown default:
            return "Unknown"
        }
    }
}

// MARK: - Settings View
struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        List {
            Section("App Settings") {
                Toggle("Developer Mode", isOn: $appState.isDevMode)
            }
            
            Section("Pairing Info") {
                if let clientId = appState.clientId {
                    Text("Client ID: \(clientId)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                } else {
                    Text("Not paired")
                        .foregroundColor(.orange)
                }
            }
            
            Section("Actions") {
                Button("Reset All Data") {
                    appState.clearClientId()
                    appState.clearErrors()
                }
                .foregroundColor(.red)
            }
        }
        .navigationTitle("Settings")
    }
}