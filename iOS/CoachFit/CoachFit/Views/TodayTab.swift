import SwiftUI

struct TodayTab: View {
    @Environment(AppState.self) private var appState
    @FocusState private var focusedField: Field?

    @State private var weight = ""
    @State private var steps = ""
    @State private var calories = ""
    @State private var sleepQuality: Int?
    @State private var perceivedStress: Int?
    @State private var notes = ""

    @State private var healthData: HealthKitManager.TodayHealthData?

    @State private var isSubmitting = false
    @State private var submittedToday = false
    @State private var errorMessage: String?

    private enum Field { case weight, steps, calories, notes }

    var body: some View {
        NavigationStack {
            Group {
                if submittedToday {
                    submittedView
                } else {
                    formView
                }
            }
            .navigationTitle("Today")
            .task { await loadHealthKitData() }
        }
    }

    // MARK: - Form View

    private var formView: some View {
        Form {
            healthKitSection

            Section {
                if healthData?.weightLbs == nil {
                    HStack {
                        Label("Weight (lbs)", systemImage: "scalemass")
                        TextField("Optional", text: $weight)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .focused($focusedField, equals: .weight)
                    }
                }

                if healthData?.steps == nil {
                    HStack {
                        Label("Steps", systemImage: "figure.walk")
                        TextField("Optional", text: $steps)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .focused($focusedField, equals: .steps)
                    }
                }

                HStack {
                    Label("Calories", systemImage: "flame")
                    TextField("Optional", text: $calories)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .focused($focusedField, equals: .calories)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Label("Sleep Quality", systemImage: "moon.zzz")
                    RatingPicker(value: $sleepQuality, range: 1...10, label: "sleep")
                }

                VStack(alignment: .leading, spacing: 8) {
                    Label("Perceived Stress", systemImage: "brain.head.profile")
                    RatingPicker(value: $perceivedStress, range: 1...10, label: "stress")
                }
            } header: {
                Text("Check-in")
            } footer: {
                Text("Track your calories from Cronometer using the Import tab.")
            }

            Section("Notes") {
                TextField("How are you feeling today?", text: $notes, axis: .vertical)
                    .lineLimit(3...6)
                    .focused($focusedField, equals: .notes)
            }

            Section {
                Button {
                    focusedField = nil
                    Task { await submitEntry() }
                } label: {
                    if isSubmitting {
                        HStack {
                            Spacer()
                            ProgressView()
                            Spacer()
                        }
                    } else {
                        HStack {
                            Spacer()
                            Text("Submit")
                                .bold()
                            Spacer()
                        }
                    }
                }
                .disabled(isSubmitting || !hasAnyData)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedField = nil }
            }
        }
    }

    // MARK: - Submitted View

    private var submittedView: some View {
        List {
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundStyle(.green)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Check-in submitted")
                            .font(.headline)
                        Text("Your coach can see today's entry.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("What you logged") {
                if let hw = healthData?.weightLbs {
                    summaryRow("Weight", value: String(format: "%.1f lbs", hw), icon: "scalemass", badge: "Apple Health")
                } else if let w = Double(weight) {
                    summaryRow("Weight", value: String(format: "%.1f lbs", w), icon: "scalemass")
                }

                if let hs = healthData?.steps {
                    summaryRow("Steps", value: "\(hs)", icon: "figure.walk", badge: "Apple Health")
                } else if let s = Int(steps) {
                    summaryRow("Steps", value: "\(s)", icon: "figure.walk")
                }

                if let c = Int(calories) {
                    summaryRow("Calories", value: "\(c)", icon: "flame")
                }

                if let sq = sleepQuality {
                    summaryRow("Sleep Quality", value: "\(sq)/10", icon: "moon.zzz")
                }

                if let ps = perceivedStress {
                    summaryRow("Perceived Stress", value: "\(ps)/10", icon: "brain.head.profile")
                }

                if !notes.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Notes", systemImage: "note.text")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(notes)
                            .font(.body)
                    }
                }
            }

            Section {
                Button {
                    submittedToday = false
                } label: {
                    Label("Edit Entry", systemImage: "pencil")
                }

                Button {
                    resetForm()
                } label: {
                    Label("New Entry for Tomorrow", systemImage: "calendar.badge.plus")
                }
                .disabled(true)  // Can't submit for tomorrow
            }
        }
    }

    // MARK: - Helpers

    private func summaryRow(_ label: String, value: String, icon: String, badge: String? = nil) -> some View {
        HStack {
            Label(label, systemImage: icon)
                .font(.subheadline)
            Spacer()
            Text(value)
                .fontWeight(.medium)
            if let badge {
                HealthBadge(text: badge)
            }
        }
    }

    @ViewBuilder
    private var healthKitSection: some View {
        let data = healthData
        let hasData = data?.steps != nil || data?.weightLbs != nil
            || !(data?.recentWorkouts.isEmpty ?? true)
            || data?.lastNightSleep != nil

        if hasData {
            Section {
                if let steps = data?.steps {
                    HStack {
                        Label("Steps", systemImage: "figure.walk")
                        Spacer()
                        Text("\(steps.formatted())")
                            .foregroundStyle(.secondary)
                        HealthBadge()
                    }
                }

                if let weight = data?.weightLbs {
                    HStack {
                        Label("Weight", systemImage: "scalemass")
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(String(format: "%.1f lbs", weight))
                                .foregroundStyle(.secondary)
                            if let date = data?.weightDate, !Calendar.current.isDateInToday(date) {
                                Text(date.formatted(.relative(presentation: .named)))
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        HealthBadge()
                    }
                }

                if let sleep = data?.lastNightSleep {
                    HStack {
                        Label("Sleep", systemImage: "moon.zzz")
                        Spacer()
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(formatSleepDuration(sleep.totalSleepMinutes))
                                .foregroundStyle(.secondary)
                            HStack(spacing: 6) {
                                if let deep = sleep.asleepDeepMinutes, deep > 0 {
                                    Text("Deep \(deep)m")
                                }
                                if let rem = sleep.asleepREMMinutes, rem > 0 {
                                    Text("REM \(rem)m")
                                }
                            }
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                        }
                        HealthBadge()
                    }
                }

                if let workouts = data?.recentWorkouts, !workouts.isEmpty {
                    ForEach(workouts.suffix(5), id: \.startTime) { workout in
                        HStack {
                            Label(formatWorkoutType(workout.workoutType), systemImage: workoutIcon(workout.workoutType))
                            Spacer()
                            VStack(alignment: .trailing, spacing: 2) {
                                Text(formatDuration(workout.durationSeconds))
                                    .foregroundStyle(.secondary)
                                HStack(spacing: 6) {
                                    if let cal = workout.caloriesActive, cal > 0 {
                                        Text("\(Int(cal)) kcal")
                                    }
                                    Text(workout.startTime.formatted(.relative(presentation: .named)))
                                }
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            }
                            HealthBadge()
                        }
                    }
                }
            } header: {
                Text("From Apple Health")
            }
        }
    }

    private func formatSleepDuration(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }

    private func formatDuration(_ seconds: Double) -> String {
        let h = Int(seconds) / 3600
        let m = (Int(seconds) % 3600) / 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }

    private func formatWorkoutType(_ type: String) -> String {
        type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func workoutIcon(_ type: String) -> String {
        switch type.lowercased() {
        case "running": return "figure.run"
        case "walking": return "figure.walk"
        case "cycling": return "figure.outdoor.cycle"
        case "swimming": return "figure.pool.swim"
        case "strength_training": return "dumbbell"
        case "hiit": return "flame"
        case "yoga": return "figure.yoga"
        case "hiking": return "figure.hiking"
        default: return "figure.mixed.cardio"
        }
    }

    private var hasAnyData: Bool {
        !weight.isEmpty || !steps.isEmpty || !calories.isEmpty
            || sleepQuality != nil || perceivedStress != nil || !notes.isEmpty
            || healthData?.steps != nil || healthData?.weightLbs != nil
    }

    private func resetForm() {
        weight = ""
        steps = ""
        calories = ""
        sleepQuality = nil
        perceivedStress = nil
        notes = ""
        submittedToday = false
        errorMessage = nil
    }

    // MARK: - Actions

    private func loadHealthKitData() async {
        guard appState.healthKit.isAvailable else { return }
        do {
            healthData = try await appState.healthKit.fetchTodayData()
        } catch {
            print("[TodayTab] Failed to load HealthKit data: \(error.localizedDescription)")
        }
    }

    private func submitEntry() async {
        guard let clientId = appState.clientId else { return }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        let today = dateFormatter.string(from: .now)

        let entry = APIClient.SubmitEntryRequest(
            client_id: clientId,
            date: today,
            weightLbs: Double(weight),
            steps: Int(steps) ?? healthData?.steps,
            calories: Int(calories),
            sleepQuality: sleepQuality,
            perceivedStress: perceivedStress,
            notes: notes.isEmpty ? nil : notes
        )

        do {
            try await appState.apiClient.submitEntry(entry)
            submittedToday = true
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Supporting Views

private struct HealthBadge: View {
    var text: String = "Apple Health"

    var body: some View {
        Text(text)
            .font(.caption2)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(.red.opacity(0.12))
            .foregroundStyle(.red)
            .clipShape(Capsule())
    }
}

private struct RatingPicker: View {
    @Binding var value: Int?
    let range: ClosedRange<Int>
    let label: String

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(range), id: \.self) { n in
                Button {
                    value = (value == n) ? nil : n
                } label: {
                    Text("\(n)")
                        .font(.caption.bold())
                        .frame(width: 28, height: 28)
                        .background(value == n ? Color.accentColor : Color(.systemGray5))
                        .foregroundStyle(value == n ? .white : .primary)
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
            }
        }
    }
}

#Preview {
    TodayTab()
        .environment(AppState())
}
