import SwiftUI

struct HealthDashboardView: View {
    @Environment(AppState.self) private var appState

    @State private var todaySummary: HealthKitManager.DailyHealthSummary?
    @State private var weekSummaries: [HealthKitManager.DailyHealthSummary] = []
    @State private var recentWorkouts: [HealthKitManager.WorkoutSample] = []
    @State private var isLoading = true

    private var healthKit: HealthKitManager { appState.healthKit }
    private var syncEngine: SyncEngine { appState.syncEngine }
    private var isPaired: Bool { KeychainService.deviceToken != nil }

    var body: some View {
        NavigationStack {
            Group {
                if isLoading {
                    checkingView
                } else if !healthKit.isAvailable {
                    unavailableView
                } else if !healthKit.isAuthorized {
                    needsPermissionView
                } else {
                    connectedView
                }
            }
            .navigationTitle("Health")
            .task { await loadData() }
        }
    }

    // MARK: - Checking State

    private var checkingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Checking health data availability...")
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Unavailable State

    private var unavailableView: some View {
        ContentUnavailableView(
            "Health Data Unavailable",
            systemImage: "heart.slash",
            description: Text("Health data is not available on this device.")
        )
    }

    // MARK: - Needs Permission State

    private var needsPermissionView: some View {
        VStack(spacing: 24) {
            Image(systemName: "heart.text.square")
                .font(.system(size: 64))
                .foregroundStyle(.red)

            Text("Health Access Required")
                .font(.title2.bold())

            Text("CoachFit uses HealthKit to read your steps, workouts, sleep, weight, and other health metrics so your coach can track your progress.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 32)

            Button {
                Task {
                    try? await healthKit.requestAuthorization()
                    await loadData()
                }
            } label: {
                Label("Enable Health Access", systemImage: "heart.fill")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 32)
        }
    }

    // MARK: - Connected State

    private var connectedView: some View {
        ScrollView {
            LazyVStack(spacing: 24) {
                todaySummarySection
                recentWorkoutsSection
                weekHistorySection
                if isPaired {
                    syncStatusSection
                }
            }
            .padding()
        }
        .refreshable { await loadData() }
    }

    // MARK: - Section 1: Today's Summary

    private var todaySummarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Today's Summary")
                .font(.headline)

            let columns = [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12),
            ]

            LazyVGrid(columns: columns, spacing: 12) {
                SummaryTile(
                    label: "Steps",
                    value: todaySummary?.steps.map { Self.stepsFormatter.string(from: NSNumber(value: $0)) ?? "\($0)" },
                    icon: "figure.walk",
                    color: .green
                )
                SummaryTile(
                    label: "Active Cal",
                    value: todaySummary?.activeCalories.map { "\($0) kcal" },
                    icon: "flame.fill",
                    color: .orange
                )
                SummaryTile(
                    label: "Total Burned",
                    value: todaySummary?.totalCaloriesBurned.map { "\($0) kcal" },
                    icon: "flame",
                    color: .red
                )
                SummaryTile(
                    label: "Distance",
                    value: todaySummary?.distanceMeters.map { Self.formatDistance($0) },
                    icon: "map",
                    color: .blue
                )
                SummaryTile(
                    label: "Exercise",
                    value: todaySummary?.exerciseMinutes.map { Self.formatDuration($0) },
                    icon: "timer",
                    color: .mint
                )
                SummaryTile(
                    label: "Weight",
                    value: todaySummary?.weight.map { String(format: "%.1f kg", $0) },
                    icon: "scalemass",
                    color: .purple
                )
                SummaryTile(
                    label: "Body Fat",
                    value: todaySummary?.bodyFatPercentage.map { String(format: "%.1f%%", $0) },
                    icon: "percent",
                    color: .indigo
                )
                SummaryTile(
                    label: "Sleep",
                    value: todaySummary?.sleepMinutes.map { Self.formatDuration($0) },
                    icon: "moon.fill",
                    color: .cyan
                )
                SummaryTile(
                    label: "Water",
                    value: todaySummary?.waterLiters.map { String(format: "%.1f L", $0) },
                    icon: "drop.fill",
                    color: .teal
                )
            }
        }
    }

    // MARK: - Section 2: Recent Workouts

    private var recentWorkoutsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recent Workouts")
                .font(.headline)

            if recentWorkouts.isEmpty {
                Text("No workouts in the last 7 days.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(recentWorkouts.enumerated()), id: \.offset) { _, workout in
                    WorkoutRow(workout: workout)
                }
            }
        }
    }

    // MARK: - Section 3: Week History

    private var weekHistorySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Week History")
                .font(.headline)

            if weekSummaries.isEmpty {
                Text("No data available.")
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .center)
                    .padding(.vertical, 8)
            } else {
                ForEach(Array(weekSummaries.enumerated()), id: \.offset) { _, day in
                    WeekDayRow(summary: day)
                }
            }
        }
    }

    // MARK: - Section 4: Sync Status

    private var syncStatusSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Sync Status")
                .font(.headline)

            if let lastSync = syncEngine.lastSyncTime {
                HStack {
                    Text("Last sync")
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(lastSync, style: .relative)
                        .foregroundStyle(.secondary)
                    Text("ago")
                        .foregroundStyle(.secondary)
                }
                .font(.subheadline)
            }

            Button {
                Task { await syncEngine.syncAll() }
            } label: {
                HStack {
                    if syncEngine.isSyncing {
                        ProgressView()
                            .controlSize(.small)
                    }
                    Text(syncEngine.isSyncing ? "Syncing..." : "Sync Now")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .disabled(syncEngine.isSyncing)

            SyncTypeRow(label: "Workouts", status: syncEngine.workoutsStatus)
            SyncTypeRow(label: "Sleep", status: syncEngine.sleepStatus)
            SyncTypeRow(label: "Steps", status: syncEngine.stepsStatus)
            SyncTypeRow(label: "Weight", status: syncEngine.weightStatus)
        }
    }

    // MARK: - Data Loading

    private func loadData() async {
        isLoading = true
        defer { isLoading = false }

        guard healthKit.isAvailable, healthKit.isAuthorized else { return }

        let calendar = Calendar.current
        let sevenDaysAgo = calendar.date(byAdding: .day, value: -7, to: .now)!

        async let summaryTask = healthKit.fetchDailySummary(for: .now)
        async let weekTask = healthKit.fetchWeekSummaries()

        todaySummary = await summaryTask
        weekSummaries = await weekTask
        recentWorkouts = (try? await healthKit.fetchWorkouts(since: sevenDaysAgo)) ?? []
    }

    // MARK: - Formatters

    fileprivate static let stepsFormatter: NumberFormatter = {
        let f = NumberFormatter()
        f.numberStyle = .decimal
        f.groupingSeparator = ","
        return f
    }()

    fileprivate static func formatDistance(_ meters: Int) -> String {
        let km = Double(meters) / 1000.0
        return String(format: "%.1f km", km)
    }

    fileprivate static func formatDuration(_ minutes: Int) -> String {
        let hrs = minutes / 60
        let mins = minutes % 60
        if hrs > 0 {
            return "\(hrs) hr \(mins) min"
        }
        return "\(mins) min"
    }

    fileprivate static let workoutDateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MMM d, h:mm a"
        return f
    }()
}

