import SwiftUI

struct FoodTrackingStep: View {
    let onNext: () -> Void

    var body: some View {
        VStack(spacing: 32) {
            Spacer()

            Image(systemName: "barcode.viewfinder")
                .font(.system(size: 80))
                .foregroundStyle(.accent)

            VStack(spacing: 12) {
                Text("Scan to Track")
                    .font(.title.bold())

                Text("Point your camera at any food barcode to instantly log nutrition. Your coach can see your food log and help you stay on track.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)
            }

            // Visual preview of what it looks like
            VStack(spacing: 8) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Greek Yogurt")
                            .font(.headline)
                        Text("Chobani")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Text("130 cal")
                        .font(.title3.bold())
                        .foregroundStyle(.accent)
                }
                .padding()
                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
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
