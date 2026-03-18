import SwiftUI

struct PairingView: View {
    @Environment(AppState.self) private var appState

    @State private var code = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.tint)

            Text("CoachFit")
                .font(.largeTitle.bold())

            Text("Enter the pairing code from your coach to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            VStack(spacing: 16) {
                TextField("Pairing code", text: $code)
                    .textFieldStyle(.roundedBorder)
                    .font(.title2.monospaced())
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .onChange(of: code) { _, newValue in
                        // Limit to 8 characters
                        if newValue.count > 8 {
                            code = String(newValue.prefix(8))
                        }
                    }
                    .padding(.horizontal, 60)

                Button {
                    Task { await pairDevice() }
                } label: {
                    if isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Pair Device")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(code.count != 8 || isLoading)
                .padding(.horizontal, 60)
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            if let unpairMessage = appState.unpairMessage {
                Text(unpairMessage)
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            Spacer()
            Spacer()
        }
    }

    private func pairDevice() async {
        errorMessage = nil
        isLoading = true
        defer { isLoading = false }

        do {
            try await appState.pair(code: code)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

#Preview {
    PairingView()
        .environment(AppState())
}
