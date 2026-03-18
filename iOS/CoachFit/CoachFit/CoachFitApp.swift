import BackgroundTasks
import SwiftData
import SwiftUI
import ClerkKit

@main
struct CoachFitApp: App {
    @State private var appState = AppState()
    @Environment(\.scenePhase) private var scenePhase

    init() {
        Clerk.configure(publishableKey: "pk_test_c2VjdXJlLW11c2tyYXQtMzAuY2xlcmsuYWNjb3VudHMuZGV2JA")
    }

    var body: some Scene {
        WindowGroup {
            Group {
                switch appState.currentScreen {
                case .signIn, .registeringDevice:
                    SignInView()
                case .home:
                    HomeView()
                }
            }
            .animation(.default, value: appState.currentScreen)
            .environment(appState)
            .environment(Clerk.shared)
            .onChange(of: scenePhase) { _, newPhase in
                if newPhase == .active {
                    Task { await appState.onForegroundEntry() }
                }
            }
        }
        .modelContainer(for: FoodLogEntry.self)
        .backgroundTask(.appRefresh("com.askadam.CoachFit.healthkit-sync")) {
            await appState.syncEngine.syncAll()
            await Self.scheduleNextBackgroundSync()
        }
    }

    /// Schedule the next BGAppRefreshTask. Called after each background sync completes.
    static func scheduleNextBackgroundSync() {
        let request = BGAppRefreshTaskRequest(identifier: "com.askadam.CoachFit.healthkit-sync")
        request.earliestBeginDate = Calendar.current.date(byAdding: .hour, value: 6, to: .now)
        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            print("[BGTask] Failed to schedule refresh: \(error.localizedDescription)")
        }
    }
}
