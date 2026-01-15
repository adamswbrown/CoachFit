import SwiftUI
import Foundation

struct PairingView: View {
    @EnvironmentObject var appState: AppState
    @State private var pairingCode: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    
    var body: some View {
        VStack(spacing: 30) {
            VStack(spacing: 15) {
                Image(systemName: "link.circle")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)
                
                Text("Pair Device")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Enter the pairing code provided by your coach to connect this device to your account.")
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
                    .padding(.horizontal)
            }
            
            VStack(spacing: 15) {
                TextField("Pairing Code", text: $pairingCode)
                    .textFieldStyle(RoundedBorderTextFieldStyle())
                    .autocapitalization(.allCharacters)
                    .disableAutocorrection(true)
                    .font(.system(.title2, design: .monospaced))
                    .multilineTextAlignment(.center)
                
                if let errorMessage = errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                }
                
                Button(action: performPairing) {
                    HStack {
                        if isLoading {
                            ProgressView()
                                .scaleEffect(0.8)
                        }
                        Text(isLoading ? "Pairing..." : "Pair Device")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(pairingCode.isEmpty ? Color.gray : Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .disabled(pairingCode.isEmpty || isLoading)
            }
            .padding(.horizontal)
            
            if appState.isDevMode {
                VStack(spacing: 10) {
                    Text("Developer Mode")
                        .font(.headline)
                        .foregroundColor(.orange)
                    
                    Text("Backend: http://localhost:3000")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    
                    Button("Use Test Code") {
                        pairingCode = "TEST01"
                    }
                    .font(.caption)
                    .foregroundColor(.blue)
                }
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(10)
                .padding(.horizontal)
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func performPairing() {
        guard !pairingCode.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return
        }
        
        isLoading = true
        errorMessage = nil
        appState.syncStatus = .pairing
        
        NetworkService.shared.pair(pairingCode: pairingCode.uppercased()) { result in
            DispatchQueue.main.async {
                self.isLoading = false
                self.appState.syncStatus = .idle
                
                switch result {
                case .success(let response):
                    self.appState.saveClientId(response.clientId)
                    self.errorMessage = nil
                case .failure(let error):
                    self.errorMessage = error.localizedDescription
                    let appError = AppError(
                        category: .pairing,
                        message: "Pairing failed",
                        detail: error.localizedDescription,
                        context: ["pairing_code": self.pairingCode]
                    )
                    self.appState.addError(appError)
                }
            }
        }
    }
}

#Preview {
    PairingView()
        .environmentObject(AppState())
}