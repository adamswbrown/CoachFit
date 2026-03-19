import Foundation

@Observable
final class APIClient {
    private(set) var baseURL = URL(string: "https://gcgyms.com")!

    var onUnauthorized: (() -> Void)?

    // MARK: - Device Registration (Clerk auth)

    struct RegisterDeviceResponse: Decodable {
        let deviceToken: String
        let clientId: String
        let clientName: String?
        let coachName: String?

        enum CodingKeys: String, CodingKey {
            case deviceToken = "device_token"
            case clientId = "client_id"
            case clientName = "client_name"
            case coachName = "coach_name"
        }
    }

    func registerDevice(clerkToken: String) async throws -> RegisterDeviceResponse {
        let url = baseURL.appendingPathComponent("api/client/register-device")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(clerkToken)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse

        if let raw = String(data: data, encoding: .utf8) {
            print("[APIClient] POST /api/client/register-device (\(httpResponse.statusCode)): \(raw)")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorBody = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw APIError.server(
                statusCode: httpResponse.statusCode,
                message: errorBody?.error ?? "Device registration failed (HTTP \(httpResponse.statusCode))"
            )
        }

        return try JSONDecoder().decode(RegisterDeviceResponse.self, from: data)
    }

    // MARK: - Legacy Pairing (code-based)

    struct PairResponse: Decodable {
        let success: Bool?
        let message: String?
        let client_id: String?
        let device_token: String?
        let coach: PairUser?
        let client: PairUser?
        let error: String?
    }

    struct PairUser: Decodable {
        let id: String?
        let name: String?
        let email: String?
    }

    func pair(code: String) async throws -> PairResponse {
        let url = baseURL.appendingPathComponent("api/pair")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(["code": code.uppercased()])

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse

        // Log raw response for debugging
        if let raw = String(data: data, encoding: .utf8) {
            print("[APIClient] POST /api/pair (\(httpResponse.statusCode)): \(raw)")
        }

        if httpResponse.statusCode == 401 {
            onUnauthorized?()
            throw APIError.unauthorized
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            let errorBody = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw APIError.server(
                statusCode: httpResponse.statusCode,
                message: errorBody?.error ?? "Pairing failed (HTTP \(httpResponse.statusCode))"
            )
        }

        let decoded: PairResponse
        do {
            decoded = try JSONDecoder().decode(PairResponse.self, from: data)
        } catch {
            let raw = String(data: data, encoding: .utf8) ?? "unreadable"
            throw APIError.server(
                statusCode: httpResponse.statusCode,
                message: "Decode error: \(error.localizedDescription)\n\nRaw: \(raw.prefix(300))"
            )
        }

        guard decoded.device_token != nil, decoded.client_id != nil else {
            let raw = String(data: data, encoding: .utf8) ?? "unreadable"
            throw APIError.server(
                statusCode: httpResponse.statusCode,
                message: "Missing fields. Raw: \(raw.prefix(300))"
            )
        }

        return decoded
    }

    // MARK: - Authenticated Requests

    func authenticatedRequest(
        path: String,
        method: String = "GET",
        body: (any Encodable)? = nil
    ) async throws -> (Data, HTTPURLResponse) {
        guard let token = KeychainService.deviceToken,
              KeychainService.clientId != nil else {
            throw APIError.notPaired
        }

        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(token, forHTTPHeaderField: "X-Pairing-Token")

        if let body {
            request.httpBody = try JSONEncoder().encode(AnyEncodable(body))
        }

        let (data, response) = try await URLSession.shared.data(for: request)
        let httpResponse = response as! HTTPURLResponse

        if httpResponse.statusCode == 401 {
            onUnauthorized?()
            throw APIError.unauthorized
        }

        return (data, httpResponse)
    }

    // MARK: - Check-in Entry

    struct SubmitEntryRequest: Encodable {
        let client_id: String
        let date: String
        let weightLbs: Double?
        let steps: Int?
        let calories: Int?
        let sleepQuality: Int?
        let perceivedStress: Int?
        let notes: String?
    }

    func submitEntry(_ entry: SubmitEntryRequest) async throws {
        let (data, response) = try await authenticatedRequest(
            path: "api/ingest/entry",
            method: "POST",
            body: entry
        )

        if let raw = String(data: data, encoding: .utf8) {
            print("[APIClient] POST /api/ingest/entry (\(response.statusCode)): \(raw)")
        }

        guard (200...299).contains(response.statusCode) else {
            let errorBody = try? JSONDecoder().decode(ErrorResponse.self, from: data)
            throw APIError.server(
                statusCode: response.statusCode,
                message: errorBody?.fullMessage ?? errorBody?.error ?? "Failed to submit entry (HTTP \(response.statusCode))"
            )
        }
    }

    // MARK: - Types

    enum APIError: LocalizedError {
        case unauthorized
        case notPaired
        case server(statusCode: Int, message: String)

        var errorDescription: String? {
            switch self {
            case .unauthorized:
                "Your session has expired. Please sign in again."
            case .notPaired:
                "Not signed in. Please sign in to continue."
            case .server(_, let message):
                message
            }
        }
    }

    private struct ErrorResponse: Decodable {
        let error: String
        let details: [ValidationDetail]?

        struct ValidationDetail: Decodable {
            let message: String?
            let path: [String]?
        }

        var fullMessage: String {
            guard let details, !details.isEmpty else { return error }
            let fieldErrors = details.compactMap { d -> String? in
                let path = d.path?.joined(separator: ".") ?? ""
                let msg = d.message ?? ""
                return path.isEmpty ? msg : "\(path): \(msg)"
            }
            return "\(error): \(fieldErrors.joined(separator: ", "))"
        }
    }
}

// Type-erased Encodable wrapper
private struct AnyEncodable: Encodable {
    private let _encode: (Encoder) throws -> Void

    init(_ wrapped: any Encodable) {
        _encode = { encoder in try wrapped.encode(to: encoder) }
    }

    func encode(to encoder: Encoder) throws {
        try _encode(encoder)
    }
}
