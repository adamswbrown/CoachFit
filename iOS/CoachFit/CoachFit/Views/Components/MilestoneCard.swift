import SwiftUI

struct MilestoneCard: View {
    let milestone: StreakService.Milestone

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "trophy.fill")
                    .foregroundStyle(.yellow)
                Text(milestone.title)
                    .font(.headline)
            }
            if let desc = milestone.description {
                Text(desc)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if let msg = milestone.coachMessage {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "quote.opening")
                        .foregroundStyle(.blue)
                        .font(.caption)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(msg)
                            .font(.subheadline)
                            .italic()
                        if let name = milestone.coachName {
                            Text("— \(name)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}
