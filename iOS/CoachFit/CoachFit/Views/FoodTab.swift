import SwiftUI
import SwiftData

struct FoodTab: View {
    @Query(sort: \FoodLogEntry.loggedAt, order: .reverse) private var allEntries: [FoodLogEntry]
    @Environment(\.modelContext) private var modelContext

    @State private var viewMode: ViewMode = .today
    @State private var showAddFood = false

    enum ViewMode: String, CaseIterable {
        case today = "Today"
        case week = "This Week"
    }

    // MARK: - Computed

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

    private var todayCalories: Int {
        Int(todayEntries.reduce(0) { $0 + $1.calories })
    }

    private var todayProtein: Int {
        Int(todayEntries.reduce(0) { $0 + $1.protein })
    }

    private var todayFat: Int {
        Int(todayEntries.reduce(0) { $0 + $1.fat })
    }

    private var todayCarbs: Int {
        Int(todayEntries.reduce(0) { $0 + $1.carbs })
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Segmented control
                Picker("View", selection: $viewMode) {
                    ForEach(ViewMode.allCases, id: \.self) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)

                if viewMode == .today {
                    todayView
                } else {
                    weekView
                }
            }
            .navigationTitle("Food")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showAddFood = true
                    } label: {
                        Image(systemName: "plus.circle.fill")
                            .font(.title3)
                    }
                }
            }
            .fullScreenCover(isPresented: $showAddFood) {
                FoodLogEntryView()
            }
        }
    }

    // MARK: - Today View

    @ViewBuilder
    private var todayView: some View {
        if todayEntries.isEmpty {
            emptyState
        } else {
            List {
                // Summary card
                Section {
                    VStack(spacing: 12) {
                        Text("\(todayCalories)")
                            .font(.system(size: 40, weight: .bold, design: .rounded))
                        Text("calories today")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        HStack(spacing: 0) {
                            macroItem(label: "Protein", grams: todayProtein, color: .blue)
                            macroItem(label: "Fat", grams: todayFat, color: .yellow)
                            macroItem(label: "Carbs", grams: todayCarbs, color: .green)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }

                // Entries
                Section("Logged") {
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

    private func macroItem(label: String, grams: Int, color: Color) -> some View {
        VStack(spacing: 4) {
            HStack(spacing: 4) {
                Circle()
                    .fill(color)
                    .frame(width: 8, height: 8)
                Text("\(grams)g")
                    .font(.headline.monospacedDigit())
            }
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
        let totalCals = Int(entries.reduce(0) { $0 + $1.calories })
        return HStack {
            Text(formattedSectionDate(date))
                .font(.headline)
            Spacer()
            Text("\(totalCals) cal")
                .font(.subheadline.bold())
            Text("(\(entries.count))")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Spacer()
            Image(systemName: "fork.knife.circle")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)
            Text("No food logged yet")
                .font(.title3.bold())
            Text("Tap + to scan a barcode or search for food")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)

            Button {
                showAddFood = true
            } label: {
                Label("Add Food", systemImage: "plus.circle.fill")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 40)

            Spacer()
        }
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
