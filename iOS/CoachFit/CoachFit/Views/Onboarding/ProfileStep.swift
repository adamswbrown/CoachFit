import SwiftUI

struct ProfileStep: View {
    @Binding var heightCm: String
    @Binding var weightKg: String
    @Binding var activityLevel: String?
    let onNext: () -> Void
    let onSkip: () -> Void

    private let levels = [
        ("Sedentary", "sedentary"),
        ("Moderate", "moderate"),
        ("Active", "active"),
    ]

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            Text("Quick Profile")
                .font(.title.bold())

            Text("This helps your coach set targets. You can skip this for now.")
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            VStack(spacing: 16) {
                HStack {
                    Text("Height (cm)")
                        .foregroundStyle(.secondary)
                    Spacer()
                    TextField("175", text: $heightCm)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
                .padding()
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))

                HStack {
                    Text("Weight (kg)")
                        .foregroundStyle(.secondary)
                    Spacer()
                    TextField("70", text: $weightKg)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
                .padding()
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Activity Level")
                        .foregroundStyle(.secondary)

                    HStack(spacing: 8) {
                        ForEach(levels, id: \.1) { label, value in
                            Button {
                                activityLevel = value
                            } label: {
                                Text(label)
                                    .font(.subheadline.weight(.medium))
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 10)
                                    .background(
                                        Capsule()
                                            .fill(activityLevel == value ? Color.accentColor : Color(.systemGray6))
                                    )
                                    .foregroundStyle(activityLevel == value ? .white : .primary)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 24)

            Spacer()

            VStack(spacing: 12) {
                Button(action: onNext) {
                    Text("Continue")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button("Skip for now", action: onSkip)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 32)
            .padding(.bottom, 48)
        }
    }
}
