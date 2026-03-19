import SwiftUI

struct CheckInStep: View {
    let onNext: () -> Void

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 80))
                .foregroundStyle(.tint)

            VStack(spacing: 12) {
                Text("Daily Check-In")
                    .font(.title.bold())

                Text("Each day, share a quick snapshot with your coach: weight, sleep quality, stress level, and a note. It takes about 30 seconds.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            // Preview of check-in items
            VStack(spacing: 12) {
                CheckInPreviewRow(icon: "scalemass", label: "Weight", example: "75.2 kg")
                CheckInPreviewRow(icon: "moon.zzz", label: "Sleep Quality", example: "8/10")
                CheckInPreviewRow(icon: "brain.head.profile", label: "Stress Level", example: "3/10")
                CheckInPreviewRow(icon: "text.bubble", label: "Notes", example: "Feeling great today!")
            }
            .padding(.horizontal, 32)

            Spacer()

            Button(action: onNext) {
                Text("Next")
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

private struct CheckInPreviewRow: View {
    let icon: String
    let label: String
    let example: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.tint)
                .frame(width: 24)
            Text(label)
            Spacer()
            Text(example)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
    }
}
