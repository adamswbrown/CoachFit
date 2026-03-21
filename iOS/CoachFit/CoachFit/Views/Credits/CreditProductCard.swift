import SwiftUI

struct CreditProductCard: View {
    let product: CreditsService.CreditProduct
    let onRequestPurchase: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Product name
            Text(product.name)
                .font(.title3.bold())

            // Credits amount
            if let credits = product.creditsPerPeriod {
                Label("\(credits) credits", systemImage: "tag.fill")
                    .font(.subheadline)
                    .foregroundStyle(Color.accentColor)
            }

            // Price
            if let price = product.purchasePriceGbp {
                Text(priceString(price))
                    .font(.headline)
            }

            // Description
            if let description = product.description, !description.isEmpty {
                Text(description)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            // Class type badges
            if !product.appliesToClassTypes.isEmpty {
                HStack(spacing: 6) {
                    ForEach(product.appliesToClassTypes, id: \.self) { classType in
                        Text(classType)
                            .font(.caption2.weight(.semibold))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(classColor(for: classType).opacity(0.2), in: Capsule())
                            .foregroundStyle(classColor(for: classType))
                    }
                }
            }

            // Purchase button
            Button(action: onRequestPurchase) {
                Text("Request Purchase")
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "#1c1c1e"))
        )
    }

    private func priceString(_ price: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "GBP"
        formatter.locale = Locale(identifier: "en_GB")
        return formatter.string(from: NSNumber(value: price)) ?? "\u{00a3}\(String(format: "%.2f", price))"
    }
}

// MARK: - Class Color Helper

private func classColor(for classType: String) -> Color {
    switch classType.uppercased() {
    case "HIIT": return Color(hex: "#452ddb")
    case "CORE": return Color(hex: "#f2de24")
    case "STRENGTH": return Color(hex: "#22c55e")
    default: return .gray
    }
}
