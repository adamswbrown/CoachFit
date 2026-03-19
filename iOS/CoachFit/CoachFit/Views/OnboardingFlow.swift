import SwiftUI

struct OnboardingFlow: View {
    @Environment(AppState.self) private var appState
    @State private var currentPage = 0

    // Collected data
    @State private var selectedGoal: String?
    @State private var heightCm: String = ""
    @State private var weightKg: String = ""
    @State private var activityLevel: String?
    @State private var healthKitConnected = false

    private let totalPages = 7

    var body: some View {
        VStack(spacing: 0) {
            // Progress dots
            HStack(spacing: 8) {
                ForEach(0..<totalPages, id: \.self) { i in
                    Circle()
                        .fill(i <= currentPage ? Color.accentColor : Color.gray.opacity(0.3))
                        .frame(width: 8, height: 8)
                }
            }
            .padding(.top, 16)

            TabView(selection: $currentPage) {
                WelcomeStep(coachName: appState.coachName ?? "your coach", onNext: next)
                    .tag(0)

                GoalStep(selectedGoal: $selectedGoal, onNext: next)
                    .tag(1)

                ProfileStep(heightCm: $heightCm, weightKg: $weightKg,
                           activityLevel: $activityLevel, onNext: next, onSkip: next)
                    .tag(2)

                FoodTrackingStep(onNext: next)
                    .tag(3)

                HealthKitStep(connected: $healthKitConnected, onNext: next, onSkip: next)
                    .tag(4)

                CheckInStep(onNext: next)
                    .tag(5)

                CompletionStep(
                    coachName: appState.coachName ?? "your coach",
                    goal: selectedGoal,
                    healthKitConnected: healthKitConnected,
                    onFinish: finish
                )
                    .tag(6)
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.easeInOut, value: currentPage)
        }
    }

    private func next() {
        withAnimation {
            currentPage = min(currentPage + 1, totalPages - 1)
        }
    }

    private func finish() {
        Task {
            // Submit profile data to API
            await appState.submitOnboardingProfile(
                goal: selectedGoal,
                heightCm: Double(heightCm),
                weightKg: Double(weightKg),
                activityLevel: activityLevel
            )
            await appState.completeOnboarding()
        }
    }
}
