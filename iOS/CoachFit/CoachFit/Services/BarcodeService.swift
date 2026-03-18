import Foundation

enum BarcodeService {
    enum LookupError: LocalizedError {
        case notFound
        case networkError(Error)

        var errorDescription: String? {
            switch self {
            case .notFound: "Product not found"
            case .networkError(let e): "Network error: \(e.localizedDescription)"
            }
        }
    }

    static func lookup(barcode: String) async throws -> Product {
        let url = URL(string: "https://world.openfoodfacts.net/api/v2/product/\(barcode)?fields=product_name,brands,image_front_url,serving_quantity,serving_size,nutriments")!

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(from: url)
        } catch {
            throw LookupError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            throw LookupError.notFound
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let status = json["status"] as? Int, status == 1,
              let product = json["product"] as? [String: Any] else {
            throw LookupError.notFound
        }

        let nutriments = product["nutriments"] as? [String: Any] ?? [:]
        let servingQty = product["serving_quantity"] as? Double
        let servingSize = product["serving_size"] as? String

        return Product(
            barcode: barcode,
            name: product["product_name"] as? String ?? "Unknown Product",
            brand: product["brands"] as? String ?? "",
            imageURL: (product["image_front_url"] as? String).flatMap(URL.init),
            servingLabel: servingSize,
            servingGrams: servingQty ?? 100,
            caloriesPer100g: nutriments["energy-kcal_100g"] as? Double ?? 0,
            proteinPer100g: nutriments["proteins_100g"] as? Double ?? 0,
            fatPer100g: nutriments["fat_100g"] as? Double ?? 0,
            carbsPer100g: nutriments["carbohydrates_100g"] as? Double ?? 0,
            sugarsPer100g: nutriments["sugars_100g"] as? Double ?? 0,
            fiberPer100g: nutriments["fiber_100g"] as? Double ?? 0,
            sodiumPer100g: (nutriments["sodium_100g"] as? Double ?? 0) * 1000
        )
    }
}
