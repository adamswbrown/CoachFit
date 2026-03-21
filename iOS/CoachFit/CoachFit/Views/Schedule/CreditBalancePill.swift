import SwiftUI

struct CreditBalancePill: View {
    let balance: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "creditcard.fill")
                .font(.caption)
            Text("\(balance)")
                .font(.subheadline.bold())
            Text("credits")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(Color(hex: "#1c1c1e"), in: Capsule())
    }
}
