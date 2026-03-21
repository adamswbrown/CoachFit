import Foundation

// MARK: - Models

struct ClientBooking: Codable, Identifiable {
    let id: String
    let status: String
    let createdAt: Date
    let session: BookedSession
}

struct BookedSession: Codable, Identifiable {
    let id: String
    let startsAt: Date
    let endsAt: Date
    let classTemplate: BookedClassTemplate
    let instructor: BookedInstructor?
}

struct BookedClassTemplate: Codable {
    let name: String
    let classType: String
}

struct BookedInstructor: Codable {
    let name: String?
}

struct CancelResponse: Codable {
    let booking: CancelledBooking
    let refunded: Bool
}

struct CancelledBooking: Codable {
    let id: String
    let status: String
    let canceledAt: Date?
}

// MARK: - Service

@Observable
final class BookingService {

    private let api: APIClient

    var upcomingBookings: [ClientBooking] = []
    var pastBookings: [ClientBooking] = []
    var creditBalance: Int = 0
    var isLoading = false
    var errorMessage: String?

    init(api: APIClient) {
        self.api = api
    }

    // MARK: - Decoder

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoNoFrac = ISO8601DateFormatter()
        isoNoFrac.formatOptions = [.withInternetDateTime]
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = iso.date(from: string) { return date }
            if let date = isoNoFrac.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(string)"
            )
        }
        return decoder
    }()

    // MARK: - Fetch Bookings

    func fetchBookings() async {
        isLoading = true
        errorMessage = nil

        do {
            let (data, response) = try await fetchBookingsRequest()

            guard (200...299).contains(response.statusCode) else {
                throw APIClient.APIError.server(
                    statusCode: response.statusCode,
                    message: "Failed to load bookings (HTTP \(response.statusCode))"
                )
            }

            let wrapper = try Self.decoder.decode(BookingsWrapper.self, from: data)
            let now = Date()

            upcomingBookings = wrapper.bookings
                .filter { $0.status == "BOOKED" && $0.session.startsAt > now }
                .sorted { $0.session.startsAt < $1.session.startsAt }

            pastBookings = wrapper.bookings
                .filter { !($0.status == "BOOKED" && $0.session.startsAt > now) }
                .sorted { $0.session.startsAt > $1.session.startsAt }

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func fetchBookingsRequest() async throws -> (Data, HTTPURLResponse) {
        do {
            return try await api.authenticatedRequest(path: "api/classes/bookings")
        } catch let urlError as URLError {
            // Retry once on network error
            do {
                return try await api.authenticatedRequest(path: "api/classes/bookings")
            } catch {
                throw urlError
            }
        }
    }

    // MARK: - Cancel Booking

    func cancelBooking(bookingId: String) async throws -> CancelResponse {
        let (data, response) = try await api.authenticatedRequest(
            path: "api/classes/book/\(bookingId)",
            method: "DELETE"
        )

        guard (200...299).contains(response.statusCode) else {
            throw APIClient.APIError.server(
                statusCode: response.statusCode,
                message: "Failed to cancel booking (HTTP \(response.statusCode))"
            )
        }

        return try Self.decoder.decode(CancelResponse.self, from: data)
    }

    // MARK: - Fetch Balance

    func fetchBalance() async {
        do {
            let (data, response) = try await api.authenticatedRequest(
                path: "api/credits/balance"
            )
            guard (200...299).contains(response.statusCode) else { return }
            let wrapper = try Self.decoder.decode(BalanceWrapper.self, from: data)
            creditBalance = wrapper.balance
        } catch {
            // Balance is non-critical; silently ignore
        }
    }

    // MARK: - Private Wrappers

    private struct BookingsWrapper: Codable {
        let bookings: [ClientBooking]
    }

    private struct BalanceWrapper: Codable {
        let balance: Int
    }
}
