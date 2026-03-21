import SwiftUI

struct CreditsView: View {
    @Environment(AppState.self) private var appState

    @State private var service: CreditsService?
    @State private var showPurchaseSheet = false

    var body: some View {
        ZStack {
            Color(hex: "#111111")
                .ignoresSafeArea()

            if let service {
                contentView(service)
            } else {
                ProgressView()
            }
        }
        .navigationTitle("Credits")
        .navigationBarTitleDisplayMode(.large)
        .sheet(isPresented: $showPurchaseSheet) {
            if let service {
                PurchaseRequestView(service: service)
            }
        }
        .task {
            let s = CreditsService(api: appState.apiClient)
            service = s
            s.isLoading = true
            async let b: () = s.fetchBalance()
            async let l: () = s.fetchLedger(page: 1)
            async let p: () = s.fetchProducts()
            _ = await (b, l, p)
            s.isLoading = false
        }
    }

    @ViewBuilder
    private func contentView(_ service: CreditsService) -> some View {
        ScrollView {
            VStack(spacing: 24) {
                // MARK: - Error Banner
                if let error = service.errorMessage {
                    errorBanner(error) {
                        service.errorMessage = nil
                    }
                }

                // MARK: - Hero Balance
                balanceHero(service)

                // MARK: - Get More Credits
                Button {
                    showPurchaseSheet = true
                } label: {
                    Label("Get More Credits", systemImage: "plus.circle.fill")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal)

                // MARK: - Transaction History
                transactionHistory(service)
            }
            .padding(.bottom, 32)
        }
        .refreshable {
            service.errorMessage = nil
            async let b: () = service.fetchBalance()
            async let l: () = service.fetchLedger(page: 1)
            _ = await (b, l)
        }
    }

    // MARK: - Balance Hero

    private func balanceHero(_ service: CreditsService) -> some View {
        VStack(spacing: 8) {
            Image(systemName: "creditcard.fill")
                .font(.system(size: 36))
                .foregroundStyle(Color.accentColor)

            if service.isLoading {
                ProgressView()
                    .frame(height: 60)
            } else {
                Text("\(service.balance)")
                    .font(.system(size: 56, weight: .bold, design: .rounded))
                    .contentTransition(.numericText())
            }

            Text("credits")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 32)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(hex: "#1c1c1e"))
        )
        .padding(.horizontal)
        .padding(.top, 8)
    }

    // MARK: - Transaction History

    @ViewBuilder
    private func transactionHistory(_ service: CreditsService) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Activity")
                .font(.title3.bold())
                .padding(.horizontal)

            if service.ledgerEntries.isEmpty && !service.isLoading {
                emptyState
            } else {
                LazyVStack(spacing: 0) {
                    ForEach(service.ledgerEntries) { entry in
                        LedgerRow(entry: entry)

                        if entry.id != service.ledgerEntries.last?.id {
                            Divider()
                                .padding(.leading, 52)
                        }
                    }

                    // Load more on scroll
                    if service.currentPage < service.totalPages {
                        ProgressView()
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding()
                            .task {
                                await service.fetchLedger(page: service.currentPage + 1)
                            }
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(hex: "#1c1c1e"))
                )
                .padding(.horizontal)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "creditcard")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text("No credits yet \u{2014} request a top-up from your coach")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
        .background(
            RoundedRectangle(cornerRadius: 12)
                .fill(Color(hex: "#1c1c1e"))
        )
        .padding(.horizontal)
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String, dismiss: @escaping () -> Void) -> some View {
        HStack {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.subheadline)
                .lineLimit(2)
            Spacer()
            Button { dismiss() } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 10)
                .fill(Color.yellow.opacity(0.15))
        )
        .padding(.horizontal)
    }
}

// MARK: - Ledger Row

private struct LedgerRow: View {
    let entry: CreditsService.LedgerEntry

    private var isCredit: Bool { entry.deltaCredits > 0 }

    private var icon: String {
        isCredit ? "arrow.up.circle.fill" : "arrow.down.circle.fill"
    }

    private var iconColor: Color {
        isCredit ? .green : .red
    }

    private var reasonLabel: String {
        switch entry.reason {
        case "BOOKING_DEBIT": return "Class Booking"
        case "REFUND": return "Booking Refund"
        case "PACK_PURCHASE":
            if let name = entry.creditProduct?.name {
                return "Credit Pack \u{2014} \(name)"
            }
            return "Credit Pack"
        case "MANUAL_ADJUSTMENT": return "Coach Adjustment"
        case "SUBSCRIPTION_TOPUP": return "Subscription Top-up"
        default: return entry.reason.replacingOccurrences(of: "_", with: " ").capitalized
        }
    }

    private var deltaText: String {
        isCredit ? "+\(entry.deltaCredits)" : "\(entry.deltaCredits)"
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(iconColor)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(reasonLabel)
                    .font(.subheadline.weight(.medium))
                Text(entry.createdAt, style: .date)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Text(deltaText)
                .font(.headline.monospacedDigit())
                .foregroundStyle(isCredit ? .green : .red)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
    }
}
