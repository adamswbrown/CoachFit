import SwiftUI

struct HealthKitStep: View {
    @Environment(AppState.self) private var appState
    @Binding var connected: Bool
    let onNext: () -> Void
    let onSkip: () -> Void

    @State private var isRequesting = false

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "heart.text.square.fill")
                .font(.system(size: 80))
                .foregroundStyle(.red)

            VStack(spacing: 12) {
                Text("Connect Apple Health")
                    .font(.title.bold())

                Text("Automatically share your steps, workouts, sleep, and heart rate with your coach. No manual logging needed.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            // Data types preview
            VStack(spacing: 8) {
                ForEach(["Steps & Distance", "Workouts & Calories", "Sleep & Heart Rate", "Weight & Body Metrics"], id: \.self) { item in
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                        Text(item)
                        Spacer()
                    }
                    .padding(.horizontal, 32)
                }
            }

            Spacer()

            VStack(spacing: 12) {
                if connected {
                    Label("Connected", systemImage: "checkmark.circle.fill")
                        .font(.headline)
                        .foregroundStyle(.green)

                    Button(action: onNext) {
                        Text("Continue")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                } else {
                    Button {
                        Task {
                            isRequesting = true
                            do {
                                try await appState.healthKit.requestAuthorization()
                                connected = true
                            } catch {
                                // User denied or error — they can connect later
                            }
                            isRequesting = false
                        }
                    } label: {
                        if isRequesting {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Label("Connect Apple Health", systemImage: "heart.fill")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(isRequesting)

                    Button("Maybe Later", action: onSkip)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
    }
}
