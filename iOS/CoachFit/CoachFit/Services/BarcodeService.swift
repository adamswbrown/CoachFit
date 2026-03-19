import Foundation
import CommonCrypto

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

    // MARK: - UK Food Facts (Primary Restaurant Search)

    private static func searchUKFoodFacts(query: String) async throws -> [Product] {
        guard let encoded = query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://uk-calories.vercel.app/api/data?q=\(encoded)") else {
            return []
        }

        let request = URLRequest(url: url)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw LookupError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            return []
        }

        guard let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return parseUKFoodFactsItems(items)
    }

    private static func parseUKFoodFactsItems(_ items: [[String: Any]]) -> [Product] {
        items.compactMap { item -> Product? in
            let name = item["item"] as? String ?? ""
            guard !name.isEmpty else { return nil }

            func num(_ key: String) -> Double {
                item[key] as? Double ?? (item[key] as? Int).map(Double.init) ?? 0
            }

            return Product(
                barcode: "",
                name: name,
                brand: item["restaurant"] as? String ?? "",
                imageURL: nil,
                servingLabel: "per serving",
                servingGrams: 100,
                caloriesPer100g: num("calories_kcal"),
                proteinPer100g: num("protein_g"),
                fatPer100g: num("fat_g"),
                carbsPer100g: num("carbs_g"),
                sugarsPer100g: 0,
                fiberPer100g: num("fibre_g"),
                sodiumPer100g: num("salt_g") * 1000
            )
        }
    }

    // MARK: - FatSecret Restaurant Search (Fallback)

    // TODO: Replace FatSecret credentials after testing
    private static let fatSecretConsumerKey = "24d92fa48a384363aa06b7ed16f17f16"
    private static let fatSecretConsumerSecret = "61e1e3b0a4f842fc9d225958f8b3c294"

    private static let oauthUnreserved = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")

    private static func oauthEncode(_ string: String) -> String {
        string.addingPercentEncoding(withAllowedCharacters: oauthUnreserved) ?? string
    }

    private static func hmacSHA1(key: String, data: String) -> String {
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA1_DIGEST_LENGTH))
        CCHmac(CCHmacAlgorithm(kCCHmacAlgSHA1), key, key.count, data, data.count, &digest)
        return Data(digest).base64EncodedString()
    }

    private static func parseFatSecretDescription(_ desc: String) -> (servingLabel: String, calories: Double, fat: Double, carbs: Double, protein: Double) {
        let parts = desc.components(separatedBy: " - ")
        let servingLabel = parts.first ?? ""

        func extractValue(_ key: String, from text: String) -> Double {
            guard let range = text.range(of: "\(key): ") else { return 0 }
            let after = text[range.upperBound...]
            let numStr = after.prefix(while: { $0.isNumber || $0 == "." })
            return Double(numStr) ?? 0
        }

        let detail = parts.count > 1 ? parts[1] : desc
        return (
            servingLabel: servingLabel,
            calories: extractValue("Calories", from: detail),
            fat: extractValue("Fat", from: detail),
            carbs: extractValue("Carbs", from: detail),
            protein: extractValue("Protein", from: detail)
        )
    }

    /// Search by restaurant name — returns all items for that chain
    static func searchByRestaurant(name: String) async throws -> [Product] {
        guard let encoded = name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed),
              let url = URL(string: "https://uk-calories.vercel.app/api/data?restaurant=\(encoded)") else {
            return []
        }

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(from: url)
        } catch {
            throw LookupError.networkError(error)
        }

        guard let http = response as? HTTPURLResponse, http.statusCode == 200,
              let items = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]] else {
            return []
        }

        return parseUKFoodFactsItems(items)
    }

    /// Combined restaurant search: UK Food Facts (primary) + FatSecret (fallback)
    static func searchRestaurant(query: String) async throws -> [Product] {
        // Search both sources concurrently
        async let ukffResults = searchUKFoodFacts(query: query)
        async let fsResults = searchFatSecretAPI(query: query)

        let primary = (try? await ukffResults) ?? []
        let fallback = (try? await fsResults) ?? []

        // If ukfoodfacts has results, use those and deduplicate FatSecret additions
        if !primary.isEmpty {
            // Build set of item names from primary to avoid duplicates
            let primaryNames = Set(primary.map { $0.name.lowercased() })
            let extras = fallback.filter { !primaryNames.contains($0.name.lowercased()) }
            return primary + extras
        }

        // If ukfoodfacts returned nothing, use FatSecret entirely
        return fallback
    }

    private static func searchFatSecretAPI(query: String) async throws -> [Product] {
        let baseURL = "https://platform.fatsecret.com/rest/server.api"

        // API parameters
        var params: [String: String] = [
            "method": "foods.search",
            "search_expression": query,
            "format": "json",
            "max_results": "20",
            "region": "GB",
            "language": "en"
        ]

        // OAuth 1.0 parameters
        let timestamp = String(Int(Date().timeIntervalSince1970))
        let nonce = UUID().uuidString.replacingOccurrences(of: "-", with: "")

        params["oauth_consumer_key"] = fatSecretConsumerKey
        params["oauth_signature_method"] = "HMAC-SHA1"
        params["oauth_timestamp"] = timestamp
        params["oauth_nonce"] = nonce
        params["oauth_version"] = "1.0"

        // Build signature base string
        let sortedParams = params.sorted { $0.key < $1.key }
        let paramString = sortedParams.map { "\(oauthEncode($0.key))=\(oauthEncode($0.value))" }.joined(separator: "&")
        let baseString = "GET&\(oauthEncode(baseURL))&\(oauthEncode(paramString))"

        // Signing key: consumer_secret& (empty token secret)
        let signingKey = "\(oauthEncode(fatSecretConsumerSecret))&"

        let signature = hmacSHA1(key: signingKey, data: baseString)
        params["oauth_signature"] = signature

        // Build URL with all params
        let queryString = params.map { "\(oauthEncode($0.key))=\(oauthEncode($0.value))" }.joined(separator: "&")
        guard let url = URL(string: "\(baseURL)?\(queryString)") else { return [] }

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
              let foods = json["foods"] as? [String: Any] else {
            return []
        }

        // foods.food can be an array or a single object
        let foodArray: [[String: Any]]
        if let arr = foods["food"] as? [[String: Any]] {
            foodArray = arr
        } else if let single = foods["food"] as? [String: Any] {
            foodArray = [single]
        } else {
            return []
        }

        return foodArray.compactMap { item -> Product? in
            let name = item["food_name"] as? String ?? ""
            guard !name.isEmpty else { return nil }

            let brand = item["brand_name"] as? String ?? ""
            let description = item["food_description"] as? String ?? ""
            let parsed = parseFatSecretDescription(description)

            return Product(
                barcode: "",
                name: name,
                brand: brand,
                imageURL: nil,
                servingLabel: parsed.servingLabel.isEmpty ? nil : parsed.servingLabel,
                servingGrams: 100,
                caloriesPer100g: parsed.calories,
                proteinPer100g: parsed.protein,
                fatPer100g: parsed.fat,
                carbsPer100g: parsed.carbs,
                sugarsPer100g: 0,
                fiberPer100g: 0,
                sodiumPer100g: 0
            )
        }
    }
}
