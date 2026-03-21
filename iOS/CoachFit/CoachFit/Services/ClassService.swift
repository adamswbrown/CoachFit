import Foundation

// MARK: - Models

struct ClassTemplate: Codable, Hashable {
    let id: String
    let name: String
    let classType: String
    let capacity: Int
    let creditsRequired: Int
    let cancelCutoffMinutes: Int
}

struct Instructor: Codable, Hashable {
    let id: String
    let name: String?
    let image: String?
}

struct ClassSession: Codable, Identifiable, Hashable {
    let id: String
    let startsAt: Date
    let endsAt: Date
    let status: String
    let capacityOverride: Int?
    let classTemplate: ClassTemplate
    let instructor: Instructor?
    let bookingCount: Int
    let spotsRemaining: Int

    enum CodingKeys: String, CodingKey {
        case id, startsAt, endsAt, status, capacityOverride
        case classTemplate, instructor, spotsRemaining
        case _count
    }

    private struct CountWrapper: Decodable {
        let bookings: Int
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        startsAt = try container.decode(Date.self, forKey: .startsAt)
        endsAt = try container.decode(Date.self, forKey: .endsAt)
        status = try container.decode(String.self, forKey: .status)
        capacityOverride = try container.decodeIfPresent(Int.self, forKey: .capacityOverride)
        classTemplate = try container.decode(ClassTemplate.self, forKey: .classTemplate)
        instructor = try container.decodeIfPresent(Instructor.self, forKey: .instructor)
        spotsRemaining = try container.decode(Int.self, forKey: .spotsRemaining)

        let countWrapper = try container.decode(CountWrapper.self, forKey: ._count)
        bookingCount = countWrapper.bookings
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(startsAt, forKey: .startsAt)
        try container.encode(endsAt, forKey: .endsAt)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(capacityOverride, forKey: .capacityOverride)
        try container.encode(classTemplate, forKey: .classTemplate)
        try container.encodeIfPresent(instructor, forKey: .instructor)
        try container.encode(spotsRemaining, forKey: .spotsRemaining)
    }

    var effectiveCapacity: Int {
        capacityOverride ?? classTemplate.capacity
    }

    var isFull: Bool {
        spotsRemaining <= 0
    }
}

struct BookingResponse: Codable {
    let id: String
    let sessionId: String
    let clientId: String
    let status: String
    let source: String
    let createdAt: Date
}

// MARK: - Service

@Observable
final class ClassService {
    private let apiClient: APIClient

    var sessions: [ClassSession] = []
    var creditBalance: Int = 0
    var isLoading = false
    var errorMessage: String?
    var bookedSessionIds: Set<String> = []

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        let iso8601WithFractional = ISO8601DateFormatter()
        iso8601WithFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso8601Standard = ISO8601DateFormatter()
        iso8601Standard.formatOptions = [.withInternetDateTime]

        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            if let date = iso8601WithFractional.date(from: dateString) {
                return date
            }
            if let date = iso8601Standard.date(from: dateString) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }
        return decoder
    }()

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    // MARK: - Schedule

    private struct ScheduleResponse: Decodable {
        let sessions: [ClassSession]
    }

    func fetchSchedule(for date: Date) async {
        isLoading = true
        errorMessage = nil

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let dateString = formatter.string(from: date)

        do {
            let (data, response) = try await apiClient.authenticatedRequest(
                path: "api/classes/schedule?date=\(dateString)"
            )

            guard (200...299).contains(response.statusCode) else {
                let errorBody = try? JSONDecoder().decode(APIErrorBody.self, from: data)
                errorMessage = errorBody?.error ?? "Failed to load schedule (HTTP \(response.statusCode))"
                isLoading = false
                return
            }

            let decoded = try Self.decoder.decode(ScheduleResponse.self, from: data)
            sessions = decoded.sessions
        } catch is URLError {
            // Auto-retry once on network error
            do {
                let (data, response) = try await apiClient.authenticatedRequest(
                    path: "api/classes/schedule?date=\(dateString)"
                )
                guard (200...299).contains(response.statusCode) else {
                    errorMessage = "Failed to load schedule"
                    isLoading = false
                    return
                }
                let decoded = try Self.decoder.decode(ScheduleResponse.self, from: data)
                sessions = decoded.sessions
            } catch {
                errorMessage = "Network error: \(error.localizedDescription)"
            }
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Balance

    private struct BalanceResponse: Decodable {
        let balance: Int
    }

    func fetchBalance() async {
        do {
            let (data, response) = try await apiClient.authenticatedRequest(
                path: "api/credits/balance"
            )

            guard (200...299).contains(response.statusCode) else { return }

            let decoded = try Self.decoder.decode(BalanceResponse.self, from: data)
            creditBalance = decoded.balance
        } catch {
            print("[ClassService] Failed to fetch balance: \(error.localizedDescription)")
        }
    }

    // MARK: - Booking

    private struct BookingWrapper: Decodable {
        let booking: BookingResponse
    }

    func bookClass(sessionId: String) async throws -> BookingResponse {
        struct BookRequest: Encodable {
            let sessionId: String
        }

        let (data, response) = try await apiClient.authenticatedRequest(
            path: "api/classes/book",
            method: "POST",
            body: BookRequest(sessionId: sessionId)
        )

        guard (200...299).contains(response.statusCode) else {
            let errorBody = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw APIClient.APIError.server(
                statusCode: response.statusCode,
                message: errorBody?.error ?? "Booking failed (HTTP \(response.statusCode))"
            )
        }

        let decoded = try Self.decoder.decode(BookingWrapper.self, from: data)
        bookedSessionIds.insert(sessionId)
        return decoded.booking
    }

    // MARK: - Private

    private struct APIErrorBody: Decodable {
        let error: String
    }
}
