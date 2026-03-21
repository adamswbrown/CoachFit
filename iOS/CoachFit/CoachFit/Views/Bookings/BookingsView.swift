import SwiftUI

struct BookingsView: View {
    @Environment(AppState.self) private var appState

    @State private var bookingService: BookingService?
    @State private var selectedSegment: BookingSegment = .upcoming

    enum BookingSegment: String, CaseIterable {
        case upcoming = "Upcoming"
        case past = "Past"
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Color(hex: "#111111")
                    .ignoresSafeArea()

                if let service = bookingService {
                    VStack(spacing: 0) {
                        // Error banner
                        if let error = service.errorMessage {
                            errorBanner(error)
                        }

                        // Segmented picker
                        Picker("Segment", selection: $selectedSegment) {
                            ForEach(BookingSegment.allCases, id: \.self) { segment in
                                Text(segment.rawValue).tag(segment)
                            }
                        }
                        .pickerStyle(.segmented)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)

                        // Booking list
                        bookingList(service)
                    }
                } else {
                    ProgressView()
                        .tint(.white)
                }
            }
            .navigationTitle("Bookings")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    CreditBalancePillView(balance: bookingService?.creditBalance ?? 0)
                }
            }
            .task {
                if bookingService == nil {
                    bookingService = BookingService(api: appState.apiClient)
                }
                await loadData()
            }
            .refreshable {
                await loadData()
            }
        }
    }

    // MARK: - Subviews

    @ViewBuilder
    private func bookingList(_ service: BookingService) -> some View {
        let bookings = selectedSegment == .upcoming
            ? service.upcomingBookings
            : service.pastBookings

        if service.isLoading && bookings.isEmpty {
            Spacer()
            ProgressView()
                .tint(.white)
            Spacer()
        } else if bookings.isEmpty {
            Spacer()
            emptyState
            Spacer()
        } else {
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(bookings) { booking in
                        BookingRowView(
                            booking: booking,
                            isUpcoming: selectedSegment == .upcoming,
                            onCancel: { await cancelBooking(booking) }
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Image(systemName: selectedSegment == .upcoming ? "calendar.badge.clock" : "clock.arrow.circlepath")
                .font(.system(size: 40))
                .foregroundStyle(.secondary)

            Text(selectedSegment == .upcoming
                 ? "You haven't booked any classes yet"
                 : "No past bookings")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(32)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.caption)
                .foregroundStyle(.white)
            Spacer()
            Button {
                withAnimation { bookingService?.errorMessage = nil }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(10)
        .background(Color.red.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal, 16)
        .padding(.top, 4)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Actions

    private func loadData() async {
        guard let service = bookingService else { return }
        async let bookings: () = service.fetchBookings()
        async let balance: () = service.fetchBalance()
        _ = await (bookings, balance)
    }

    private func cancelBooking(_ booking: ClientBooking) async {
        guard let service = bookingService else { return }
        do {
            let result = try await service.cancelBooking(bookingId: booking.id)

            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.warning)

            withAnimation(.easeInOut(duration: 0.3)) {
                service.upcomingBookings.removeAll { $0.id == booking.id }
            }

            if result.refunded {
                service.errorMessage = nil
                showBanner("Cancelled \u{2014} credit refunded")
            } else {
                showBanner("Cancelled \u{2014} no refund (late cancel)")
            }

            await service.fetchBalance()
        } catch {
            withAnimation {
                service.errorMessage = error.localizedDescription
            }
        }
    }

    private func showBanner(_ message: String) {
        withAnimation { bookingService?.errorMessage = message }
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation { bookingService?.errorMessage = nil }
        }
    }
}

// MARK: - Credit Balance Pill

private struct CreditBalancePillView: View {
    let balance: Int

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "star.circle.fill")
                .font(.caption)
            Text("\(balance)")
                .font(.caption.weight(.semibold))
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(Color(hex: "#452ddb").opacity(0.6))
        .clipShape(Capsule())
    }
}
