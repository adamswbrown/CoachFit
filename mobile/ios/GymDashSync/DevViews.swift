import SwiftUI

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
                
                Button("Clear Error History") {
                    appState.clearErrors()
                }
                .foregroundColor(.orange)
                
                if appState.clientId != nil {
                    Text("Client ID: \(appState.clientId!)")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.top, 5)
                }
                
                Text("Errors: \(appState.errors.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(8)
        .padding(.horizontal)
    }
}