// MARK: - SummaryTile

private struct SummaryTile: View {
    let label: String
    let value: String?
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.caption)
                    .foregroundStyle(color)
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Text(value ?? "\u{2014}")
                .font(.title3.bold())
                .foregroundStyle(value != nil ? .primary : .secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - WorkoutRow

private struct WorkoutRow: View {
    let workout: HealthKitManager.WorkoutSample

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconForWorkoutType(workout.workoutType))
                .font(.title3)
                .foregroundStyle(.orange)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 2) {
                Text(displayName(for: workout.workoutType))
                    .font(.subheadline.bold())

                HStack(spacing: 8) {
                    Text(formatWorkoutDuration(workout.durationSeconds))
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if let cals = workout.caloriesActive {
                        Text("\(Int(cals)) kcal")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Text(HealthDashboardView.workoutDateFormatter.string(from: workout.startTime))
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private func iconForWorkoutType(_ type: String) -> String {
        switch type {
        case "running": return "figure.run"
        case "cycling": return "figure.outdoor.cycle"
        case "walking": return "figure.walk"
        case "swimming": return "figure.pool.swim"
        case "hiking": return "figure.hiking"
        case "yoga": return "figure.yoga"
        case "strength_training": return "figure.strengthtraining.traditional"
        case "hiit": return "figure.highintensity.intervaltraining"
        case "elliptical": return "figure.elliptical"
        case "rowing": return "figure.rowing"
        case "dance": return "figure.dance"
        case "cooldown": return "figure.cooldown"
        case "core_training": return "figure.core.training"
        case "flexibility": return "figure.flexibility"
        case "pilates": return "figure.pilates"
        default: return "figure.mixed.cardio"
        }
    }

    private func displayName(for type: String) -> String {
        type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func formatWorkoutDuration(_ seconds: Double) -> String {
        let mins = Int(seconds / 60)
        let hrs = mins / 60
        let remainMins = mins % 60
        if hrs > 0 {
            return "\(hrs) hr \(remainMins) min"
        }
        return "\(remainMins) min"
    }
}

// MARK: - WeekDayRow

private struct WeekDayRow: View {
    let summary: HealthKitManager.DailyHealthSummary

    private static let displayFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "EEE, MMM d"
        return f
    }()

    private static let parseFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    var body: some View {
        HStack {
            Text(formattedDate)
                .font(.subheadline.bold())
                .frame(width: 90, alignment: .leading)

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                if let steps = summary.steps {
                    Label("\(steps)", systemImage: "figure.walk")
                        .font(.caption)
                }
                if let cals = summary.totalCaloriesBurned {
                    Label("\(cals) kcal", systemImage: "flame")
                        .font(.caption)
                }
                if let sleep = summary.sleepMinutes {
                    Label(HealthDashboardView.formatDuration(sleep), systemImage: "moon.fill")
                        .font(.caption)
                }
            }
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }

    private var formattedDate: String {
        guard let date = Self.parseFormatter.date(from: summary.date) else {
            return summary.date
        }
        return Self.displayFormatter.string(from: date)
    }
}

// MARK: - SyncTypeRow

private struct SyncTypeRow: View {
    let label: String
    let status: SyncEngine.TypeStatus

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)

            Spacer()

            if let error = status.lastError {
                Image(systemName: "exclamationmark.triangle.fill")
                    .foregroundStyle(.yellow)
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .lineLimit(1)
            } else if let lastSync = status.lastSync {
                Text("\(status.lastCount) items")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(lastSync, style: .relative)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            } else {
                Text("Not synced")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

