import SwiftUI
import UIKit

struct ScheduleView: View {
    @Environment(AppState.self) private var appState

    @State private var classService: ClassService?
    @State private var selectedDate: Date = .now

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
                            await loadData()
                        }
                    }
                }

                // Error banner
                if let errorMessage = classService?.errorMessage {
                    ErrorBanner(message: errorMessage) {
                        classService?.errorMessage = nil
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
            await loadData()
        }
        .onChange(of: selectedDate) {
            Task { await loadData() }
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
                        }
                    )
                }
            }
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        guard let service = classService else { return }
        async let schedule: () = service.fetchSchedule(for: selectedDate)
        async let balance: () = service.fetchBalance()
        _ = await (schedule, balance)
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

    private var isToday: Bool {
        Calendar.current.isDateInToday(date)
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
