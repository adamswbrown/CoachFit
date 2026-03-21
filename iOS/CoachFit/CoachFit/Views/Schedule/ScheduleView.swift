import SwiftUI
import UIKit

struct ScheduleView: View {
    @Environment(AppState.self) private var appState

    @State private var classService: ClassService?
    @State private var bookingService: BookingService?
    @State private var selectedDate: Date = .now
    @State private var viewMode: ViewMode = .calendar

    enum ViewMode: String, CaseIterable {
        case calendar = "Classes"
        case bookings = "My Bookings"
    }

    private var dateStrip: [Date] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        return (0..<14).compactMap { calendar.date(byAdding: .day, value: $0, to: today) }
    }

    private var morningSessions: [ClassSession] {
        classService?.sessions.filter { hour(of: $0.startsAt) < 12 } ?? []
    }

    private var afternoonSessions: [ClassSession] {
        classService?.sessions.filter {
            let h = hour(of: $0.startsAt)
            return h >= 12 && h < 17
        } ?? []
    }

    private var eveningSessions: [ClassSession] {
        classService?.sessions.filter { hour(of: $0.startsAt) >= 17 } ?? []
    }

    private func hour(of date: Date) -> Int {
        Calendar.current.component(.hour, from: date)
    }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                Color(hex: "#111111").ignoresSafeArea()

                VStack(spacing: 0) {
                    // Segmented control
                    Picker("View", selection: $viewMode) {
                        ForEach(ViewMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue).tag(mode)
                        }
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 8)

                    switch viewMode {
                    case .calendar:
                        calendarContent
                    case .bookings:
                        bookingsContent
                    }
                }

                // Error banners
                if let errorMessage = classService?.errorMessage, viewMode == .calendar {
                    ErrorBanner(message: errorMessage) {
                        classService?.errorMessage = nil
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(100)
                }
                if let errorMessage = bookingService?.errorMessage, viewMode == .bookings {
                    ErrorBanner(message: errorMessage) {
                        bookingService?.errorMessage = nil
                    }
                    .transition(.move(edge: .top).combined(with: .opacity))
                    .zIndex(100)
                }
            }
            .navigationTitle("Schedule")
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    CreditBalancePill(balance: classService?.creditBalance ?? 0)
                }
            }
        }
        .task {
            if classService == nil {
                classService = ClassService(apiClient: appState.apiClient)
            }
            if bookingService == nil {
                bookingService = BookingService(api: appState.apiClient)
            }
            await loadCalendarData()
            await loadBookingsData()
        }
        .onChange(of: selectedDate) {
            Task { await loadCalendarData() }
        }
    }

    // MARK: - Calendar Content

    private var calendarContent: some View {
        VStack(spacing: 0) {
            dateStripView
                .padding(.vertical, 8)

            if let service = classService, service.isLoading && service.sessions.isEmpty {
                Spacer()
                ProgressView()
                    .tint(.white)
                Spacer()
            } else if let service = classService, service.sessions.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.exclamationmark")
                        .font(.largeTitle)
                        .foregroundStyle(.secondary)
                    Text("No classes today — check another day")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 16) {
                        sessionSection("Morning", sessions: morningSessions)
                        sessionSection("Afternoon", sessions: afternoonSessions)
                        sessionSection("Evening", sessions: eveningSessions)
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 24)
                }
                .refreshable {
                    await loadCalendarData()
                }
            }
        }
    }

    // MARK: - Bookings Content

    @State private var bookingSegment: BookingSegment = .upcoming

    enum BookingSegment: String, CaseIterable {
        case upcoming = "Upcoming"
        case past = "Past"
    }

    private var bookingsContent: some View {
        VStack(spacing: 0) {
            Picker("Segment", selection: $bookingSegment) {
                ForEach(BookingSegment.allCases, id: \.self) { segment in
                    Text(segment.rawValue).tag(segment)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            let bookings = bookingSegment == .upcoming
                ? (bookingService?.upcomingBookings ?? [])
                : (bookingService?.pastBookings ?? [])

            if bookingService?.isLoading == true && bookings.isEmpty {
                Spacer()
                ProgressView().tint(.white)
                Spacer()
            } else if bookings.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: bookingSegment == .upcoming ? "calendar.badge.clock" : "clock.arrow.circlepath")
                        .font(.system(size: 40))
                        .foregroundStyle(.secondary)
                    Text(bookingSegment == .upcoming
                         ? "You haven't booked any classes yet"
                         : "No past bookings")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(32)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(bookings) { booking in
                            BookingRowView(
                                booking: booking,
                                isUpcoming: bookingSegment == .upcoming,
                                onCancel: { await cancelBooking(booking) }
                            )
                        }
                    }
                    .padding(.horizontal, 16)
                    .padding(.bottom, 24)
                }
                .refreshable {
                    await loadBookingsData()
                }
            }
        }
    }

    // MARK: - Date Strip

    private var dateStripView: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(dateStrip, id: \.self) { date in
                    DatePill(
                        date: date,
                        isSelected: Calendar.current.isDate(date, inSameDayAs: selectedDate)
                    )
                    .onTapGesture {
                        selectedDate = date
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }

    // MARK: - Session Sections

    @ViewBuilder
    private func sessionSection(_ title: String, sessions: [ClassSession]) -> some View {
        if !sessions.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(title)
                    .font(.subheadline.bold())
                    .foregroundStyle(.secondary)
                    .padding(.leading, 4)

                ForEach(sessions) { session in
                    ClassCardView(
                        session: session,
                        creditBalance: classService?.creditBalance ?? 0,
                        isBooked: classService?.bookedSessionIds.contains(session.id) ?? false,
                        onBook: { sessionId in
                            _ = try await classService!.bookClass(sessionId: sessionId)
                            await classService?.fetchBalance()
                            // Refresh bookings after booking a class
                            await loadBookingsData()
                        }
                    )
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadCalendarData() async {
        guard let service = classService else { return }
        async let schedule: () = service.fetchSchedule(for: selectedDate)
        async let balance: () = service.fetchBalance()
        _ = await (schedule, balance)
    }

    private func loadBookingsData() async {
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
                showBookingBanner("Cancelled \u{2014} credit refunded")
            } else {
                showBookingBanner("Cancelled \u{2014} no refund (late cancel)")
            }

            await service.fetchBalance()
            // Also refresh credit balance in calendar view
            await classService?.fetchBalance()
        } catch {
            withAnimation {
                service.errorMessage = error.localizedDescription
            }
        }
    }

    private func showBookingBanner(_ message: String) {
        withAnimation { bookingService?.errorMessage = message }
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            withAnimation { bookingService?.errorMessage = nil }
        }
    }
}

