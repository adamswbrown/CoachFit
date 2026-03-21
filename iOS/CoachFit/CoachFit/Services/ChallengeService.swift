import Foundation

// MARK: - Models

struct ActiveChallenge: Codable, Identifiable {
    let id: String
    let name: String
    let coachId: String
    let cohortStartDate: String?
    let durationWeeks: Int?
    let durationConfig: String
    let membershipDurationMonths: Int?
    let checkInFrequencyDays: Int?
    let memberCount: Int
}

struct ChallengeProgress: Codable {
    let daysCompleted: Int
    let totalDays: Int
    let streak: Int
    let weeklyEntries: [String: Int]
    let checkInRate: Double
    let percentComplete: Int
}

// MARK: - Service

@Observable
final class ChallengeService {
    private let api: APIClient

    var activeChallenge: ActiveChallenge?
    var progress: ChallengeProgress?
    var isLoading = false
    var errorMessage: String?

    init(api: APIClient) {
        self.api = api
    }

    // MARK: - Fetch Active Challenge

    func fetchActiveChallenge() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let challenges: [ActiveChallenge] = try await fetchWithRetry(path: "/api/challenges/active")
            activeChallenge = challenges.first
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Fetch Progress

    func fetchProgress(for cohortId: String) async {
        errorMessage = nil

        do {
            progress = try await fetchWithRetry(path: "/api/challenges/\(cohortId)/progress")
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Computed

    var startDate: Date? {
        guard let dateStr = activeChallenge?.cohortStartDate else { return nil }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        if let d = formatter.date(from: dateStr) { return d }
        // Try full ISO 8601 with time
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = formatter.date(from: dateStr) { return d }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: dateStr)
    }

    var endDate: Date? {
        guard let start = startDate,
              let weeks = activeChallenge?.durationWeeks else { return nil }
        return Calendar.current.date(byAdding: .day, value: weeks * 7, to: start)
    }

    var daysRemaining: Int? {
        guard let end = endDate else { return nil }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: .now), to: end).day
        return max(0, days ?? 0)
    }

    // MARK: - Private

    private func fetchWithRetry<T: Decodable>(path: String) async throws -> T {
        do {
            return try await performFetch(path: path)
        } catch is URLError {
            return try await performFetch(path: path)
        }
    }

    private func performFetch<T: Decodable>(path: String) async throws -> T {
        let (data, response) = try await api.authenticatedRequest(path: path)

        guard (200...299).contains(response.statusCode) else {
            let errorBody = try? JSONDecoder().decode(ErrorBody.self, from: data)
            throw APIClient.APIError.server(
                statusCode: response.statusCode,
                message: errorBody?.error ?? "Request failed (HTTP \(response.statusCode))"
            )
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateStr = try container.decode(String.self)
            let iso = ISO8601DateFormatter()
            iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = iso.date(from: dateStr) { return date }
            iso.formatOptions = [.withInternetDateTime]
            if let date = iso.date(from: dateStr) { return date }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid date: \(dateStr)")
        }

        return try decoder.decode(T.self, from: data)
    }

    private struct ErrorBody: Decodable {
        let error: String
    }
}
