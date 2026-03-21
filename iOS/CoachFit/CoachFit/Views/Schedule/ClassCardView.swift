import SwiftUI
import UIKit

struct ClassCardView: View {
    let session: ClassSession
    let creditBalance: Int
    let isBooked: Bool
    let onBook: (String) async throws -> Void

    @State private var isExpanded = false
    @State private var bookingError: String?

    private var classColor: Color {
        Self.color(for: session.classTemplate.classType)
    }

    static func color(for classType: String) -> Color {
        switch classType.uppercased() {
        case "HIIT":
            Color(hex: "#452ddb")
        case "CORE":
            Color(hex: "#f2de24")
        case "STRENGTH":
            Color(hex: "#22c55e")
        default:
            Color.gray
        }
    }

    private var timeString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: session.startsAt)
    }

    private var durationMinutes: Int {
        Int(session.endsAt.timeIntervalSince(session.startsAt) / 60)
    }

    private var instructorInitials: String {
        guard let name = session.instructor?.name else { return "?" }
        let parts = name.split(separator: " ")
        if parts.count >= 2 {
            return "\(parts[0].prefix(1))\(parts[1].prefix(1))"
        }
        return String(name.prefix(1))
    }

    private var capacityFraction: Double {
        let cap = session.effectiveCapacity
        guard cap > 0 else { return 1.0 }
        return Double(session.bookingCount) / Double(cap)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Main card content
            HStack(spacing: 12) {
                // Left: time
                VStack(alignment: .leading) {
                    Text(timeString)
                        .font(.title2.bold().monospacedDigit())
                }
                .frame(width: 60, alignment: .leading)

                // Center: name + instructor
                VStack(alignment: .leading, spacing: 4) {
                    Text(session.classTemplate.name)
                        .font(.headline)

                    if let instructor = session.instructor {
                        HStack(spacing: 6) {
                            Text(instructorInitials)
                                .font(.caption2.bold())
                                .foregroundStyle(.white)
                                .frame(width: 24, height: 24)
                                .background(classColor.opacity(0.7), in: Circle())

                            Text(instructor.name ?? "TBC")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Spacer()

                // Right: capacity + button
                VStack(alignment: .trailing, spacing: 6) {
                    Text("\(session.bookingCount)/\(session.effectiveCapacity)")
                        .font(.caption.monospacedDigit())
                        .foregroundStyle(.secondary)

                    ProgressView(value: capacityFraction)
                        .tint(capacityFraction >= 1.0 ? .red : classColor)
                        .frame(width: 50)

                    bookButton
                }
            }
            .padding(12)
            .contentShape(Rectangle())
            .onTapGesture {
                guard !isBooked && !session.isFull else { return }
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded.toggle()
                }
            }

            // Expanded confirmation
            if isExpanded && !isBooked {
                Divider()
                    .background(Color.white.opacity(0.1))

                VStack(spacing: 8) {
                    HStack {
                        Label("\(durationMinutes) min", systemImage: "clock")
                            .font(.caption)
                            .foregroundStyle(.secondary)

                        Spacer()
                    }

                    BookingConfirmationView(
                        creditsRequired: session.classTemplate.creditsRequired,
                        onConfirm: {
                            bookingError = nil
                            do {
                                let haptic = UINotificationFeedbackGenerator()
                                _ = try await onBook(session.id)
                                haptic.notificationOccurred(.success)
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    isExpanded = false
                                }
                            } catch {
                                let haptic = UINotificationFeedbackGenerator()
                                haptic.notificationOccurred(.error)
                                bookingError = error.localizedDescription
                            }
                        },
                        onCancel: {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                isExpanded = false
                            }
                        }
                    )

                    if let bookingError {
                        Text(bookingError)
                            .font(.caption)
                            .foregroundStyle(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 12)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Color(hex: "#1c1c1e"), in: RoundedRectangle(cornerRadius: 12))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 12)
                .fill(classColor)
                .frame(width: 4)
        }
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var bookButton: some View {
        if isBooked {
            Text("Booked \(Image(systemName: "checkmark"))")
                .font(.caption.bold())
                .foregroundStyle(.green)
        } else if session.isFull {
            Text("Full")
                .font(.caption.bold())
                .foregroundStyle(.secondary)
        } else if creditBalance <= 0 {
            Button {
                let haptic = UINotificationFeedbackGenerator()
                haptic.notificationOccurred(.error)
            } label: {
                Text("Get Credits")
                    .font(.caption.bold())
            }
            .buttonStyle(.bordered)
            .tint(.gray)
        } else {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    isExpanded = true
                }
            } label: {
                Text("Book")
                    .font(.caption.bold())
            }
            .buttonStyle(.borderedProminent)
        }
    }
}
