import SwiftUI

struct StreakBanner: View {
    let currentStreak: Int
    let longestStreak: Int

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("Current Streak")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(currentStreak) day\(currentStreak == 1 ? "" : "s")")
                    .font(.title2.bold())
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 4) {
                Text("Longest")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text("\(longestStreak) day\(longestStreak == 1 ? "" : "s")")
                    .font(.title2.bold())
            }
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
