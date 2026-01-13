import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var healthDataManager: HealthDataManager
    
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
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    NavigationLink(destination: SettingsView()) {
                        Image(systemName: "gear")
                    }
                }
            }
        }
        .navigationViewStyle(StackNavigationViewStyle())
    }
}

struct MainView: View {
    @EnvironmentObject var appState: AppState
    @EnvironmentObject var healthDataManager: HealthDataManager
    
    var body: some View {
        VStack(spacing: 20) {
            ErrorBannerView()
            SyncStatusView()
            HealthKitPermissionStatusView()
            
            VStack(spacing: 15) {
                Button("Request HealthKit Permissions") {
                    healthDataManager.requestPermissions()
                }
                .disabled(!healthDataManager.canRequestPermissions || healthDataManager.hasPermissions)
                .buttonStyle(PrimaryButtonStyle())
                
                Button("Start Sync") {
                    healthDataManager.startObserving()
                }
                .disabled(!healthDataManager.hasPermissions || healthDataManager.isObserving)
                .buttonStyle(PrimaryButtonStyle())
                
                Button("Stop Sync") {
                    healthDataManager.stopObserving()
                }
                .disabled(!healthDataManager.isObserving)
                .buttonStyle(SecondaryButtonStyle())
                
                Button("Manual Sync") {
                    healthDataManager.performManualSync()
                }
                .disabled(!healthDataManager.hasPermissions)
                .buttonStyle(SecondaryButtonStyle())
            }
            
            if appState.isDevMode {
                DevControlsView()
            }
            
            Spacer()
        }
        .padding()
    }
}

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        List {
            Section(header: Text("App Settings")) {
                Toggle("Developer Mode", isOn: $appState.isDevMode)
            }
            
            Section(header: Text("Pairing Info")) {
                if let clientId = appState.clientId {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Status: Paired")
                            .foregroundColor(.green)
                        Text("Client ID")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(clientId)
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                } else {
                    Text("Status: Not Paired")
                        .foregroundColor(.orange)
                }
            }
            
            Section(header: Text("Actions")) {
                Button("Reset Pairing") {
                    appState.clearClientId()
                }
                .foregroundColor(.red)
                
                Button("Clear Error History") {
                    appState.clearErrors()
                }
                .foregroundColor(.orange)
            }
        }
        .navigationTitle("Settings")
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding()
            .background(configuration.isPressed ? Color.blue.opacity(0.7) : Color.blue)
            .foregroundColor(.white)
            .cornerRadius(10)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

struct SecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(maxWidth: .infinity)
            .padding()
            .background(configuration.isPressed ? Color.gray.opacity(0.7) : Color.gray.opacity(0.2))
            .foregroundColor(.primary)
            .cornerRadius(10)
            .scaleEffect(configuration.isPressed ? 0.95 : 1.0)
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
        .environmentObject(HealthDataManager())
}