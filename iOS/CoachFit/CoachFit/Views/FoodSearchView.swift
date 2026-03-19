import SwiftUI

enum FoodSearchType: Equatable {
    case products     // OpenFoodFacts — packaged food
    case ingredients  // USDA — raw/generic food
    case restaurant   // FatSecret — restaurant & chain food

    var title: String {
        switch self {
        case .products: "Search Products"
        case .ingredients: "Search Ingredients"
        case .restaurant: "Search Restaurants"
        }
    }

    var placeholder: String {
        switch self {
        case .products: "Search packaged foods (e.g. Heinz beans)"
        case .ingredients: "Search ingredients (e.g. mushrooms, chicken)"
        case .restaurant: "Search restaurant food (e.g. Nandos half chicken)"
        }
    }

    var emptyMessage: String {
        switch self {
        case .products: "Search for packaged food by name or brand"
        case .ingredients: "Search for raw foods and ingredients"
        case .restaurant: "Search for meals from restaurants and chains"
        }
    }

    var emptyIcon: String {
        switch self {
        case .products: "cart"
        case .ingredients: "carrot"
        case .restaurant: "fork.knife.circle"
        }
    }
}

struct FoodSearchView: View {
    var searchType: FoodSearchType = .products
    @State private var query = ""
    @State private var results: [Product] = []
    @State private var isSearching = false
    @State private var hasSearched = false
    @State private var searchTask: Task<Void, Never>?
    @State private var errorMessage: String?
    @State private var selectedRestaurant: String?
    @State private var maxCalories: Double = 2000
    @State private var showFilters = false
    @State private var filterActive = false
    @State private var sortByProtein = false
    @Environment(\.dismiss) private var dismiss

