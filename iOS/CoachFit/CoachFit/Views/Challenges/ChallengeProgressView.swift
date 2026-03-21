import SwiftUI

struct ChallengeProgressView: View {
    let challenge: ActiveChallenge
    let progress: ChallengeProgress
    let startDate: Date?
    let endDate: Date?
    let daysRemaining: Int?

    private let totalWeeks: Int

    init(challenge: ActiveChallenge, progress: ChallengeProgress,
         startDate: Date?, endDate: Date?, daysRemaining: Int?) {
        self.challenge = challenge
        self.progress = progress
        self.startDate = startDate
        self.endDate = endDate
        self.daysRemaining = daysRemaining
        self.totalWeeks = challenge.durationWeeks ?? 6
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                headerSection
                progressRingSection
                statsRow
                weeklyGrid
                datesSection
            }
            .padding(16)
        }
        .background(Color(hex: "#111111"))
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: 4) {
            Text(challenge.name)
                .font(.title2.bold())
                .foregroundStyle(.white)

            if let remaining = daysRemaining {
                Text("\(remaining) days remaining")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Progress Ring

    private var progressRingSection: some View {
        ZStack {
            // Background ring
            Circle()
                .stroke(Color.white.opacity(0.1), lineWidth: 12)

            // Progress ring
            Circle()
                .trim(from: 0, to: CGFloat(progress.percentComplete) / 100.0)
                .stroke(
                    AngularGradient(
                        colors: [Color(hex: "#452ddb"), Color(hex: "#22c55e")],
                        center: .center
                    ),
                    style: StrokeStyle(lineWidth: 12, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.8), value: progress.percentComplete)

            // Center text
            VStack(spacing: 4) {
                Text("\(progress.percentComplete)%")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)

                Text("\(progress.daysCompleted)/\(progress.totalDays) days")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(width: 180, height: 180)
        .padding(.vertical, 8)
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(
                icon: "flame.fill",
                value: "\(progress.streak)",
                label: "Streak",
                color: .orange
            )

            Divider()
                .frame(height: 40)
                .background(Color.white.opacity(0.2))

            statItem(
                icon: "checkmark.circle.fill",
                value: "\(progress.daysCompleted)",
                label: "Check-ins",
                color: Color(hex: "#22c55e")
            )

            Divider()
                .frame(height: 40)
                .background(Color.white.opacity(0.2))

            statItem(
                icon: "percent",
                value: "\(Int(progress.checkInRate * 100))",
                label: "Rate",
                color: Color(hex: "#452ddb")
            )
        }
        .padding(.vertical, 16)
        .background(Color(hex: "#1c1c1e"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func statItem(icon: String, value: String, label: String, color: Color) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)

            Text(value)
                .font(.title3.bold())
                .foregroundStyle(.white)

            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Weekly Grid

    private var weeklyGrid: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Weekly Check-ins")
                .font(.headline)
                .foregroundStyle(.white)

            VStack(spacing: 4) {
                // Day headers
                HStack(spacing: 4) {
                    ForEach(["M", "T", "W", "T", "F", "S", "S"], id: \.self) { day in
                        Text(day)
                            .font(.caption2.weight(.medium))
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity)
                    }
                }

                // Week rows
                ForEach(1...totalWeeks, id: \.self) { week in
                    HStack(spacing: 4) {
                        ForEach(0..<7, id: \.self) { dayIndex in
                            let dayNumber = (week - 1) * 7 + dayIndex + 1
                            let isCompleted = isDayCompleted(week: week, dayIndex: dayIndex)
                            let isFuture = dayNumber > elapsedDays

                            RoundedRectangle(cornerRadius: 3)
                                .fill(cellColor(isCompleted: isCompleted, isFuture: isFuture))
                                .frame(maxWidth: .infinity)
                                .aspectRatio(1, contentMode: .fit)
                        }
                    }
                }
            }
            .padding(12)
            .background(Color(hex: "#1c1c1e"))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    private var elapsedDays: Int {
        guard let start = startDate else { return 0 }
        let days = Calendar.current.dateComponents([.day], from: start, to: .now).day ?? 0
        return max(0, days)
    }

    private func isDayCompleted(week: Int, dayIndex: Int) -> Bool {
        let weekEntries = progress.weeklyEntries[String(week)] ?? 0
        // The API gives total entries per week, not per day.
        // Show filled squares up to the count of entries for that week.
        return dayIndex < weekEntries
    }

    private func cellColor(isCompleted: Bool, isFuture: Bool) -> Color {
        if isFuture {
            return Color.white.opacity(0.05)
        } else if isCompleted {
            return Color(hex: "#22c55e")
        } else {
            return Color.white.opacity(0.1)
        }
    }

    // MARK: - Dates Section

    private var datesSection: some View {
        HStack {
            if let start = startDate {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Started")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(start.formatted(.dateTime.day().month(.abbreviated).year()))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                }
            }

            Spacer()

            if let end = endDate {
                VStack(alignment: .trailing, spacing: 2) {
                    Text("Ends")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Text(end.formatted(.dateTime.day().month(.abbreviated).year()))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white)
                }
            }
        }
        .padding(16)
        .background(Color(hex: "#1c1c1e"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}
