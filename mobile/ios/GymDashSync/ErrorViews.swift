import SwiftUI

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
                                .lineLimit(2)
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
            }
            .padding()
            .background(Color.red.opacity(0.1))
            .cornerRadius(8)
            .padding(.horizontal)
        }
    }
}

struct SyncStatusView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var healthDataManager: HealthDataManager
    
    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Image(systemName: syncStatusIcon)
                    .foregroundColor(syncStatusColor)
                
                VStack(alignment: .leading, spacing: 2) {
                    Text(syncStatusText)
                        .font(.headline)
                    
                    if let summary = appState.lastSyncSummary {
                        Text("Last: \(summary.workoutsIngested)w, \(summary.profileMetricsIngested)p, \(summary.workoutsDuplicated)d")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
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
        .background(syncStatusColor.opacity(0.1))
        .cornerRadius(8)
        .padding(.horizontal)
    }
    
    private var syncStatusIcon: String {
        switch appState.syncStatus {
        case .idle:
            return healthDataManager.isObserving ? "checkmark.circle.fill" : "pause.circle.fill"
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
            return healthDataManager.isObserving ? .green : .orange
        case .pairing, .syncing:
            return .blue
        case .error(_):
            return .red
        }
    }
    
    private var syncStatusText: String {
        switch appState.syncStatus {
        case .idle:
            return healthDataManager.isObserving ? "Observing" : "Ready"
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

struct HealthKitPermissionStatusView: View {
    @EnvironmentObject var healthDataManager: HealthDataManager
    
    var body: some View {
        VStack(spacing: 10) {
            HStack {
                Image(systemName: healthDataManager.hasPermissions ? "heart.fill" : "heart")
                    .foregroundColor(healthDataManager.hasPermissions ? .red : .gray)
                
                Text("HealthKit Permissions")
                    .font(.headline)
                
                Spacer()
                
                Text(healthDataManager.hasPermissions ? "Granted" : "Not Granted")
                    .font(.subheadline)
                    .foregroundColor(healthDataManager.hasPermissions ? .green : .orange)
            }
            
            if healthDataManager.isObserving {
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