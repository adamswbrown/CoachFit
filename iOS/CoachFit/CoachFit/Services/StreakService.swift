import Foundation

enum StreakService {
    struct StreakData: Sendable {
        let currentStreak: Int
        let longestStreak: Int
        let lastCheckInDate: String?
        let milestones: [Milestone]
    }

    struct Milestone: Sendable, Identifiable {
        let id: String
        let title: String
        let description: String?
        let type: String
        let targetValue: Int?
        let achievedAt: String?
        let coachMessage: String?
        let coachName: String?
    }

    static func fetch(using apiClient: APIClient) async throws -> StreakData {
        let (data, response) = try await apiClient.authenticatedRequest(path: "/api/client/streak")

        if let raw = String(data: data, encoding: .utf8) {
            print("[StreakService] GET /api/client/streak (\(response.statusCode)): \(raw)")
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return StreakData(currentStreak: 0, longestStreak: 0, lastCheckInDate: nil, milestones: [])
        }

        let currentStreak = json["currentStreak"] as? Int ?? 0
        let longestStreak = json["longestStreak"] as? Int ?? 0
        let lastCheckInDate = json["lastCheckInDate"] as? String

        var milestones: [Milestone] = []
        if let milestonesArray = json["milestones"] as? [[String: Any]] {
            milestones = milestonesArray.compactMap { m in
                guard let id = m["id"] as? String, let title = m["title"] as? String else { return nil }
                return Milestone(
                    id: id,
                    title: title,
                    description: m["description"] as? String,
                    type: m["type"] as? String ?? "custom",
                    targetValue: m["targetValue"] as? Int,
                    achievedAt: m["achievedAt"] as? String,
                    coachMessage: m["coachMessage"] as? String,
                    coachName: m["coachName"] as? String
                )
            }
        }

        return StreakData(currentStreak: currentStreak, longestStreak: longestStreak,
                         lastCheckInDate: lastCheckInDate, milestones: milestones)
    }
}
