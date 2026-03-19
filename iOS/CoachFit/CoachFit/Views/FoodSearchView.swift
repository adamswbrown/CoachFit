import SwiftUI

enum FoodSearchType {
    case products     // OpenFoodFacts — packaged food
    case ingredients  // USDA — raw/generic food

    var title: String {
        switch self {
        case .products: "Search Products"
        case .ingredients: "Search Ingredients"
        }
    }

    var placeholder: String {
        switch self {
        case .products: "Search packaged foods (e.g. Heinz beans)"
        case .ingredients: "Search ingredients (e.g. mushrooms, chicken)"
        }
    }

    var emptyMessage: String {
        switch self {
        case .products: "Search for packaged food by name or brand"
        case .ingredients: "Search for raw foods and ingredients"
        }
    }

    var emptyIcon: String {
        switch self {
        case .products: "cart"
        case .ingredients: "carrot"
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
    @Environment(\.dismiss) private var dismiss

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
                .padding()

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
                } else {
                    List(results.indices, id: \.self) { index in
                        let product = results[index]
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

    private func performSearch(_ query: String) async {
        isSearching = true
        errorMessage = nil
        do {
            switch searchType {
            case .products:
                results = try await BarcodeService.search(query: query)
            case .ingredients:
                results = try await BarcodeService.searchIngredients(query: query)
            }
        } catch {
            results = []
            errorMessage = error.localizedDescription
        }
        isSearching = false
        hasSearched = true
    }
}
