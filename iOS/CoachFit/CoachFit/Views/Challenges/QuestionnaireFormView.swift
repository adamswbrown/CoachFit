import SwiftUI

struct QuestionnaireFormView: View {
    let cohortId: String
    let weekNumber: Int
    let service: QuestionnaireService

    @Environment(\.dismiss) private var dismiss
    @State private var responses: [String: String] = [:]
    @State private var autoSaveTask: Task<Void, Never>?
    @State private var showCompleteConfirmation = false

    private var isLocked: Bool {
        service.currentWeekData?.locked == true
    }

    private var questions: [QuestionnaireQuestion] {
        service.currentWeekData?.questions ?? []
    }

    private var requiredFieldsFilled: Bool {
        let required = questions.filter { $0.isRequired }
        return required.allSatisfy { q in
            let val = responses[q.name]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return !val.isEmpty
        }
    }

    var body: some View {
        ZStack {
            Color(hex: "#111111")
                .ignoresSafeArea()

            if service.isLoading {
                ProgressView()
                    .tint(.white)
            } else if let error = service.errorMessage, service.currentWeekData == nil {
                errorView(error)
            } else if service.currentWeekData != nil {
                formContent
            }
        }
        .navigationTitle("Week \(weekNumber)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                if service.isSaving {
                    ProgressView()
                        .tint(.white)
                        .scaleEffect(0.7)
                } else if service.saveSuccess && !isLocked {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Color(hex: "#22c55e"))
                        .font(.caption)
                }
            }
        }
        .task {
            await service.fetchWeekQuestions(cohortId: cohortId, weekNumber: weekNumber)
            populateExistingResponses()
        }
        .confirmationDialog(
            "Complete Week \(weekNumber)?",
            isPresented: $showCompleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Complete & Lock") {
                Task { await completeWeek() }
            }
        } message: {
            Text("Your responses will be locked and sent to your coach. This cannot be undone.")
        }
        .onDisappear {
            autoSaveTask?.cancel()
        }
    }

    // MARK: - Form Content

    private var formContent: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Status banner
                if isLocked {
                    statusBanner(
                        icon: "lock.fill",
                        text: "Responses submitted and locked",
                        color: Color(hex: "#22c55e")
                    )
                } else if service.currentWeekData?.status == "in_progress" {
                    statusBanner(
                        icon: "pencil.circle.fill",
                        text: "Draft saved -- auto-saves as you type",
                        color: .orange
                    )
                }

                // Error banner
                if let error = service.errorMessage {
                    statusBanner(
                        icon: "exclamationmark.triangle.fill",
                        text: error,
                        color: .red
                    )
                }

                // Questions
                ForEach(questions) { question in
                    questionField(question)
                }

                // Complete button
                if !isLocked {
                    Button {
                        showCompleteConfirmation = true
                    } label: {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                            Text("Complete Week \(weekNumber)")
                        }
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(
                            requiredFieldsFilled
                                ? Color(hex: "#22c55e")
                                : Color.white.opacity(0.1)
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(!requiredFieldsFilled)
                    .padding(.top, 8)
                }

                Spacer(minLength: 40)
            }
            .padding(16)
        }
    }

    // MARK: - Question Field

    @ViewBuilder
    private func questionField(_ question: QuestionnaireQuestion) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            // Title
            HStack(spacing: 4) {
                if let title = question.title {
                    Text(title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.white)
                }
                if question.isRequired {
                    Text("*")
                        .font(.subheadline.weight(.bold))
                        .foregroundStyle(.red)
                }
            }

            // Description
            if let desc = question.description, !desc.isEmpty {
                Text(desc)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            // Input
            if question.type == "html" {
                // HTML type is display-only (section header)
                EmptyView()
            } else if question.inputType == "number" || question.type == "text" && question.inputType == "number" {
                numberField(for: question)
            } else {
                commentField(for: question)
            }
        }
        .padding(12)
        .background(Color(hex: "#1c1c1e"))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func commentField(for question: QuestionnaireQuestion) -> some View {
        let binding = Binding<String>(
            get: { responses[question.name] ?? "" },
            set: { newValue in
                responses[question.name] = newValue
                scheduleAutoSave()
            }
        )

        return TextEditor(text: binding)
            .scrollContentBackground(.hidden)
            .background(Color.white.opacity(0.05))
            .foregroundColor(isLocked ? .gray : .white)
            .font(.body)
            .frame(minHeight: 80)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .disabled(isLocked)
    }

    private func numberField(for question: QuestionnaireQuestion) -> some View {
        let binding = Binding<String>(
            get: { responses[question.name] ?? "" },
            set: { newValue in
                responses[question.name] = newValue
                scheduleAutoSave()
            }
        )

        return TextField("Enter number", text: binding)
            .keyboardType(.numberPad)
            .textFieldStyle(.plain)
            .padding(10)
            .background(Color.white.opacity(0.05))
            .foregroundColor(isLocked ? .gray : .white)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .disabled(isLocked)
    }

    // MARK: - Status Banner

    private func statusBanner(icon: String, text: String, color: Color) -> some View {
        HStack(spacing: 8) {
            Image(systemName: icon)
                .foregroundStyle(color)
            Text(text)
                .font(.caption)
                .foregroundStyle(.white)
            Spacer()
        }
        .padding(10)
        .background(color.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // MARK: - Error View

    private func errorView(_ message: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(.orange)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button("Try Again") {
                Task {
                    await service.fetchWeekQuestions(cohortId: cohortId, weekNumber: weekNumber)
                    populateExistingResponses()
                }
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(32)
    }

    // MARK: - Auto-Save

    private func scheduleAutoSave() {
        guard !isLocked else { return }
        autoSaveTask?.cancel()
        autoSaveTask = Task {
            try? await Task.sleep(for: .seconds(1))
            guard !Task.isCancelled else { return }
            await service.saveResponse(
                cohortId: cohortId,
                weekNumber: weekNumber,
                responses: responses,
                completed: false
            )
        }
    }

    // MARK: - Complete

    private func completeWeek() async {
        await service.saveResponse(
            cohortId: cohortId,
            weekNumber: weekNumber,
            responses: responses,
            completed: true
        )
    }

    // MARK: - Populate Existing Responses

    private func populateExistingResponses() {
        guard let existing = service.currentWeekData?.existingResponses else { return }
        for (key, value) in existing {
            responses[key] = value.stringValue
        }
    }
}
