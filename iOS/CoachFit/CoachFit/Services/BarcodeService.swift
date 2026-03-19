import Foundation

enum BarcodeService {
    enum LookupError: LocalizedError {
        case notFound
        case networkError(Error)
        case rateLimited

        var errorDescription: String? {
            switch self {
            case .notFound: "Product not found"
            case .networkError(let e): "Network error: \(e.localizedDescription)"
            case .rateLimited: "Too many requests — please try again in a minute"
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

    static func search(query: String) async throws -> [Product] {
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://world.openfoodfacts.org/cgi/search.pl?search_terms=\(encoded)&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,image_front_small_url,serving_quantity,serving_size,nutriments") else {
            return []
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(from: url)
        } catch {
            throw LookupError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            return []
        }

        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let products = json["products"] as? [[String: Any]] else {
            return []
        }

        return products.compactMap { item -> Product? in
            let name = item["product_name"] as? String ?? ""
            guard !name.isEmpty else { return nil }

            let nutriments = item["nutriments"] as? [String: Any] ?? [:]
            let servingQty = item["serving_quantity"] as? Double
            let servingSize = item["serving_size"] as? String

            return Product(
                barcode: "",
                name: name,
                brand: item["brands"] as? String ?? "",
                imageURL: (item["image_front_small_url"] as? String).flatMap(URL.init),
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

    // TODO: Replace DEMO_KEY with proper API key from api.data.gov/signup
    // USDA nutrient IDs (stable, unlike name strings):
    // 1008=Energy(kcal), 1003=Protein, 1004=Fat, 1005=Carbs,
    // 2000=Sugars, 1079=Fiber, 1093=Sodium
    static func searchIngredients(query: String) async throws -> [Product] {
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://api.nal.usda.gov/fdc/v1/foods/search?api_key=3KTEbFSGwV37XZmsaaQiDkpxhwpilRmnHSrttyRY&query=\(encoded)&dataType=Foundation,SR%20Legacy&pageSize=20") else {
            return []
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(from: url)
        } catch {
            throw LookupError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse else {
            return []
        }

        // USDA returns 200 even for rate limit errors — check body
        let json: [String: Any]
        do {
            guard let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                return []
            }
            json = parsed
        } catch {
            return []
        }

        // Check for rate limit error in response body
        if let errorObj = json["error"] as? [String: Any],
           let code = errorObj["code"] as? String, code == "OVER_RATE_LIMIT" {
            throw LookupError.rateLimited
        }

        if http.statusCode == 429 {
            throw LookupError.rateLimited
        }

        guard http.statusCode == 200 else {
            return []
        }

        guard let foods = json["foods"] as? [[String: Any]] else {
            return []
        }

        return foods.compactMap { food -> Product? in
            let name = food["description"] as? String ?? ""
            guard !name.isEmpty else { return nil }

            let nutrients = food["foodNutrients"] as? [[String: Any]] ?? []

            // Match by nutrientId — try multiple IDs for energy since
            // SR Legacy uses 1008 while Foundation uses 2047/2048
            func nutrientById(_ ids: Int...) -> Double {
                for id in ids {
                    if let match = nutrients.first(where: { ($0["nutrientId"] as? Int) == id }),
                       let value = match["value"] as? Double,
                       // Skip kJ entries (1062) — only want kcal
                       (match["unitName"] as? String)?.uppercased() != "KJ" {
                        return value
                    }
                }
                return 0
            }

            let calories = nutrientById(1008, 2047, 2048) // Energy kcal (SR Legacy, Foundation General, Foundation Specific)
            let protein  = nutrientById(1003) // Protein
            let fat      = nutrientById(1004) // Total lipid (fat)
            let carbs    = nutrientById(1005) // Carbohydrate, by difference
            let sugars   = nutrientById(2000) // Sugars, total
            let fiber    = nutrientById(1079) // Fiber, total dietary
            let sodium   = nutrientById(1093) // Sodium, Na

            let category = food["foodCategory"] as? String ?? ""

            return Product(
                barcode: "",
                name: name.localizedCapitalized,
                brand: category,
                imageURL: nil,
                servingLabel: "per 100g",
                servingGrams: 100,
                caloriesPer100g: calories,
                proteinPer100g: protein,
                fatPer100g: fat,
                carbsPer100g: carbs,
                sugarsPer100g: sugars,
                fiberPer100g: fiber,
                sodiumPer100g: sodium
            )
        }
    }
}
