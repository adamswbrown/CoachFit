import SwiftUI

struct FoodLogEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var selectedOption: FoodEntryOption?

    enum FoodEntryOption: Identifiable {
        case scan, searchProducts, searchIngredients, searchRestaurants, manual
        var id: Self { self }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    Text("What are you logging?")
                        .font(.title2.weight(.semibold))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal)

                    // Scan Barcode
                    entryCard(
                        icon: "barcode.viewfinder",
                        title: "Scan Barcode",
                        subtitle: "Packaged products with a barcode",
                        color: .blue
                    ) {
                        selectedOption = .scan
                    }

                    // Search Products
                    entryCard(
                        icon: "magnifyingglass",
                        title: "Search Products",
                        subtitle: "Find packaged food by name or brand",
                        color: .orange
                    ) {
                        selectedOption = .searchProducts
                    }

                    // Search Ingredients
                    entryCard(
                        icon: "carrot",
                        title: "Search Ingredients",
                        subtitle: "Raw foods — fruit, veg, meat, grains",
                        color: .green
                    ) {
                        selectedOption = .searchIngredients
                    }

                    // Search Restaurants
                    entryCard(
                        icon: "fork.knife.circle",
                        title: "Search Restaurants",
                        subtitle: "Nandos, McDonald's, Wagamama & more",
                        color: .red
                    ) {
                        selectedOption = .searchRestaurants
                    }

                    // Manual Entry
                    entryCard(
                        icon: "square.and.pencil",
                        title: "Log Manually",
                        subtitle: "Enter nutrition values yourself",
                        color: .purple
                    ) {
                        selectedOption = .manual
                    }
                }
                .padding(.vertical)
            }
            .navigationTitle("Log Food")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .fullScreenCover(item: $selectedOption) { option in
                switch option {
                case .scan:
                    NavigationStack {
                        ScannerView { barcode in
                            // Scanner handles navigation to ProductView internally
                        }
                        .navigationTitle("Scan Barcode")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") { selectedOption = nil }
                            }
                        }
                    }
                case .searchProducts:
                    FoodSearchView(searchType: .products)
                case .searchIngredients:
                    FoodSearchView(searchType: .ingredients)
                case .searchRestaurants:
                    FoodSearchView(searchType: .restaurant)
                case .manual:
                    NavigationStack {
                        ProductView(barcode: "")
                            .navigationTitle("Log Manually")
                            .navigationBarTitleDisplayMode(.inline)
                            .toolbar {
                                ToolbarItem(placement: .cancellationAction) {
                                    Button("Close") { selectedOption = nil }
                                }
                            }
                    }
                }
            }
        }
    }

    private func entryCard(icon: String, title: String, subtitle: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
                    .frame(width: 44, height: 44)
                    .background(color.opacity(0.12))
                    .clipShape(RoundedRectangle(cornerRadius: 10))

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.headline)
                    Text(subtitle)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding()
            .background(.ultraThinMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .buttonStyle(.plain)
        .padding(.horizontal)
    }
}