// MARK: - Date Pill

private struct DatePill: View {
    let date: Date
    let isSelected: Bool

    private var dayAbbreviation: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    private var dayNumber: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: date)
    }

    var body: some View {
        VStack(spacing: 4) {
            Text(dayAbbreviation)
                .font(.caption2)
                .foregroundStyle(isSelected ? .black : .secondary)
            Text(dayNumber)
                .font(.body.bold())
                .foregroundStyle(isSelected ? .black : .white)
        }
        .frame(width: 44, height: 56)
        .background(
            isSelected ? Color.white : Color(hex: "#1c1c1e"),
            in: RoundedRectangle(cornerRadius: 10)
        )
    }
}

// MARK: - Error Banner

private struct ErrorBanner: View {
    let message: String
    let onDismiss: () -> Void

    @State private var isVisible = true

    var body: some View {
        if isVisible {
            HStack {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.yellow)
                Text(message)
                    .font(.subheadline)
                    .lineLimit(2)
                Spacer()
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
            .padding(.horizontal, 16)
            .padding(.top, 4)
            .onAppear {
                Task {
                    try? await Task.sleep(for: .seconds(3))
                    dismiss()
                }
            }
        }
    }

    private func dismiss() {
        withAnimation {
            isVisible = false
        }
        onDismiss()
    }
}
