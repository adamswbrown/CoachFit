import Foundation

// MARK: - Models

struct QuestionnaireQuestion: Codable, Identifiable {
    var id: String { name }
    let name: String
    let type: String       // "comment" | "text" | "html" | "rating" | etc.
    let title: String?
    let description: String?
    let inputType: String? // "number" for numeric text fields
    let isRequired: Bool
}

struct QuestionnaireWeekData: Codable {
    let weekNumber: Int
    let status: String         // "not_started" | "in_progress" | "completed"
    let locked: Bool
    let submittedAt: String?
    let questions: [QuestionnaireQuestion]
    let existingResponses: [String: AnyCodableValue]?
}

struct QuestionnaireSaveResponse: Codable {
    let id: String
    let weekNumber: Int
    let status: String
    let submittedAt: String?
    let updatedAt: String?
}

// MARK: - Week Status (computed client-side)

struct QuestionnaireWeekStatus: Identifiable {
    var id: Int { weekNumber }
    let weekNumber: Int
    let status: String // "locked" | "not_started" | "in_progress" | "completed"
}

// MARK: - Service

@Observable
final class QuestionnaireService {
    private let api: APIClient

    var weekStatuses: [QuestionnaireWeekStatus] = []
    var currentWeekData: QuestionnaireWeekData?
    var isLoading = false
    var isSaving = false
    var errorMessage: String?
    var saveSuccess = false

    init(api: APIClient) {
        self.api = api
    }

    /// Compute the current week number from cohort start date (1-based, max 5).
    static func currentWeek(from startDate: Date) -> Int {
        let cal = Calendar.current
        let start = cal.startOfDay(for: startDate)
        let today = cal.startOfDay(for: .now)
        let days = cal.dateComponents([.day], from: start, to: today).day ?? 0
        if days < 0 { return 0 }
        return min(5, days / 7 + 1)
    }

    /// Build week statuses by probing each week's endpoint.
    /// This fetches lightweight data for weeks 1..totalWeeks.
    func fetchWeekStatuses(cohortId: String, totalWeeks: Int, cohortStartDate: Date) async {
        isLoading = true
        defer { isLoading = false }

        let current = Self.currentWeek(from: cohortStartDate)
        let weeks = min(totalWeeks, 5)

        // Build default statuses
        var statuses: [QuestionnaireWeekStatus] = (1...weeks).map { week in
            let status = week > current ? "locked" : "not_started"
            return QuestionnaireWeekStatus(weekNumber: week, status: status)
        }

        // Fetch actual status for unlocked weeks in parallel
        await withTaskGroup(of: (Int, String).self) { group in
            for week in 1...weeks where week <= current {
                group.addTask { [api] in
                    do {
                        let (data, response) = try await api.authenticatedRequest(
                            path: "api/client/questionnaire/\(cohortId)/\(week)"
                        )
                        if (200...299).contains(response.statusCode) {
                            struct StatusOnly: Decodable { let status: String }
                            let decoded = try JSONDecoder().decode(StatusOnly.self, from: data)
                            return (week, decoded.status)
                        }
                    } catch {}
                    return (week, "not_started")
                }
            }

            for await (week, status) in group {
                if let idx = statuses.firstIndex(where: { $0.weekNumber == week }) {
                    statuses[idx] = QuestionnaireWeekStatus(weekNumber: week, status: status)
                }
            }
        }

        weekStatuses = statuses
    }

    /// Fetch questions and existing responses for a specific week.
    func fetchWeekQuestions(cohortId: String, weekNumber: Int) async {
        isLoading = true
        errorMessage = nil
        currentWeekData = nil
        defer { isLoading = false }

        do {
            let (data, response) = try await api.authenticatedRequest(
                path: "api/client/questionnaire/\(cohortId)/\(weekNumber)"
            )

            guard (200...299).contains(response.statusCode) else {
                struct ErrorBody: Decodable { let error: String }
                let errorBody = try? JSONDecoder().decode(ErrorBody.self, from: data)
                errorMessage = errorBody?.error ?? "Failed to load questionnaire (HTTP \(response.statusCode))"
                return
            }

            let decoded = try JSONDecoder().decode(QuestionnaireWeekData.self, from: data)
            currentWeekData = decoded
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    /// Save (auto-save or complete) responses for a week.
    func saveResponse(cohortId: String, weekNumber: Int, responses: [String: String], completed: Bool) async {
        isSaving = true
        saveSuccess = false
        errorMessage = nil
        defer { isSaving = false }

        do {
            struct SavePayload: Encodable {
                let responseJson: [String: String]
                let status: String
            }

            let payload = SavePayload(
                responseJson: responses,
                status: completed ? "completed" : "in_progress"
            )

            let (data, response) = try await api.authenticatedRequest(
                path: "api/client/questionnaire/\(cohortId)/\(weekNumber)",
                method: "PUT",
                body: payload
            )

            if (200...299).contains(response.statusCode) {
                saveSuccess = true
                // Update local status
                if let idx = weekStatuses.firstIndex(where: { $0.weekNumber == weekNumber }) {
                    let newStatus = completed ? "completed" : "in_progress"
                    weekStatuses[idx] = QuestionnaireWeekStatus(weekNumber: weekNumber, status: newStatus)
                }
                // Update locked state on currentWeekData if completed
                if completed, let current = currentWeekData, current.weekNumber == weekNumber {
                    currentWeekData = QuestionnaireWeekData(
                        weekNumber: current.weekNumber,
                        status: "completed",
                        locked: true,
                        submittedAt: ISO8601DateFormatter().string(from: .now),
                        questions: current.questions,
                        existingResponses: current.existingResponses
                    )
                }
            } else {
                struct ErrorBody: Decodable { let error: String }
                let errorBody = try? JSONDecoder().decode(ErrorBody.self, from: data)
                errorMessage = errorBody?.error ?? "Failed to save responses"
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Type-Erased JSON Value

/// Handles mixed JSON values from the API (strings, numbers, booleans).
struct AnyCodableValue: Codable {
    let value: Any

    var stringValue: String {
        if let str = value as? String { return str }
        if let int = value as? Int { return "\(int)" }
        if let double = value as? Double { return "\(double)" }
        if let bool = value as? Bool { return bool ? "true" : "false" }
        return ""
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let str = try? container.decode(String.self) { value = str }
        else if let int = try? container.decode(Int.self) { value = int }
        else if let double = try? container.decode(Double.self) { value = double }
        else if let bool = try? container.decode(Bool.self) { value = bool }
        else { value = "" }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        if let str = value as? String { try container.encode(str) }
        else if let int = value as? Int { try container.encode(int) }
        else if let double = value as? Double { try container.encode(double) }
        else if let bool = value as? Bool { try container.encode(bool) }
        else { try container.encode("\(value)") }
    }
}
