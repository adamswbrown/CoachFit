import SwiftUI

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
                    .onChange(of: pairingCode) { newValue in
                        if errorMessage != nil {
                            errorMessage = nil
                        }
                    }
                
                if let errorMessage = errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.caption)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
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
                    .background(pairingCode.isEmpty || isLoading ? Color.gray : Color.blue)
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
                    
                    VStack(spacing: 5) {
                        Text("Backend: http://localhost:3000")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        
                        Button("Use Test Code") {
                            pairingCode = "TEST01"
                        }
                        .font(.caption)
                        .foregroundColor(.blue)
                    }
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
        let trimmedCode = pairingCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        
        guard !trimmedCode.isEmpty else { return }
        
        isLoading = true
        errorMessage = nil
        appState.updateSyncStatus(.pairing)
        
        NetworkService.shared.pair(pairingCode: trimmedCode) { result in
            DispatchQueue.main.async {
                self.isLoading = false
                self.appState.updateSyncStatus(.idle)
                
                switch result {
                case .success(let response):
                    self.appState.saveClientId(response.clientId)
                    self.errorMessage = nil
                    
                case .failure(let error):
                    self.errorMessage = self.friendlyErrorMessage(for: error)
                    
                    let appError = AppError(
                        category: .pairing,
                        message: "Pairing failed",
                        detail: error.localizedDescription,
                        context: ["pairing_code": trimmedCode]
                    )
                    self.appState.addError(appError)
                }
            }
        }
    }
    
    private func friendlyErrorMessage(for error: NetworkService.NetworkError) -> String {
        switch error {
        case .httpError(404, _):
            return "Invalid pairing code. Please check with your coach."
        case .httpError(let code, _):
            return "Server error (\(code)). Please try again."
        case .networkError(_):
            return "Network connection failed. Check your connection."
        case .invalidURL:
            return "Invalid backend URL configuration."
        case .noData, .decodingError(_):
            return "Invalid response from server."
        }
    }
}