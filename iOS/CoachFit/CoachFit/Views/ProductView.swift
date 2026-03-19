import SwiftUI
import SwiftData

struct ProductView: View {
    let barcode: String

    @Environment(AppState.self) private var appState
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss

    @State private var state: ViewState = .loading
    @State private var servingGrams: Double = 100
    @State private var product: Product?
    @State private var initialProduct: Product?

    init(barcode: String) {
        self.barcode = barcode
    }

    init(product: Product) {
        self.barcode = product.barcode
        _initialProduct = State(initialValue: product)
    }

    // Manual entry fields
    @State private var restaurantName = ""
    @State private var manualName = ""
    @State private var manualBrand = ""
    @State private var manualServing = "100"
    @State private var manualCalories = ""
    @State private var manualProtein = ""
    @State private var manualFat = ""
    @State private var manualCarbs = ""

    private enum ViewState {
        case loading
        case found
        case notFound
        case logged
    }

    var body: some View {
        Group {
            switch state {
            case .loading:
                loadingView
            case .found:
                if let product {
                    foundView(product)
                }
            case .notFound:
                manualEntryView
            case .logged:
                loggedView
            }
        }
        .navigationTitle(state == .notFound ? "Add Product" : "Product")
        .navigationBarTitleDisplayMode(.inline)
        .task { await lookupProduct() }
    }

