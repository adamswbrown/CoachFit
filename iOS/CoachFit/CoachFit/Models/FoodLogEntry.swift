import Foundation
import SwiftData

@Model
final class FoodLogEntry {
    var date: String
    var barcode: String?
    var name: String
    var brand: String?
    var servingGrams: Double
    var calories: Double
    var protein: Double
    var fat: Double
    var carbs: Double
    var sugar: Double?
    var fiber: Double?
    var sodium: Double?
    var loggedAt: Date

    init(date: String, barcode: String? = nil, name: String, brand: String? = nil,
         servingGrams: Double, calories: Double, protein: Double, fat: Double,
         carbs: Double, sugar: Double? = nil, fiber: Double? = nil,
         sodium: Double? = nil, loggedAt: Date = .now) {
        self.date = date
        self.barcode = barcode
        self.name = name
        self.brand = brand
        self.servingGrams = servingGrams
        self.calories = calories
        self.protein = protein
        self.fat = fat
        self.carbs = carbs
        self.sugar = sugar
        self.fiber = fiber
        self.sodium = sodium
        self.loggedAt = loggedAt
    }
}
