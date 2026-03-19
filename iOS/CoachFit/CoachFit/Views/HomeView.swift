import SwiftUI
import UIKit

struct HomeView: View {
    @Environment(AppState.self) private var appState

    var body: some View {
        TabView {
            Tab("Today", systemImage: "checkmark.circle") {
                TodayTab()
            }
            Tab("Log Food", systemImage: "plus.circle") {
                FoodLogEntryView()
            }
            Tab("Food", systemImage: "fork.knife") {
                NavigationStack {
                    FoodLogView()
                        .navigationTitle("Food Log")
                }
            }
            Tab("Health", systemImage: "heart.text.square") {
                NavigationStack {
                    HealthDashboardView()
                        .navigationTitle("Health")
                }
            }
            Tab("More", systemImage: "ellipsis.circle") {
                MoreTab()
            }
        }
    }
}

// MARK: - More Tab

private struct MoreTab: View {
    @Environment(AppState.self) private var appState

    @State private var showUnpairConfirmation = false
    @State private var streakData: StreakService.StreakData?

    private var syncIsStale: Bool {
        guard let lastSync = appState.syncEngine.lastSyncTime else { return false }
        return lastSync.timeIntervalSinceNow < -12 * 3600 // More than 12 hours ago
    }

    var body: some View {
        NavigationStack {
            List {
                if let streak = streakData {
                    Section {
                        StreakBanner(currentStreak: streak.currentStreak, longestStreak: streak.longestStreak)
                            .listRowInsets(EdgeInsets())
                            .listRowBackground(Color.clear)
                    }

                    if !streak.milestones.isEmpty {
                        Section("Recent Milestones") {
                            ForEach(streak.milestones.prefix(3)) { milestone in
                                MilestoneCard(milestone: milestone)
                                    .listRowInsets(EdgeInsets())
                                    .listRowBackground(Color.clear)
                            }
                        }
                    }
                }

                if let coachName = appState.coachName {
                    Section {
                        LabeledContent("Coach", value: coachName)
                    }
                }

                Section {
                    if appState.syncEngine.isSyncing {
                        HStack {
                            Text("Syncing...")
                            Spacer()
                            ProgressView()
                        }
                    } else if let lastSync = appState.syncEngine.lastSyncTime {
                        LabeledContent("Last Sync", value: lastSync.formatted(.relative(presentation: .named)))
                    } else {
                        LabeledContent("HealthKit Sync", value: "Not yet synced")
                            .foregroundStyle(.secondary)
                    }

                    SyncTypeRow(label: "Steps", systemImage: "figure.walk", status: appState.syncEngine.stepsStatus)
                    SyncTypeRow(label: "Workouts", systemImage: "dumbbell", status: appState.syncEngine.workoutsStatus)
                    SyncTypeRow(label: "Sleep", systemImage: "moon.zzz", status: appState.syncEngine.sleepStatus)
                    SyncTypeRow(label: "Weight", systemImage: "scalemass", status: appState.syncEngine.weightStatus)

                    Button {
                        Task { await appState.syncEngine.syncAll() }
                    } label: {
                        Label("Sync Now", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(appState.syncEngine.isSyncing)

                    if !appState.healthKit.isAvailable {
                        Label("HealthKit not available on this device", systemImage: "exclamationmark.triangle")
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                } header: {
                    Text("Sync Status")
                } footer: {
                    if syncIsStale {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Sync may have stopped", systemImage: "exclamationmark.triangle.fill")
                                .font(.caption.bold())
                                .foregroundStyle(.orange)
                            Text("If you force-quit the app (swipe up from the app switcher), background syncing stops. Just open the app occasionally or avoid force-quitting to keep your data up to date.")
                                .font(.caption)
                        }
                        .padding(.top, 4)
                    } else {
                        Text("Your health data syncs automatically in the background. Avoid force-quitting the app to keep syncing active.")
                            .font(.caption)
                    }
                }

                Section {
                    Button {
                        Task { await openInSafari(path: "/client-dashboard") }
                    } label: {
                        Label("View Full Dashboard", systemImage: "safari")
                    }

                    Button {
                        Task { await openInSafari(path: "/client-dashboard") }
                    } label: {
                        Label("Answer Questionnaire", systemImage: "list.clipboard")
                    }
                }

                Section {
                    Button(role: .destructive) {
                        showUnpairConfirmation = true
                    } label: {
                        Label("Unpair Device", systemImage: "xmark.circle")
                    }
                }

                Section {
                    LabeledContent("Version", value: Bundle.main.appVersion)
                } footer: {
                    Text("CoachFit for iOS")
                }
            }
            .navigationTitle("More")
            .confirmationDialog(
                "Unpair this device?",
                isPresented: $showUnpairConfirmation,
                titleVisibility: .visible
            ) {
                Button("Unpair", role: .destructive) {
                    appState.signOut()
                }
            } message: {
                Text("You'll need to sign in again to reconnect.")
            }
            .task {
                if KeychainService.deviceToken != nil {
                    streakData = try? await StreakService.fetch(using: appState.apiClient)
                }
            }
        }
    }

    private func openInSafari(path: String) async {
        guard let token = await appState.getSessionToken() else {
            // Fallback: open without token
            if let url = URL(string: "https://gcgyms.com\(path)") {
                await UIApplication.shared.open(url)
            }
            return
        }

        // Build handoff URL with token and redirect
        var components = URLComponents(string: "https://gcgyms.com/api/auth/mobile-handoff")!
        components.queryItems = [
            URLQueryItem(name: "token", value: token),
            URLQueryItem(name: "redirect", value: path),
        ]

        if let url = components.url {
            await UIApplication.shared.open(url)
        }
    }
}

// MARK: - Sync Type Row

private struct SyncTypeRow: View {
    let label: String
    let systemImage: String
    let status: SyncEngine.TypeStatus

    var body: some View {
        HStack {
            Label(label, systemImage: systemImage)
                .font(.subheadline)

            Spacer()

            if let error = status.lastError {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundStyle(.red)
                    .help(error)
            } else if let lastSync = status.lastSync {
                VStack(alignment: .trailing, spacing: 2) {
                    Text(lastSync.formatted(.relative(presentation: .named)))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if status.lastCount > 0 {
                        Text("\(status.lastCount) items")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
            } else {
                Text("—")
                    .font(.caption)
                    .foregroundStyle(.quaternary)
            }
        }
    }
}

// MARK: - Bundle Extension

extension Bundle {
    var appVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}

#Preview {
    HomeView()
        .environment(AppState())
}
