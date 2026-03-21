import SwiftUI

struct QuestionnaireProgressView: View {
    let cohortId: String
    let totalWeeks: Int
    let cohortStartDate: Date

    @Environment(AppState.self) private var appState
    @State private var service: QuestionnaireService?
    @State private var selectedWeek: Int?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Weekly Check-In")
                .font(.headline)
                .foregroundStyle(.white)

            if let service, service.isLoading && service.weekStatuses.isEmpty {
                HStack(spacing: 8) {
                    ForEach(1...min(totalWeeks, 5), id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.white.opacity(0.05))
                            .frame(width: 56, height: 64)
                    }
                }
                .redacted(reason: .placeholder)
            } else if let service {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(service.weekStatuses) { week in
                            WeekBadge(
                                weekNumber: week.weekNumber,
                                status: week.status,
                                onTap: {
                                    selectedWeek = week.weekNumber
                                }
                            )
                        }
                    }
                }
            }
        }
        .padding(16)
        .background(Color(hex: "#1c1c1e"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .task {
            if service == nil {
                service = QuestionnaireService(api: appState.apiClient)
            }
            await service?.fetchWeekStatuses(
                cohortId: cohortId,
                totalWeeks: totalWeeks,
                cohortStartDate: cohortStartDate
            )
        }
        .navigationDestination(item: $selectedWeek) { week in
            QuestionnaireFormView(
                cohortId: cohortId,
                weekNumber: week,
                service: service ?? QuestionnaireService(api: appState.apiClient)
            )
        }
    }
}

// MARK: - Week Badge

private struct WeekBadge: View {
    let weekNumber: Int
    let status: String
    let onTap: () -> Void

    private var isLocked: Bool { status == "locked" }
    private var isCompleted: Bool { status == "completed" }
    private var isInProgress: Bool { status == "in_progress" }

    private var backgroundColor: Color {
        switch status {
        case "completed":   return Color(hex: "#22c55e")
        case "in_progress": return Color.orange
        case "locked":      return Color.white.opacity(0.05)
        default:            return Color.clear // not_started
        }
    }

    private var borderColor: Color {
        switch status {
        case "completed":   return Color(hex: "#22c55e")
        case "in_progress": return Color.orange
        case "locked":      return Color.white.opacity(0.1)
        default:            return Color.white.opacity(0.3) // not_started
        }
    }

    private var foregroundColor: Color {
        switch status {
        case "completed", "in_progress": return .white
        case "locked":                   return Color.white.opacity(0.25)
        default:                         return Color.white.opacity(0.7)
        }
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 2) {
                Text("Wk")
                    .font(.caption2.weight(.medium))
                Text("\(weekNumber)")
                    .font(.title3.bold())

                if isCompleted {
                    Image(systemName: "checkmark")
                        .font(.caption2.bold())
                } else if isInProgress {
                    Image(systemName: "ellipsis")
                        .font(.caption2.bold())
                } else {
                    // Spacer to keep consistent height
                    Color.clear.frame(height: 10)
                }
            }
            .foregroundStyle(foregroundColor)
            .frame(width: 56, height: 64)
            .background(backgroundColor)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .strokeBorder(borderColor, lineWidth: status == "not_started" ? 1.5 : 0)
            )
        }
        .disabled(isLocked)
        .buttonStyle(.plain)
    }
}

// MARK: - Binding helper for optional navigation

extension Binding where Value == Int? {
    init(item binding: Binding<Int?>) {
        self = binding
    }
}

extension View {
    func navigationDestination(item: Binding<Int?>, @ViewBuilder destination: @escaping (Int) -> some View) -> some View {
        self.navigationDestination(isPresented: Binding(
            get: { item.wrappedValue != nil },
            set: { if !$0 { item.wrappedValue = nil } }
        )) {
            if let value = item.wrappedValue {
                destination(value)
            }
        }
    }
}
