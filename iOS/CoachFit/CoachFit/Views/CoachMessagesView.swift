import SwiftUI

struct CoachMessagesView: View {
    @Environment(AppState.self) private var appState

    @State private var notes: [SharedNote] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading messages...")
            } else if let error {
                ContentUnavailableView {
                    Label("Error", systemImage: "exclamationmark.triangle")
                } description: {
                    Text(error)
                }
            } else if notes.isEmpty {
                ContentUnavailableView {
                    Label("No Messages", systemImage: "bubble.left")
                } description: {
                    Text("No messages from your coach yet.")
                }
            } else {
                List(notes) { note in
                    DisclosureGroup {
                        Text(note.note)
                            .font(.body)
                            .foregroundStyle(.primary)
                            .padding(.vertical, 4)
                    } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(note.coach.name ?? "Coach")
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Text(note.formattedDate)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            if let weekNumber = note.weekNumber {
                                Text("Week \(weekNumber) response")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Text(note.note)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .lineLimit(2)
                        }
                    }
                }
            }
        }
        .navigationTitle("Coach Messages")
        .task {
            await loadNotes()
        }
        .onAppear {
            UserDefaults.standard.set(Date().timeIntervalSince1970, forKey: "lastCoachMessageReadAt")
        }
    }

    private func loadNotes() async {
        guard let userId = appState.clientId else {
            error = "Not signed in"
            isLoading = false
            return
        }

        do {
            let (data, response) = try await appState.apiClient.authenticatedRequest(
                path: "api/clients/\(userId)/shared-notes"
            )

            guard (200...299).contains(response.statusCode) else {
                error = "Failed to load messages (HTTP \(response.statusCode))"
                isLoading = false
                return
            }

            let decoded = try JSONDecoder.iso8601Full.decode(SharedNotesResponse.self, from: data)
            notes = decoded.notes
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - Models

private struct SharedNotesResponse: Decodable {
    let notes: [SharedNote]
}

private struct SharedNote: Decodable, Identifiable {
    let id: String
    let noteDate: String
    let note: String
    let sharedAt: String?
    let weekNumber: Int?
    let coach: CoachInfo

    struct CoachInfo: Decodable {
        let name: String?
    }

    var formattedDate: String {
        // Parse "2026-03-21T00:00:00.000Z" or "2026-03-21" style dates
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")

        // Try ISO 8601 full
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = isoFormatter.date(from: noteDate) {
            formatter.dateFormat = "d MMM"
            return formatter.string(from: date)
        }

        // Try date-only
        isoFormatter.formatOptions = [.withFullDate]
        if let date = isoFormatter.date(from: noteDate) {
            formatter.dateFormat = "d MMM"
            return formatter.string(from: date)
        }

        // Fallback: try yyyy-MM-dd
        formatter.dateFormat = "yyyy-MM-dd"
        if let date = formatter.date(from: noteDate) {
            formatter.dateFormat = "d MMM"
            return formatter.string(from: date)
        }

        return noteDate
    }
}

// MARK: - JSON Decoder Extension

private extension JSONDecoder {
    static let iso8601Full: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()
}
