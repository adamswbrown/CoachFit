import SwiftUI

struct PurchaseRequestView: View {
    @Environment(\.dismiss) private var dismiss
    var service: CreditsService

    @State private var selectedProduct: CreditsService.CreditProduct?
    @State private var note = ""
    @State private var isSubmitting = false
    @State private var submitSuccess = false
    @State private var submitError: String?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#111111")
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        if let error = submitError {
                            errorBanner(error)
                        }

                        if submitSuccess {
                            successView
                        } else if let product = selectedProduct {
                            confirmationView(product)
                        } else {
                            productList
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("Credit Packs")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    // MARK: - Product List

    private var productList: some View {
        VStack(spacing: 12) {
            if service.products.isEmpty {
                VStack(spacing: 12) {
                    Image(systemName: "tray")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text("No credit packs available")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
            } else {
                ForEach(service.products) { product in
                    CreditProductCard(product: product) {
                        withAnimation {
                            selectedProduct = product
                        }
                    }
                }
            }
        }
    }

    // MARK: - Confirmation View

    private func confirmationView(_ product: CreditsService.CreditProduct) -> some View {
        VStack(spacing: 20) {
            // Selected product summary
            VStack(spacing: 8) {
                Text(product.name)
                    .font(.title2.bold())

                if let credits = product.creditsPerPeriod {
                    Text("\(credits) credits")
                        .font(.headline)
                        .foregroundStyle(Color.accentColor)
                }

                if let price = product.purchasePriceGbp {
                    Text(Self.formatPrice(price))
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color(hex: "#1c1c1e"))
            )

            // Note field
            VStack(alignment: .leading, spacing: 8) {
                Text("Note (optional)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                TextField("e.g. Paid via Revolut", text: $note)
                    .textFieldStyle(.roundedBorder)
            }

            // Submit button
            Button {
                Task { await submitRequest(product) }
            } label: {
                if isSubmitting {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                } else {
                    Text("Submit Request")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isSubmitting)

            // Back button
            Button {
                withAnimation {
                    selectedProduct = nil
                    submitError = nil
                }
            } label: {
                Text("Choose a different pack")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Success View

    private var successView: some View {
        VStack(spacing: 20) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)

            Text("Request submitted!")
                .font(.title2.bold())

            Text("Your coach will review it shortly.")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Button {
                dismiss()
            } label: {
                Text("Done")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.borderedProminent)
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.subheadline)
                .lineLimit(2)
            Spacer()
            Button { submitError = nil } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.yellow.opacity(0.15))
        )
    }

    // MARK: - Submit

    private func submitRequest(_ product: CreditsService.CreditProduct) async {
        isSubmitting = true
        submitError = nil

        do {
            try await service.submitPurchaseRequest(
                productId: product.id,
                note: note.isEmpty ? nil : note
            )
            withAnimation {
                submitSuccess = true
            }
        } catch {
            submitError = error.localizedDescription
        }

        isSubmitting = false
    }

    // MARK: - Formatting

    private static func formatPrice(_ price: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "GBP"
        formatter.locale = Locale(identifier: "en_GB")
        return formatter.string(from: NSNumber(value: price)) ?? "\u{00a3}\(String(format: "%.2f", price))"
    }
}
