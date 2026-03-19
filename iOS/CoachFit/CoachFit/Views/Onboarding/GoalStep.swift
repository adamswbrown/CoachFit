import SwiftUI

struct GoalStep: View {
    @Binding var selectedGoal: String?
    let onNext: () -> Void

    private let goals = [
        ("scale.3d", "Lose Weight", "lose_weight"),
        ("figure.strengthtraining.traditional", "Build Muscle", "build_muscle"),
        ("carrot.fill", "Eat Healthier", "eat_healthier"),
        ("heart.fill", "Improve Health", "improve_health"),
    ]

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("What's your primary goal?")
                .font(.title.bold())

            Text("Your coach will use this to personalize your plan.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            VStack(spacing: 12) {
                ForEach(goals, id: \.2) { icon, label, value in
                    Button {
                        selectedGoal = value
                    } label: {
                        HStack(spacing: 16) {
                            Image(systemName: icon)
                                .font(.title2)
                                .frame(width: 32)
                            Text(label)
                                .font(.headline)
                            Spacer()
                            if selectedGoal == value {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundStyle(.accent)
                            }
                        }
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .fill(selectedGoal == value ? Color.accentColor.opacity(0.1) : Color(.systemGray6))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(selectedGoal == value ? Color.accentColor : Color.clear, lineWidth: 2)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 24)

            Spacer()

            Button(action: onNext) {
                Text("Continue")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(selectedGoal == nil)
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
    }
}
