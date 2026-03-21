import SwiftUI

struct BookingRowView: View {

    let booking: ClientBooking
    let isUpcoming: Bool
    let onCancel: () async -> Void

    @State private var showCancelConfirmation = false

    var body: some View {
        HStack(spacing: 0) {
            // 4px left color border
            Self.classColor(for: booking.session.classTemplate.classType)
                .frame(width: 4)

            // Content
            VStack(alignment: .leading, spacing: 6) {
                // Top line: class name + type badge
                HStack(spacing: 8) {
                    Text(booking.session.classTemplate.name)
                        .font(.headline)
                        .foregroundStyle(.white)

                    Text(booking.session.classTemplate.classType)
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(Self.classTextColor(for: booking.session.classTemplate.classType))
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Self.classColor(for: booking.session.classTemplate.classType).opacity(0.25))
                        .clipShape(Capsule())

                    Spacer()

                    if !isUpcoming {
                        statusBadge
                    }
                }

                // Second line: date + time
                HStack(spacing: 4) {
                    Image(systemName: "calendar")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(formattedDate)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text("\u{2022}")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(formattedTimeRange)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // Third line: instructor
                if let instructorName = booking.session.instructor?.name, !instructorName.isEmpty {
                    HStack(spacing: 4) {
                        Image(systemName: "person.fill")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(instructorName)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(12)
        }
        .background(Color(hex: "#1c1c1e"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .swipeActions(edge: .trailing, allowsFullSwipe: false) {
            if isUpcoming {
                Button(role: .destructive) {
                    showCancelConfirmation = true
                } label: {
                    Label("Cancel", systemImage: "xmark.circle")
                }
            }
        }
        .confirmationDialog(
            "Cancel this booking?",
            isPresented: $showCancelConfirmation,
            titleVisibility: .visible
        ) {
            Button("Cancel Booking", role: .destructive) {
                Task { await onCancel() }
            }
            Button("Keep Booking", role: .cancel) {}
        } message: {
            Text("Your credit will be refunded if cancelled before the cutoff.")
        }
    }

    // MARK: - Status Badge

    @ViewBuilder
    private var statusBadge: some View {
        let (label, color) = statusInfo(booking.status)
        Text(label)
            .font(.caption2.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }

    private func statusInfo(_ status: String) -> (String, Color) {
        switch status.uppercased() {
        case "CANCELLED":
            return ("Cancelled", .red)
        case "ATTENDED":
            return ("Attended", .green)
        case "NO_SHOW":
            return ("No Show", .orange)
        case "LATE_CANCEL":
            return ("Late Cancel", .orange)
        default:
            return (status.capitalized, .secondary)
        }
    }

    // MARK: - Date Formatting

    private var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE d MMM"
        return formatter.string(from: booking.session.startsAt)
    }

    private var formattedTimeRange: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        let start = formatter.string(from: booking.session.startsAt)
        let end = formatter.string(from: booking.session.endsAt)
        return "\(start) \u{2013} \(end)"
    }

    // MARK: - Class Color Helpers

    private static func classColor(for classType: String) -> Color {
        switch classType.uppercased() {
        case "HIIT": return Color(hex: "#452ddb")
        case "CORE": return Color(hex: "#f2de24")
        case "STRENGTH": return Color(hex: "#22c55e")
        default: return .gray
        }
    }

    private static func classTextColor(for classType: String) -> Color {
        switch classType.uppercased() {
        case "CORE": return Color(hex: "#111111") // Dark text on yellow
        default: return .white
        }
    }
}