    // MARK: - Loading

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)
            Text("Looking up product...")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Found

    private func foundView(_ product: Product) -> some View {
        List {
            productCardSection(product)
            servingCalculatorSection(product)
            logButtonSection
        }
    }

    private func productCardSection(_ product: Product) -> some View {
        Section {
            HStack(spacing: 14) {
                if let imageURL = product.imageURL {
                    AsyncImage(url: imageURL) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fit)
                        case .failure:
                            EmptyView()
                        default:
                            ProgressView()
                        }
                    }
                    .frame(width: 80, height: 80)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                }

                VStack(alignment: .leading, spacing: 4) {
                    Text(product.name)
                        .font(.headline)
                    if !product.brand.isEmpty {
                        Text(product.brand)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    if let label = product.servingLabel {
                        Text("Serving: \(label)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }
            }
            .padding(.vertical, 4)
        }
    }

    private func servingCalculatorSection(_ product: Product) -> some View {
        let scaled = product.scaled(grams: servingGrams)

        return Section {
            VStack(spacing: 12) {
                HStack {
                    Text("Serving size")
                        .font(.subheadline)
                    Spacer()
                    Text("\(Int(servingGrams)) g")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                }

                Slider(value: $servingGrams, in: 1...500, step: 1)
                    .tint(.accentColor)
            }

            NutrientRow(label: "Calories", value: scaled.calories, unit: "kcal", icon: "flame.fill", color: .orange)
            NutrientRow(label: "Protein", value: scaled.protein, unit: "g", icon: "p.circle.fill", color: .blue)
            NutrientRow(label: "Fat", value: scaled.fat, unit: "g", icon: "f.circle.fill", color: .yellow)
            NutrientRow(label: "Carbs", value: scaled.carbs, unit: "g", icon: "c.circle.fill", color: .green)
        } header: {
            Text("Nutrition")
        }
    }

    private var logButtonSection: some View {
        Section {
            Button {
                Task { await logFood() }
            } label: {
                HStack {
                    Spacer()
                    Label("Log Food", systemImage: "plus.circle.fill")
                        .bold()
                    Spacer()
                }
            }
        }
    }

    // MARK: - Not Found (Manual Entry)

    private var manualEntryView: some View {
        Form {
            Section {
                HStack(spacing: 12) {
                    Image(systemName: "barcode.viewfinder")
                        .font(.title2)
                        .foregroundStyle(.secondary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Product not found")
                            .font(.headline)
                        Text("Barcode: \(barcode)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            }

            Section("Product Info") {
                TextField("Restaurant name (optional)", text: $restaurantName)
                TextField("Product name", text: $manualName)
                TextField("Brand (optional)", text: $manualBrand)
                HStack {
                    Text("Serving size (g)")
                    Spacer()
                    TextField("100", text: $manualServing)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                }
            }

            Section("Nutrition per 100 g") {
                ManualField(label: "Calories", text: $manualCalories, icon: "flame.fill")
                ManualField(label: "Protein (g)", text: $manualProtein, icon: "p.circle.fill")
                ManualField(label: "Fat (g)", text: $manualFat, icon: "f.circle.fill")
                ManualField(label: "Carbs (g)", text: $manualCarbs, icon: "c.circle.fill")
            }

            Section {
                Button {
                    Task { await logManualEntry() }
                } label: {
                    HStack {
                        Spacer()
                        Label("Log Food", systemImage: "plus.circle.fill")
                            .bold()
                        Spacer()
                    }
                }
                .disabled(manualName.isEmpty || manualCalories.isEmpty)
            }
        }
    }

    // MARK: - Logged

    private var loggedView: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)

            Text("Food Logged!")
                .font(.title2.bold())

            if let product {
                Text("\(product.name) - \(Int(servingGrams)) g")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                let scaled = product.scaled(grams: servingGrams)
                Text("\(Int(scaled.calories)) kcal")
                    .font(.headline)
                    .foregroundStyle(.orange)
            }

            Spacer()

            Button {
                dismiss()
            } label: {
                Label("Scan Another", systemImage: "barcode.viewfinder")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .padding(.horizontal)
            .padding(.bottom)
        }
    }

    // MARK: - Actions

    private func lookupProduct() async {
        if let initialProduct {
            product = initialProduct
            servingGrams = initialProduct.servingGrams
            state = .found
            return
        }

        do {
            let found = try await BarcodeService.lookup(barcode: barcode)
            product = found
            servingGrams = found.servingGrams
            state = .found
        } catch is BarcodeService.LookupError {
            state = .notFound
        } catch {
            state = .notFound
        }
    }

    private func logFood() async {
        guard let product else { return }

        let scaled = product.scaled(grams: servingGrams)
        let today = todayDateString()

        let entry = FoodLogEntry(
            date: today,
            barcode: product.barcode,
            name: product.name,
            brand: product.brand.isEmpty ? nil : product.brand,
            servingGrams: servingGrams,
            calories: scaled.calories,
            protein: scaled.protein,
            fat: scaled.fat,
            carbs: scaled.carbs,
            sugar: product.sugarsPer100g * servingGrams / 100,
            fiber: product.fiberPer100g * servingGrams / 100,
            sodium: product.sodiumPer100g * servingGrams / 100
        )

        modelContext.insert(entry)

        // Fire and forget HealthKit write
        Task {
            try? await appState.healthKit.saveNutrition(
                calories: scaled.calories,
                protein: scaled.protein,
                fat: scaled.fat,
                carbs: scaled.carbs
            )
        }

        state = .logged
    }

    private func logManualEntry() async {
        let serving = Double(manualServing) ?? 100
        let manualProduct = Product(
            barcode: barcode,
            name: manualName,
            brand: manualBrand,
            imageURL: nil,
            servingLabel: "\(Int(serving)) g",
            servingGrams: serving,
            caloriesPer100g: Double(manualCalories) ?? 0,
            proteinPer100g: Double(manualProtein) ?? 0,
            fatPer100g: Double(manualFat) ?? 0,
            carbsPer100g: Double(manualCarbs) ?? 0,
            sugarsPer100g: 0,
            fiberPer100g: 0,
            sodiumPer100g: 0
        )

        product = manualProduct
        servingGrams = serving

        let scaled = manualProduct.scaled(grams: serving)
        let today = todayDateString()

        let entry = FoodLogEntry(
            date: today,
            barcode: barcode,
            name: manualName,
            brand: manualBrand.isEmpty ? nil : manualBrand,
            servingGrams: serving,
            calories: scaled.calories,
            protein: scaled.protein,
            fat: scaled.fat,
            carbs: scaled.carbs
        )

        modelContext.insert(entry)

        Task {
            try? await appState.healthKit.saveNutrition(
                calories: scaled.calories,
                protein: scaled.protein,
                fat: scaled.fat,
                carbs: scaled.carbs
            )
        }

        // Submit meal suggestion to the database if restaurant name is provided
        if !restaurantName.isEmpty, let clientId = appState.clientId {
            Task {
                try? await appState.apiClient.submitMealSuggestion(
                    APIClient.MealSuggestion(
                        client_id: clientId,
                        restaurant: restaurantName,
                        item: manualName,
                        calories_kcal: scaled.calories,
                        protein_g: scaled.protein,
                        carbs_g: scaled.carbs,
                        fat_g: scaled.fat,
                        fibre_g: nil,
                        salt_g: nil,
                        category: nil
                    )
                )
            }
        }

        state = .logged
    }

    private func todayDateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: .now)
    }
}

// MARK: - Supporting Views

private struct NutrientRow: View {
    let label: String
    let value: Double
    let unit: String
    let icon: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 24)
            Text(label)
                .font(.subheadline)
            Spacer()
            Text(String(format: "%.1f %@", value, unit))
                .font(.subheadline)
                .fontWeight(.medium)
                .monospacedDigit()
        }
    }
}

private struct ManualField: View {
    let label: String
    @Binding var text: String
    let icon: String

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(.secondary)
                .frame(width: 24)
            Text(label)
            Spacer()
            TextField("0", text: $text)
                .keyboardType(.decimalPad)
                .multilineTextAlignment(.trailing)
                .frame(width: 80)
        }
    }
}

#Preview {
    NavigationStack {
        ProductView(barcode: "3017620422003")
            .environment(AppState())
    }
    .modelContainer(for: FoodLogEntry.self, inMemory: true)
}
