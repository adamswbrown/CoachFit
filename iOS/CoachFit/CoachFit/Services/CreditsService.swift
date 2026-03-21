import Foundation

@Observable
final class CreditsService {
    private let api: APIClient

    var balance: Int = 0
    var ledgerEntries: [LedgerEntry] = []
    var products: [CreditProduct] = []
    var isLoading = false
    var errorMessage: String?
    var currentPage: Int = 1
    var totalPages: Int = 1

    init(api: APIClient) {
        self.api = api
    }

    // MARK: - Fetch Balance

    func fetchBalance() async {
        do {
            let data = try await fetchWithRetry(path: "api/credits/balance")
            let response = try Self.decoder.decode(BalanceResponse.self, from: data)
            balance = response.balance
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Fetch Ledger

    func fetchLedger(page: Int = 1) async {
        do {
            let data = try await fetchWithRetry(path: "api/credits/ledger?page=\(page)&limit=20")
            let response = try Self.decoder.decode(LedgerResponse.self, from: data)
            if page == 1 {
                ledgerEntries = response.entries
            } else {
                ledgerEntries.append(contentsOf: response.entries)
            }
            currentPage = response.pagination.page
            totalPages = response.pagination.totalPages
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Fetch Products

    func fetchProducts() async {
        do {
            let data = try await fetchWithRetry(path: "api/credits/products")
            products = try Self.decoder.decode([CreditProduct].self, from: data)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Submit Purchase Request

    func submitPurchaseRequest(productId: String, note: String?) async throws {
        struct RequestBody: Encodable {
            let creditProductId: String
            let note: String?
        }

        let body = RequestBody(creditProductId: productId, note: note)
        let (data, response) = try await api.authenticatedRequest(
            path: "api/credits/submit",
            method: "POST",
            body: body
        )

        guard (200...299).contains(response.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Request failed (HTTP \(response.statusCode))"
            throw APIClient.APIError.server(statusCode: response.statusCode, message: message)
        }
    }

    // MARK: - Private Helpers

    private func fetchWithRetry(path: String) async throws -> Data {
        do {
            return try await fetch(path: path)
        } catch let error as URLError {
            // Retry once on network error
            do {
                return try await fetch(path: path)
            } catch {
                throw error
            }
        }
    }

    private func fetch(path: String) async throws -> Data {
        let (data, response) = try await api.authenticatedRequest(path: path)
        guard (200...299).contains(response.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? "Request failed (HTTP \(response.statusCode))"
            throw APIClient.APIError.server(statusCode: response.statusCode, message: message)
        }
        return data
    }

    private static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        let iso8601Fractional = ISO8601DateFormatter()
        iso8601Fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let iso8601Standard = ISO8601DateFormatter()
        iso8601Standard.formatOptions = [.withInternetDateTime]
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = iso8601Fractional.date(from: string) { return date }
            if let date = iso8601Standard.date(from: string) { return date }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(string)"
            )
        }
        return decoder
    }()

    // MARK: - Models

    private struct BalanceResponse: Decodable {
        let clientId: String
        let balance: Int
    }

    private struct LedgerResponse: Decodable {
        let entries: [LedgerEntry]
        let pagination: Pagination
    }

    struct Pagination: Decodable {
        let page: Int
        let limit: Int
        let total: Int
        let totalPages: Int
    }

    struct LedgerEntry: Decodable, Identifiable {
        let id: String
        let clientId: String
        let deltaCredits: Int
        let reason: String
        let createdAt: Date
        let creditProduct: LedgerProduct?
        let submission: LedgerSubmission?
        let booking: LedgerBooking?
    }

    struct LedgerProduct: Decodable {
        let id: String
        let name: String
    }

    struct LedgerSubmission: Decodable {
        let id: String
        let status: String
    }

    struct LedgerBooking: Decodable {
        let id: String
        let sessionId: String
    }

    struct CreditProduct: Decodable, Identifiable {
        let id: String
        let name: String
        let description: String?
        let creditMode: String
        let creditsPerPeriod: Int?
        let purchasePriceGbp: Double?
        let appliesToClassTypes: [String]
        let isActive: Bool
        let classEligible: Bool
    }
}
