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
    @State private var showCheckIn = false
    @State private var errorMessage: String?
    @State private var showSuccessAnimation = false

    private enum Field { case weight, steps, calories, notes }

    private var todayKey: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return "checkin_\(f.string(from: .now))"
    }

    private var submittedToday: Bool {
        UserDefaults.standard.bool(forKey: todayKey)
    }

    private var coachName: String {
        appState.coachName ?? "your coach"
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if submittedToday && !showCheckIn {
                    ScrollView {
                        VStack(spacing: 12) {
                            streakCard
                            if let data = healthData { autoTrackedSection(data) }
                            submittedCard
                        }
                        .padding()
                    }
                } else {
                    checkInSection
                }
            }
            .navigationTitle("Today")
            .toolbar {
                if submittedToday && showCheckIn {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") {
                            showCheckIn = false
                        }
                    }
                }
            }
            .task { await loadHealthKitData() }
            .refreshable { await loadHealthKitData() }
            .overlay {
                if showSuccessAnimation {
                    successOverlay
                }
            }
        }
    }

    // MARK: - Streak Banner

    private var streakCard: some View {
        HStack {
            Image(systemName: "flame.fill")
                .foregroundStyle(.orange)
                .font(.title2)
            VStack(alignment: .leading, spacing: 2) {
                Text("Check-in Streak")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                // TODO: fetch actual streak from StreakService
                Text(submittedToday ? "Keep it going!" : "Check in to keep your streak")
                    .font(.subheadline.weight(.medium))
            }
            Spacer()
            if submittedToday {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.title2)
            }
        }
        .padding()
        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Auto-Tracked Section

    private func autoTrackedSection(_ data: HealthKitManager.TodayHealthData) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("From Apple Health")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                Spacer()
            }

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
                if let s = data.steps {
                    MetricTile(icon: "figure.walk", label: "Steps", value: s.formatted(), color: .green)
                }
                if let w = data.weightLbs {
                    MetricTile(icon: "scalemass", label: "Weight", value: String(format: "%.1f lbs", w), color: .blue)
                }
                if let sleep = data.lastNightSleep {
                    MetricTile(icon: "moon.zzz", label: "Sleep", value: formatSleepDuration(sleep.totalSleepMinutes), color: .purple)
                }
                if !data.recentWorkouts.isEmpty {
                    let totalMin = data.recentWorkouts.reduce(0) { $0 + Int($1.durationSeconds / 60) }
                    MetricTile(icon: "flame", label: "Exercise", value: "\(totalMin) min", color: .orange)
                }
            }
        }
    }

    // MARK: - Check-In Section

    private var checkInSection: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Streak
                streakCard

                // Today's HealthKit data as compact cards
                if let data = healthData,
                   data.steps != nil || data.weightLbs != nil || data.lastNightSleep != nil || !data.recentWorkouts.isEmpty {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                        if let s = data.steps {
                            CompactTile(icon: "figure.walk", value: s.formatted(), color: .green)
                        }
                        if let w = data.weightLbs {
                            CompactTile(icon: "scalemass", value: String(format: "%.0f", w), color: .blue)
                        }
                        if let sleep = data.lastNightSleep {
                            CompactTile(icon: "moon.zzz", value: formatSleepDuration(sleep.totalSleepMinutes), color: .purple)
                        }
                        if !data.recentWorkouts.isEmpty {
                            let totalMin = data.recentWorkouts.reduce(0) { $0 + Int($1.durationSeconds / 60) }
                            CompactTile(icon: "flame", value: "\(totalMin)m", color: .orange)
                        }
                    }
                }

                // Header
                Text("Let \(coachName) know how you're doing")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                // Sleep Quality (1-10)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label("Sleep Quality", systemImage: "moon.zzz")
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        if let sq = sleepQuality {
                            Text(sleepLabel(sq))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    RatingPicker(value: $sleepQuality, range: 1...10, label: "sleep")
                }

                // Perceived Stress (1-10)
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Label("Stress Level", systemImage: "brain.head.profile")
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        if let ps = perceivedStress {
                            Text(stressLabel(ps))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    RatingPicker(value: $perceivedStress, range: 1...10, label: "stress")
                }

                // Calories
                HStack {
                    Label("Calories", systemImage: "fork.knife")
                        .font(.subheadline.weight(.medium))
                    Spacer()
                    TextField("Enter", text: $calories)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 100)
                        .focused($focusedField, equals: .calories)
                }

                // Weight (only if not from HealthKit)
                if healthData?.weightLbs == nil {
                    HStack {
                        Label("Weight (lbs)", systemImage: "scalemass")
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        TextField("Enter", text: $weight)
                            .keyboardType(.decimalPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                            .focused($focusedField, equals: .weight)
                    }
                }

                // Steps (only if not from HealthKit)
                if healthData?.steps == nil {
                    HStack {
                        Label("Steps", systemImage: "figure.walk")
                            .font(.subheadline.weight(.medium))
                        Spacer()
                        TextField("Enter", text: $steps)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 100)
                            .focused($focusedField, equals: .steps)
                    }
                }

                // Quick Note Chips + Text
                VStack(alignment: .leading, spacing: 8) {
                    Label("How are you feeling?", systemImage: "text.bubble")
                        .font(.subheadline.weight(.medium))

                    FlowLayout(spacing: 8) {
                        NoteChip("Feeling strong", notes: $notes)
                        NoteChip("Low energy", notes: $notes)
                        NoteChip("Sore", notes: $notes)
                        NoteChip("Well rested", notes: $notes)
                        NoteChip("Stressed", notes: $notes)
                    }

                    TextField("Or type a note...", text: $notes, axis: .vertical)
                        .lineLimit(2...4)
                        .focused($focusedField, equals: .notes)
                        .textFieldStyle(.roundedBorder)
                }

                // Submit
                Button {
                    focusedField = nil
                    Task { await submitEntry() }
                } label: {
                    if isSubmitting {
                        ProgressView()
                            .frame(maxWidth: .infinity, minHeight: 20)
                    } else {
                        Text("Send to \(coachName)")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isSubmitting || !hasAnyData)

                if let errorMessage {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 20)
        }
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focusedField = nil }
            }
        }
    }

    // MARK: - Submitted Card

    private var submittedCard: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.title)
                    .foregroundStyle(.green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Checked in today")
                        .font(.headline)
                    Text("\(coachName) can see your entry")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }

            // Quick summary of what was logged
            HStack(spacing: 16) {
                if let sq = sleepQuality {
                    MiniStat(icon: "moon.zzz", value: "\(sq)/10")
                }
                if let ps = perceivedStress {
                    MiniStat(icon: "brain.head.profile", value: "\(ps)/10")
                }
                if !notes.isEmpty {
                    MiniStat(icon: "text.bubble", value: String(notes.prefix(20)) + (notes.count > 20 ? "..." : ""))
                }
            }

            Button {
                showCheckIn = true
            } label: {
                Label("Edit", systemImage: "pencil")
                    .font(.subheadline)
            }
            .buttonStyle(.bordered)
        }
        .padding()
        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Success Overlay

    private var successOverlay: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)
                .symbolEffect(.bounce, value: showSuccessAnimation)
            Text("Sent to \(coachName)!")
                .font(.title3.bold())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial)
        .transition(.opacity)
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                withAnimation { showSuccessAnimation = false }
            }
        }
    }

    // MARK: - Helper Labels

    private func sleepLabel(_ value: Int) -> String {
        switch value {
        case 1...2: return "Very poor"
        case 3...4: return "Poor"
        case 5...6: return "Fair"
        case 7...8: return "Good"
        case 9...10: return "Excellent"
        default: return ""
        }
    }

    private func stressLabel(_ value: Int) -> String {
        switch value {
        case 1...2: return "Very low"
        case 3...4: return "Low"
        case 5...6: return "Moderate"
        case 7...8: return "High"
        case 9...10: return "Very high"
        default: return ""
        }
    }

    private func formatSleepDuration(_ minutes: Int) -> String {
        let h = minutes / 60
        let m = minutes % 60
        if h > 0 { return "\(h)h \(m)m" }
        return "\(m)m"
    }

    private var hasAnyData: Bool {
        !weight.isEmpty || !steps.isEmpty || !calories.isEmpty
            || sleepQuality != nil || perceivedStress != nil || !notes.isEmpty
            || healthData?.steps != nil || healthData?.weightLbs != nil
    }

    // MARK: - Actions

    private func loadHealthKitData() async {
        guard appState.healthKit.isAvailable else { return }
        do {
            healthData = try await appState.healthKit.fetchTodayData()
        } catch {
            print("[TodayTab] Failed to load HealthKit data: \(error.localizedDescription)")
        }

        // Restore submitted state
        if submittedToday {
            // Load saved values
            let defaults = UserDefaults.standard
            sleepQuality = defaults.object(forKey: "\(todayKey)_sleep") as? Int
            perceivedStress = defaults.object(forKey: "\(todayKey)_stress") as? Int
            notes = defaults.string(forKey: "\(todayKey)_notes") ?? ""
        }
    }

    private func submitEntry() async {
        guard let clientId = appState.clientId else { return }
        errorMessage = nil
        isSubmitting = true
        defer { isSubmitting = false }

        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyy-MM-dd"
        dateFormatter.locale = Locale(identifier: "en_US_POSIX")
        dateFormatter.timeZone = .current
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

            // Persist check-in state for today
            let defaults = UserDefaults.standard
            defaults.set(true, forKey: todayKey)
            if let sq = sleepQuality { defaults.set(sq, forKey: "\(todayKey)_sleep") }
            if let ps = perceivedStress { defaults.set(ps, forKey: "\(todayKey)_stress") }
            if !notes.isEmpty { defaults.set(notes, forKey: "\(todayKey)_notes") }

            // Success feedback
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)

            withAnimation(.spring(duration: 0.4)) {
                showSuccessAnimation = true
                showCheckIn = false
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Supporting Views

private struct MetricTile: View {
    let icon: String
    let label: String
    let value: String
    let color: Color

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(value)
                    .font(.subheadline.weight(.semibold))
            }
            Spacer()
        }
        .padding(12)
        .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct CompactTile: View {
    let icon: String
    let value: String
    let color: Color

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(color)
            Text(value)
                .font(.subheadline.weight(.bold))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
    }
}

private struct MiniStat: View {
    let icon: String
    let value: String

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption)
        }
    }
}

private struct NoteChip: View {
    let text: String
    @Binding var notes: String

    init(_ text: String, notes: Binding<String>) {
        self.text = text
        self._notes = notes
    }

    private var isSelected: Bool {
        notes.contains(text)
    }

    var body: some View {
        Button {
            if isSelected {
                notes = notes.replacingOccurrences(of: text, with: "").trimmingCharacters(in: .whitespaces)
            } else {
                notes = notes.isEmpty ? text : "\(notes), \(text)"
            }
        } label: {
            Text(text)
                .font(.caption)
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor.opacity(0.15) : Color(.systemGray5))
                .foregroundStyle(isSelected ? Color.accentColor : .primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrange(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrange(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
        }
    }

    private func arrange(proposal: ProposedViewSize, subviews: Subviews) -> (size: CGSize, positions: [CGPoint]) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return (CGSize(width: maxWidth, height: y + rowHeight), positions)
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
                    let generator = UISelectionFeedbackGenerator()
                    generator.selectionChanged()
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
