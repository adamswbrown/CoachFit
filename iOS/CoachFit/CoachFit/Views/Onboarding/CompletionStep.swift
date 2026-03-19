import SwiftUI

struct CompletionStep: View {
    let coachName: String
    let goal: String?
    let healthKitConnected: Bool
    let onFinish: () -> Void

    private var goalLabel: String {
        switch goal {
        case "lose_weight": "Lose Weight"
        case "build_muscle": "Build Muscle"
        case "eat_healthier": "Eat Healthier"
        case "improve_health": "Improve Health"
        default: "Not set"
        }
    }

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 80))
                .foregroundStyle(.green)

            Text("You're All Set!")
                .font(.largeTitle.bold())

            VStack(spacing: 16) {
                SummaryRow(icon: "person.2.fill", label: "Coach", value: coachName)
                SummaryRow(icon: "target", label: "Goal", value: goalLabel)
                SummaryRow(icon: "heart.fill", label: "Apple Health",
                          value: healthKitConnected ? "Connected" : "Not connected",
                          valueColor: healthKitConnected ? .green : .secondary)
            }
            .padding(.horizontal, 32)

            Spacer()

            Button(action: onFinish) {
                Text("Start Using CoachFit")
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

private struct SummaryRow: View {
    let icon: String
    let label: String
    let value: String
    var valueColor: Color = .primary

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.tint)
                .frame(width: 24)
            Text(label)
                .foregroundStyle(.secondary)
            Spacer()
            Text(value)
                .foregroundStyle(valueColor)
                .fontWeight(.medium)
        }
        .padding()
        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
    }
}
