import SwiftUI

struct BookingConfirmationView: View {
    let creditsRequired: Int
    let onConfirm: () async -> Void
    let onCancel: () -> Void

    @State private var isBooking = false
    @State private var isBooked = false

    var body: some View {
        VStack(spacing: 12) {
            if isBooked {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.title2)
                    Text("Booked!")
                        .font(.headline)
                        .foregroundStyle(.green)
                }
                .transition(.scale.combined(with: .opacity))
            } else {
                HStack {
                    Text("Confirm booking?")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Spacer()

                    HStack(spacing: 4) {
                        Image(systemName: "creditcard")
                            .font(.caption2)
                        Text("\(creditsRequired) credit\(creditsRequired == 1 ? "" : "s")")
                            .font(.caption)
                    }
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color.white.opacity(0.1), in: Capsule())
                }

                HStack(spacing: 16) {
                    Button {
                        onCancel()
                    } label: {
                        Text("Cancel")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)

                    Button {
                        Task {
                            isBooking = true
                            await onConfirm()
                            withAnimation(.spring(duration: 0.3)) {
                                isBooked = true
                            }
                            isBooking = false
                        }
                    } label: {
                        if isBooking {
                            ProgressView()
                                .tint(.white)
                                .frame(maxWidth: .infinity)
                        } else {
                            Text("Confirm")
                                .font(.subheadline.bold())
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isBooking)
                }
            }
        }
        .padding(.top, 8)
    }
}
