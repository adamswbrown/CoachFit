import SwiftUI

struct ChallengesView: View {
    @Environment(AppState.self) private var appState

    @State private var service: ChallengeService?

    var body: some View {
        NavigationStack {
            ZStack {
                Color(hex: "#111111")
                    .ignoresSafeArea()

                if let service {
                    if service.isLoading && service.activeChallenge == nil {
                        ProgressView()
                            .tint(.white)
                    } else if let challenge = service.activeChallenge,
                              let progress = service.progress {
                        ChallengeProgressView(
                            challenge: challenge,
                            progress: progress,
                            startDate: service.startDate,
                            endDate: service.endDate,
                            daysRemaining: service.daysRemaining
                        )
                    } else {
                        emptyState
                    }

                    // Error banner
                    if let error = service.errorMessage {
                        VStack {
                            errorBanner(error)
                            Spacer()
                        }
                    }
                } else {
                    ProgressView()
                        .tint(.white)
                }
            }
            .navigationTitle("Challenges")
            .navigationBarTitleDisplayMode(.large)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .task {
                if service == nil {
                    service = ChallengeService(api: appState.apiClient)
                }
                await loadData()
            }
            .refreshable {
                await loadData()
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 12) {
            Image(systemName: "flame")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)

            Text("No active challenges")
                .font(.headline)
                .foregroundStyle(.white)

            Text("Ask your coach to enrol you")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(32)
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.yellow)
            Text(message)
                .font(.caption)
                .foregroundStyle(.white)
            Spacer()
            Button {
                withAnimation { service?.errorMessage = nil }
            } label: {
                Image(systemName: "xmark")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(.white.opacity(0.7))
            }
        }
        .padding(10)
        .background(Color.red.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal, 16)
        .padding(.top, 4)
        .transition(.move(edge: .top).combined(with: .opacity))
    }

    // MARK: - Data Loading

    private func loadData() async {
        guard let service else { return }
        await service.fetchActiveChallenge()

        if let cohortId = service.activeChallenge?.id {
            await service.fetchProgress(for: cohortId)
        }
    }
}
