import SwiftUI
import ClerkKit
import ClerkKitUI

struct SignInView: View {
    @Environment(AppState.self) private var appState
    @Environment(Clerk.self) private var clerk

    var body: some View {
        Group {
            if clerk.user != nil {
                // Signed in via Clerk — registering device
                registeringView
            } else {
                // Not signed in — show Clerk auth
                authView
            }
        }
        .onChange(of: clerk.user) { _, newUser in
            if newUser != nil, appState.currentScreen == .signIn {
                Task { await appState.onClerkSignIn() }
            }
        }
        .task {
            // Handle relaunch with existing Clerk session
            if clerk.user != nil, KeychainService.deviceToken == nil {
                await appState.onClerkSignIn()
            }
        }
    }

    // MARK: - Clerk Auth View

    private var authView: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.tint)

            Text("CoachFit")
                .font(.largeTitle.bold())

            Text("Sign in with the same account you use on gcgyms.com")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            AuthView()
                .padding(.horizontal, 20)

            if let unpairMessage = appState.unpairMessage {
                Text(unpairMessage)
                    .font(.footnote)
                    .foregroundStyle(.orange)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            if let error = appState.registrationError {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 40)
            }

            Spacer()
            Spacer()
        }
    }

    // MARK: - Registering Device

    private var registeringView: some View {
        VStack(spacing: 24) {
            Spacer()

            ProgressView()
                .scaleEffect(1.5)

            Text("Setting up your device...")
                .font(.headline)

            if let user = clerk.user {
                Text("Welcome, \(user.firstName ?? user.primaryEmailAddress?.emailAddress ?? "")!")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
    }
}

#Preview {
    SignInView()
        .environment(AppState())
}