    private var filteredResults: [Product] {
        var filtered = results
        if filterActive && searchType == .restaurant {
            filtered = filtered.filter { $0.caloriesPer100g <= maxCalories }
        }
        if sortByProtein && searchType == .restaurant {
            filtered = filtered.sorted { $0.proteinPer100g > $1.proteinPer100g }
        }
        return filtered
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Search bar
                HStack {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField(searchType.placeholder, text: $query)
                        .textFieldStyle(.plain)
                        .autocorrectionDisabled()
                    if !query.isEmpty {
                        Button { query = ""; results = []; hasSearched = false } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                .padding(12)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 10))
                .padding(.horizontal)
                .padding(.top)

                // Filters (restaurant only, when results exist)
                if searchType == .restaurant && !results.isEmpty {
                    VStack(spacing: 10) {
                        // Sort picker
                        HStack {
                            Text("Sort by")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                            Picker("Sort", selection: $sortByProtein) {
                                Text("Default").tag(false)
                                Text("Highest Protein").tag(true)
                            }
                            .pickerStyle(.segmented)
                        }
                        .padding(.horizontal)

                        // Calorie limit
                        VStack(spacing: 4) {
                            HStack {
                                Toggle(isOn: $filterActive) {
                                    HStack(spacing: 6) {
                                        Image(systemName: "flame")
                                            .foregroundStyle(filterActive ? .orange : .secondary)
                                        Text("Limit calories")
                                            .font(.subheadline)
                                    }
                                }
                                .toggleStyle(.switch)
                                .tint(.orange)
                            }

                            if filterActive {
                                HStack {
                                    Text("Under")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Slider(value: $maxCalories, in: 100...2000, step: 50)
                                        .tint(.orange)
                                    Text("\(Int(maxCalories)) kcal")
                                        .font(.subheadline.weight(.semibold))
                                        .foregroundStyle(.orange)
                                        .frame(width: 70, alignment: .trailing)
                                }
                            }
                        }
                        .padding(.horizontal)

                        // Result count
                        if filterActive || sortByProtein {
                            HStack {
                                Text("Showing \(filteredResults.count) of \(results.count) items")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                Spacer()
                                if filterActive || sortByProtein {
                                    Button("Clear filters") {
                                        filterActive = false
                                        sortByProtein = false
                                        maxCalories = 2000
                                    }
                                    .font(.caption)
                                }
                            }
                            .padding(.horizontal)
                        }
                    }
                    .padding(.vertical, 8)
                    .background(Color(.systemGray6))
                }

                // Content
                if isSearching {
                    Spacer()
                    ProgressView("Searching...")
                    Spacer()
                } else if results.isEmpty && hasSearched {
                    Spacer()
                    VStack(spacing: 12) {
                        Image(systemName: errorMessage != nil ? "exclamationmark.triangle" : "magnifyingglass")
                            .font(.largeTitle)
                            .foregroundStyle(errorMessage != nil ? .orange : .secondary)
                        if let errorMessage {
                            Text(errorMessage)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                                .multilineTextAlignment(.center)
                        } else {
                            Text("No results for \"\(query)\"")
                                .font(.headline)
                        }
                        NavigationLink("Log Manually") {
                            ProductView(barcode: "")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    Spacer()
                } else if results.isEmpty && searchType == .restaurant {
                    restaurantPicker
                } else if results.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: searchType.emptyIcon)
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text(searchType.emptyMessage)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                } else if filteredResults.isEmpty && !results.isEmpty {
                    // Filters removed all results
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "line.3.horizontal.decrease.circle")
                            .font(.largeTitle)
                            .foregroundStyle(.secondary)
                        Text("No meals match your filters")
                            .font(.headline)
                        Text("Try increasing the calorie limit")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                } else {
                    List(filteredResults.indices, id: \.self) { index in
                        let product = filteredResults[index]
                        NavigationLink {
                            ProductView(product: product)
                        } label: {
                            HStack {
                                if let url = product.imageURL {
                                    AsyncImage(url: url) { image in
                                        image.resizable().scaledToFill()
                                    } placeholder: {
                                        Color.secondary.opacity(0.2)
                                    }
                                    .frame(width: 40, height: 40)
                                    .clipShape(RoundedRectangle(cornerRadius: 6))
                                }

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(product.name)
                                        .font(.subheadline.weight(.medium))
                                        .lineLimit(2)
                                    if !product.brand.isEmpty {
                                        Text(product.brand)
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                Spacer()

                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("\(Int(product.caloriesPer100g)) kcal")
                                        .font(.subheadline.weight(.semibold))
                                    Text("P \(Int(product.proteinPer100g))g  F \(Int(product.fatPer100g))g  C \(Int(product.carbsPer100g))g")
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                    Text("per 100g")
                                        .font(.caption2)
                                        .foregroundStyle(.tertiary)
                                }
                            }
                        }
                    }
                    .listStyle(.plain)
                }
            }
            .navigationTitle(searchType.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .onChange(of: query) { _, newValue in
                searchTask?.cancel()
                guard !newValue.trimmingCharacters(in: .whitespaces).isEmpty else {
                    results = []
                    hasSearched = false
                    return
                }
                searchTask = Task {
                    try? await Task.sleep(for: .milliseconds(500))
                    guard !Task.isCancelled else { return }
                    await performSearch(newValue)
                }
            }
        }
    }

    private func loadRestaurantMenu(_ restaurantName: String) async {
        isSearching = true
        errorMessage = nil
        do {
            results = try await BarcodeService.searchByRestaurant(name: restaurantName)
        } catch {
            results = []
            errorMessage = error.localizedDescription
        }
        isSearching = false
        hasSearched = true
    }

    private func performSearch(_ query: String) async {
        isSearching = true
        errorMessage = nil
        do {
            switch searchType {
            case .products:
                results = try await BarcodeService.search(query: query)
            case .ingredients:
                results = try await BarcodeService.searchIngredients(query: query)
            case .restaurant:
                results = try await BarcodeService.searchRestaurant(query: query)
            }
        } catch {
            results = []
            errorMessage = error.localizedDescription
        }
        isSearching = false
        hasSearched = true
    }

    // MARK: - Restaurant Quick Pick

    // Exact restaurant names matching the ukfoodfacts database
    private static let popularChains: [(emoji: String, name: String, dbName: String)] = [
        ("🍗", "Nando's", "Nandos"),
        ("🍔", "McDonald's", "McDonalds"),
        ("🍗", "KFC", "KFC"),
        ("🥖", "Greggs", "Greggs"),
        ("🥪", "Subway", "Subway"),
        ("🥐", "Pret", "Pret A Manger"),
        ("🍜", "Wagamama", "Wagamama"),
        ("🍕", "Pizza Hut", "Pizza Hut"),
        ("🍕", "Domino's", "Dominos"),
        ("🍔", "Burger King", "Burger King"),
        ("☕", "Costa", "Costa Coffee"),
        ("☕", "Starbucks", "Starbucks"),
        ("🍕", "Pizza Express", "Pizza Express"),
        ("🍔", "Five Guys", "Five Guys"),
        ("🥗", "Leon", "Leon"),
        ("🌯", "Tortilla", "Tortilla"),
        ("🌮", "Taco Bell", "Taco Bell"),
        ("🍕", "Zizzi", "Zizzi"),
        ("🍺", "Wetherspoons", "Wetherspoons"),
    ]

    private var restaurantPicker: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Popular Chains")
                    .font(.headline)
                    .padding(.horizontal)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 100), spacing: 10)], spacing: 10) {
                    ForEach(Self.popularChains, id: \.dbName) { chain in
                        Button {
                            selectedRestaurant = chain.dbName
                            query = chain.name
                            Task { await loadRestaurantMenu(chain.dbName) }
                        } label: {
                            VStack(spacing: 4) {
                                Text(chain.emoji)
                                    .font(.title2)
                                Text(chain.name)
                                    .font(.caption.weight(.medium))
                                    .lineLimit(1)
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(.ultraThinMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal)

                Text("Or type any restaurant name above")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
                    .frame(maxWidth: .infinity)
            }
            .padding(.vertical)
        }
    }
}
