import SwiftUI
import UniformTypeIdentifiers

struct ImportTab: View {
    @Environment(AppState.self) private var appState

    @State private var showFilePicker = false
    @State private var parseResult: CronometerParseResult?
    @State private var isUploading = false
    @State private var uploadResult: UploadResult?
    @State private var errorMessage: String?

    enum UploadResult {
        case success(created: Int, merged: Int, skipped: Int)
    }

    var body: some View {
        NavigationStack {
            Group {
                if let result = parseResult {
                    previewView(result)
                } else if let uploadResult {
                    resultView(uploadResult)
                } else {
                    emptyState
                }
            }
            .navigationTitle("Import")
            .fileImporter(
                isPresented: $showFilePicker,
                allowedContentTypes: [.commaSeparatedText, .plainText],
                allowsMultipleSelection: false
            ) { result in
                handleFileSelection(result)
            }
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        ScrollView {
            VStack(spacing: 24) {
                Image(systemName: "doc.text")
                    .font(.system(size: 48))
                    .foregroundStyle(.blue)
                    .padding(.top, 32)

                Text("Import from Cronometer")
                    .font(.title2.bold())

                // Step-by-step instructions
                VStack(alignment: .leading, spacing: 16) {
                    Text("How to export your data")
                        .font(.headline)

                    ExportStep(number: 1, text: "Open Cronometer and go to the **Profile** tab (person icon)")
                    ExportStep(number: 2, text: "Tap the **gear icon** (⚙️) next to Account Settings")
                    ExportStep(number: 3, text: "Select **Export Data**")
                    ExportStep(number: 4, text: "Set your date range (we recommend the last 30 days)")
                    ExportStep(number: 5, text: "Tap **Export Servings** to download the CSV file")
                    ExportStep(number: 6, text: "When prompted, choose to open with **CoachFit** — or save the file and select it below")
                }
                .padding()
                .background(Color(.secondarySystemBackground))
                .cornerRadius(12)
                .padding(.horizontal, 20)

                VStack(spacing: 4) {
                    Text("Supported columns")
                        .font(.caption.bold())
                        .foregroundStyle(.secondary)
                    Text("Date, Energy (kcal), Protein (g), Carbs (g), Fat (g), Fiber (g)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 20)

                Button {
                    showFilePicker = true
                } label: {
                    Label("Select CSV File", systemImage: "doc.badge.plus")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .padding(.horizontal, 40)
                .padding(.bottom, 32)
            }
        }
    }

    // MARK: - Preview

    private func previewView(_ result: CronometerParseResult) -> some View {
        List {
            Section {
                LabeledContent("Rows found", value: "\(result.rows.count)")
                LabeledContent("Total rows in file", value: "\(result.totalRowsInFile)")
            }

            if !result.warnings.isEmpty {
                Section("Warnings") {
                    ForEach(result.warnings, id: \.self) { warning in
                        Text(warning)
                            .font(.caption)
                            .foregroundStyle(.orange)
                    }
                }
            }

            Section("Preview") {
                ForEach(result.rows.prefix(10)) { row in
                    VStack(alignment: .leading, spacing: 4) {
                        Text(row.date)
                            .font(.headline)
                        HStack(spacing: 12) {
                            if let cal = row.calories {
                                Label("\(cal) kcal", systemImage: "flame")
                            }
                            if let p = row.proteinGrams {
                                Text("P: \(String(format: "%.0f", p))g")
                            }
                            if let c = row.carbsGrams {
                                Text("C: \(String(format: "%.0f", c))g")
                            }
                            if let f = row.fatGrams {
                                Text("F: \(String(format: "%.0f", f))g")
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                }

                if result.rows.count > 10 {
                    Text("... and \(result.rows.count - 10) more rows")
                        .foregroundStyle(.secondary)
                        .font(.caption)
                }
            }

            Section {
                Button {
                    Task { await uploadRows(result.rows) }
                } label: {
                    if isUploading {
                        HStack {
                            Spacer()
                            ProgressView()
                            Text("Uploading...")
                            Spacer()
                        }
                    } else {
                        HStack {
                            Spacer()
                            Text("Import \(result.rows.count) Rows")
                                .bold()
                            Spacer()
                        }
                    }
                }
                .disabled(isUploading || result.rows.isEmpty)

                Button("Cancel", role: .cancel) {
                    parseResult = nil
                    errorMessage = nil
                }
            }

            if let errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.caption)
                }
            }
        }
    }

    // MARK: - Result

    private func resultView(_ result: UploadResult) -> some View {
        VStack(spacing: 24) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 56))
                .foregroundStyle(.green)

            switch result {
            case .success(let created, let merged, let skipped):
                VStack(spacing: 8) {
                    Text("Import Complete")
                        .font(.headline)

                    VStack(spacing: 4) {
                        if created > 0 { Text("\(created) new entries created") }
                        if merged > 0 { Text("\(merged) entries merged") }
                        if skipped > 0 { Text("\(skipped) entries skipped (already populated)") }
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }
            }

            Button("Import Another File") {
                uploadResult = nil
                parseResult = nil
                errorMessage = nil
            }
            .buttonStyle(.borderedProminent)

            Spacer()
            Spacer()
        }
    }

    // MARK: - Actions

    private func handleFileSelection(_ result: Result<[URL], Error>) {
        switch result {
        case .success(let urls):
            guard let url = urls.first else { return }
            guard url.startAccessingSecurityScopedResource() else {
                errorMessage = "Could not access file"
                return
            }
            defer { url.stopAccessingSecurityScopedResource() }

            do {
                let csvText = try String(contentsOf: url, encoding: .utf8)
                let parsed = CronometerCSVParser.parse(csvText)

                if parsed.rows.isEmpty {
                    errorMessage = "No data rows found in CSV. \(parsed.warnings.joined(separator: " "))"
                } else {
                    parseResult = parsed
                    errorMessage = nil
                }
            } catch {
                errorMessage = "Could not read file: \(error.localizedDescription)"
            }

        case .failure(let error):
            errorMessage = error.localizedDescription
        }
    }

    private func uploadRows(_ rows: [CronometerRow]) async {
        guard let clientId = appState.clientId else { return }
        isUploading = true
        errorMessage = nil
        defer { isUploading = false }

        // Build the API payload matching cronometerImportSchema + client_id
        struct CronometerPayload: Encodable {
            let client_id: String
            let rows: [Row]

            struct Row: Encodable {
                let date: String
                let calories: Int?
                let proteinGrams: Double?
                let carbsGrams: Double?
                let fatGrams: Double?
                let fiberGrams: Double?
            }
        }

        let payload = CronometerPayload(
            client_id: clientId,
            rows: rows.map {
                CronometerPayload.Row(
                    date: $0.date,
                    calories: $0.calories,
                    proteinGrams: $0.proteinGrams,
                    carbsGrams: $0.carbsGrams,
                    fatGrams: $0.fatGrams,
                    fiberGrams: $0.fiberGrams
                )
            }
        )

        do {
            let (data, response) = try await appState.apiClient.authenticatedRequest(
                path: "api/ingest/cronometer",
                method: "POST",
                body: payload
            )

            guard (200...299).contains(response.statusCode) || response.statusCode == 207 else {
                let errorBody = try? JSONDecoder().decode(ErrorBody.self, from: data)
                errorMessage = errorBody?.error ?? "Upload failed (HTTP \(response.statusCode))"
                return
            }

            // Parse response to get counts
            struct UploadResponse: Decodable {
                let created: Int?
                let merged: Int?
                let skipped: Int?
            }

            let decoded = try? JSONDecoder().decode(UploadResponse.self, from: data)
            parseResult = nil
            uploadResult = .success(
                created: decoded?.created ?? 0,
                merged: decoded?.merged ?? 0,
                skipped: decoded?.skipped ?? 0
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct ErrorBody: Decodable {
    let error: String
}

private struct ExportStep: View {
    let number: Int
    let text: LocalizedStringKey

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption.bold())
                .foregroundStyle(.white)
                .frame(width: 22, height: 22)
                .background(Color.blue)
                .clipShape(Circle())

            Text(text)
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

#Preview {
    ImportTab()
        .environment(AppState())
}
