import SwiftUI

struct WelcomeStep: View {
    let coachName: String
    let onNext: () -> Void

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "figure.run.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.accent)

            VStack(spacing: 12) {
                Text("Welcome to CoachFit!")
                    .font(.largeTitle.bold())

                Text("You're now connected with **\(coachName)**. Let's get you set up in under a minute.")
                    .font(.title3)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            Spacer()

            Button(action: onNext) {
                Text("Let's Go")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
    }
}
