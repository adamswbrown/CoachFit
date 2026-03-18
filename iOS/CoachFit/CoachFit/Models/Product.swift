import Foundation

struct Product: Sendable {
    let barcode: String
    let name: String
    let brand: String
    let imageURL: URL?
    let servingLabel: String?
    let servingGrams: Double
    let caloriesPer100g: Double
    let proteinPer100g: Double
    let fatPer100g: Double
    let carbsPer100g: Double
    let sugarsPer100g: Double
    let fiberPer100g: Double
    let sodiumPer100g: Double

    func scaled(grams: Double) -> (calories: Double, protein: Double, fat: Double, carbs: Double) {
        let ratio = grams / 100.0
        return (caloriesPer100g * ratio, proteinPer100g * ratio, fatPer100g * ratio, carbsPer100g * ratio)
    }
}
