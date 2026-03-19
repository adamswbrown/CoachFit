import Foundation
import HealthKit
import ClerkKit

@Observable
final class AppState {
    enum Screen: Equatable {
        case signIn
        case registeringDevice  // Signed in via Clerk, fetching device token
        case onboarding
        case home
    }

    private static let onboardingCompleteKey = "onboardingComplete"

    var onboardingComplete: Bool {
        get { UserDefaults.standard.bool(forKey: Self.onboardingCompleteKey) }
        set { UserDefaults.standard.set(newValue, forKey: Self.onboardingCompleteKey) }
    }

    private(set) var currentScreen: Screen
    private(set) var clientName: String?
    private(set) var coachName: String?
    private(set) var clientId: String?
    private(set) var registrationError: String?

    let apiClient = APIClient()
    let healthKit = HealthKitManager()
    private(set) var syncEngine: SyncEngine!

    init() {
        if KeychainService.deviceToken != nil {
            currentScreen = UserDefaults.standard.bool(forKey: Self.onboardingCompleteKey) ? .home : .onboarding
            clientName = KeychainService.clientName
            coachName = KeychainService.coachName
            clientId = KeychainService.clientId
        } else {
            currentScreen = .signIn
        }

        syncEngine = SyncEngine(healthKit: healthKit, api: apiClient)

        apiClient.onUnauthorized = { [weak self] in
            self?.signOut(message: "Your session has expired. Please sign in again.")
        }

        // If already set up, enable HealthKit background delivery
        if currentScreen == .home {
            setupHealthKitDelivery()
        }
    }

    var unpairMessage: String?

    // MARK: - Clerk Auth Completed

    /// Called after Clerk sign-in succeeds. Registers device with backend to get a long-lived token.
    func onClerkSignIn() async {
        currentScreen = .registeringDevice
        registrationError = nil

        do {
            // Get Clerk session JWT for the register-device call
            guard let token = try await Clerk.shared.session?.getToken() else {
                throw APIClient.APIError.server(statusCode: 0, message: "Could not get session token")
            }

            let response = try await apiClient.registerDevice(clerkToken: token)

            KeychainService.deviceToken = response.deviceToken
            KeychainService.clientId = response.clientId
            KeychainService.clientName = response.clientName
            KeychainService.coachName = response.coachName

            clientId = response.clientId
            clientName = response.clientName
            coachName = response.coachName
            unpairMessage = nil
            currentScreen = .onboarding
        } catch {
            registrationError = error.localizedDescription
            currentScreen = .signIn
        }
    }

    // MARK: - Legacy Pairing (kept for backward compatibility)

    func pair(code: String) async throws {
        let response = try await apiClient.pair(code: code)

        KeychainService.deviceToken = response.device_token!
        KeychainService.clientId = response.client_id!
        KeychainService.clientName = response.client?.name
        KeychainService.coachName = response.coach?.name

        clientId = response.client_id!
        clientName = response.client?.name
        coachName = response.coach?.name
        unpairMessage = nil
        currentScreen = .onboarding
    }

    func signOut(message: String? = nil) {
        KeychainService.clearAll()
        Task { try? await Clerk.shared.auth.signOut() }
        clientName = nil
        coachName = nil
        clientId = nil
        registrationError = nil
        unpairMessage = message
        currentScreen = .signIn
    }

    /// Get a Clerk session token for authenticated web views
    func getSessionToken() async -> String? {
        try? await Clerk.shared.auth.getToken()
    }

    // MARK: - Onboarding

    func completeOnboarding() async {
        onboardingComplete = true
        currentScreen = .home

        // Now do HealthKit setup if authorized
        if healthKit.isAuthorized {
            setupHealthKitDelivery()
            await syncEngine.performInitialBackfill()
            CoachFitApp.scheduleNextBackgroundSync()
        }
    }

    func submitOnboardingProfile(goal: String?, heightCm: Double?, weightKg: Double?, activityLevel: String?) async {
        guard let clientId = KeychainService.clientId else { return }

        struct ProfilePayload: Encodable {
            let client_id: String
            let goal: String?
            let height_cm: Double?
            let weight_kg: Double?
            let activity_level: String?
        }

        let payload = ProfilePayload(
            client_id: clientId,
            goal: goal,
            height_cm: heightCm,
            weight_kg: weightKg,
            activity_level: activityLevel
        )

        _ = try? await apiClient.authenticatedRequest(
            path: "/api/ingest/profile",
            method: "POST",
            body: payload
        )
    }

    // MARK: - HealthKit

    private func requestHealthKitAndBackfill() async {
        guard healthKit.isAvailable else { return }

        do {
            try await healthKit.requestAuthorization()
            setupHealthKitDelivery()
            await syncEngine.performInitialBackfill()
            CoachFitApp.scheduleNextBackgroundSync()
        } catch {
            print("[AppState] HealthKit authorization failed: \(error.localizedDescription)")
        }
    }

    private func setupHealthKitDelivery() {
        healthKit.enableBackgroundDelivery { [weak self] type in
            guard let self else { return }
            Task { @MainActor in
                await self.syncEngine.syncType(type)
            }
        }
    }

    // MARK: - Foreground Catch-Up

    func onForegroundEntry() async {
        guard currentScreen == .home else { return }
        await syncEngine.syncAll()
    }
}
