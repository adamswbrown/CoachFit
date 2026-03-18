import SwiftUI
import SwiftData

struct FoodLogView: View {
    @Query(sort: \FoodLogEntry.loggedAt, order: .reverse) private var allEntries: [FoodLogEntry]
    @Environment(\.modelContext) private var modelContext
    @State private var viewMode: ViewMode = .today

    enum ViewMode: String, CaseIterable {
        case today = "Today"
        case week = "This Week"
    }

    // MARK: - Computed Helpers

    private var todayString: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    private var todayEntries: [FoodLogEntry] {
        allEntries.filter { $0.date == todayString }
    }

    private var weekEntries: [FoodLogEntry] {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        guard let sevenDaysAgo = Calendar.current.date(byAdding: .day, value: -6, to: Calendar.current.startOfDay(for: Date())) else {
            return []
        }
        let cutoff = f.string(from: sevenDaysAgo)
        return allEntries.filter { $0.date >= cutoff }
    }

    private var weekSections: [(date: String, entries: [FoodLogEntry])] {
        let grouped = Dictionary(grouping: weekEntries) { $0.date }
        return grouped.keys.sorted(by: >).map { date in
            (date: date, entries: grouped[date]!.sorted { $0.loggedAt > $1.loggedAt })
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                Picker("View", selection: $viewMode) {
                    ForEach(ViewMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                if viewMode == .today {
                    todayView
                } else {
                    weekView
                }
            }
            .navigationTitle("Food Log")
        }
    }

    // MARK: - Today View

    @ViewBuilder
    private var todayView: some View {
        if todayEntries.isEmpty {
            emptyState
        } else {
            List {
                Section {
                    caloriesBanner(for: todayEntries)
                    macroSummaryRow(for: todayEntries)
                }

                Section("Entries") {
                    ForEach(todayEntries, id: \.loggedAt) { entry in
                        entryRow(entry)
                    }
                    .onDelete { offsets in
                        deleteEntries(from: todayEntries, at: offsets)
                    }
                }
            }
        }
    }

    // MARK: - Week View

    @ViewBuilder
    private var weekView: some View {
        if weekEntries.isEmpty {
            emptyState
        } else {
            List {
                ForEach(weekSections, id: \.date) { section in
                    Section {
                        ForEach(section.entries, id: \.loggedAt) { entry in
                            entryRow(entry)
                        }
                        .onDelete { offsets in
                            deleteEntries(from: section.entries, at: offsets)
                        }
                    } header: {
                        sectionHeader(date: section.date, entries: section.entries)
                    }
                }
            }
        }
    }

    // MARK: - Subviews

    private func caloriesBanner(for entries: [FoodLogEntry]) -> some View {
        let total = entries.reduce(0) { $0 + $1.calories }
        return HStack {
            Spacer()
            VStack(spacing: 4) {
                Text("\(Int(total))")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                Text("calories today")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(.vertical, 8)
    }

    private func macroSummaryRow(for entries: [FoodLogEntry]) -> some View {
        let protein = entries.reduce(0) { $0 + $1.protein }
        let fat = entries.reduce(0) { $0 + $1.fat }
        let carbs = entries.reduce(0) { $0 + $1.carbs }
        return HStack {
            macroItem(label: "Protein", grams: protein)
            Spacer()
            macroItem(label: "Fat", grams: fat)
            Spacer()
            macroItem(label: "Carbs", grams: carbs)
        }
        .padding(.vertical, 4)
    }

    private func macroItem(label: String, grams: Double) -> some View {
        VStack(spacing: 2) {
            Text("\(Int(grams))g")
                .font(.headline)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func entryRow(_ entry: FoodLogEntry) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(entry.name)
                    .font(.body.bold())
                if let brand = entry.brand, !brand.isEmpty {
                    Text(brand)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Text("\(Int(entry.servingGrams))g serving")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(Int(entry.calories)) cal")
                    .font(.subheadline.bold())
                Text(formattedTime(entry.loggedAt))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 2)
    }

    private func sectionHeader(date: String, entries: [FoodLogEntry]) -> some View {
        let totalCals = entries.reduce(0) { $0 + $1.calories }
        let count = entries.count
        return HStack {
            Text(formattedSectionDate(date))
                .font(.headline)
            Spacer()
            Text("\(Int(totalCals)) cal")
                .font(.subheadline.bold())
            Text("(\(count))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "fork.knife.circle")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("No food logged yet")
                .font(.title3.bold())
            Text("Scan a barcode to get started")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Formatting

    private func formattedTime(_ date: Date) -> String {
        let f = DateFormatter()
        f.dateFormat = "h:mm a"
        return f.string(from: date)
    }

    private func formattedSectionDate(_ dateString: String) -> String {
        let parser = DateFormatter()
        parser.dateFormat = "yyyy-MM-dd"
        guard let date = parser.date(from: dateString) else { return dateString }
        let display = DateFormatter()
        display.dateFormat = "EEE, MMM d"
        return display.string(from: date)
    }

    // MARK: - Actions

    private func deleteEntries(from entries: [FoodLogEntry], at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(entries[index])
        }
    }
}

#Preview {
    FoodLogView()
        .modelContainer(for: FoodLogEntry.self, inMemory: true)
}
