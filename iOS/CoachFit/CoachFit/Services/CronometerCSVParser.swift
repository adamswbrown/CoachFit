import Foundation

struct CronometerRow: Identifiable {
    let id = UUID()
    let date: String          // YYYY-MM-DD
    var calories: Int?
    var proteinGrams: Double?
    var carbsGrams: Double?
    var fatGrams: Double?
    var fiberGrams: Double?
}

struct CronometerParseResult {
    let rows: [CronometerRow]
    let warnings: [String]
    let totalRowsInFile: Int
}

enum CronometerCSVParser {

    static func parse(_ csvText: String) -> CronometerParseResult {
        var warnings: [String] = []

        let lines = csvText.components(separatedBy: .newlines).filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
        guard lines.count >= 2 else {
            return CronometerParseResult(rows: [], warnings: ["File is empty or has no data rows"], totalRowsInFile: 0)
        }

        let headers = parseCSVLine(lines[0]).map { $0.trimmingCharacters(in: .whitespaces) }

        // Find the date column
        let dateIndex = headers.firstIndex { matchesDate($0) }
        guard let dateIndex else {
            return CronometerParseResult(
                rows: [],
                warnings: ["Could not find a Date column. Expected a column named 'Date' or 'Day'."],
                totalRowsInFile: lines.count - 1
            )
        }

        // Map nutrition columns
        let columnMap = mapNutritionColumns(headers: headers, dateIndex: dateIndex)

        if columnMap.isEmpty {
            warnings.append("No nutrition columns matched. Expected 'Energy (kcal)', 'Protein (g)', etc.")
        }

        // Parse data rows
        var rows: [CronometerRow] = []

        for i in 1..<lines.count {
            let values = parseCSVLine(lines[i])
            guard dateIndex < values.count else {
                warnings.append("Row \(i): missing columns, skipped")
                continue
            }

            guard let normalizedDate = normalizeDate(values[dateIndex]) else {
                warnings.append("Row \(i): could not parse date '\(values[dateIndex])', skipped")
                continue
            }

            var row = CronometerRow(date: normalizedDate)

            for (colIndex, field) in columnMap {
                guard colIndex < values.count else { continue }
                let numValue = parseNumeric(values[colIndex])

                switch field {
                case .calories:     row.calories = numValue.map { Int(round($0)) }
                case .protein:      row.proteinGrams = numValue
                case .carbs:        row.carbsGrams = numValue
                case .fat:          row.fatGrams = numValue
                case .fiber:        row.fiberGrams = numValue
                }
            }

            // Only include rows with at least one nutrition value
            if row.calories != nil || row.proteinGrams != nil || row.carbsGrams != nil
                || row.fatGrams != nil || row.fiberGrams != nil {
                rows.append(row)
            }
        }

        return CronometerParseResult(rows: rows, warnings: warnings, totalRowsInFile: lines.count - 1)
    }

    // MARK: - Column Matching

    private enum NutritionField {
        case calories, protein, carbs, fat, fiber
    }

    private static let columnPatterns: [(NutritionField, [String])] = [
        (.calories, ["energy (kcal)", "calories", "energy", "kcal"]),
        (.protein,  ["protein (g)", "protein"]),
        (.carbs,    ["carbs (g)", "carbohydrates (g)", "carbs", "carbohydrates", "net carbs (g)"]),
        (.fat,      ["fat (g)", "total fat (g)", "fat"]),
        (.fiber,    ["fiber (g)", "fibre (g)", "dietary fiber (g)", "fiber", "fibre"]),
    ]

    private static func matchesDate(_ header: String) -> Bool {
        let lower = header.lowercased().trimmingCharacters(in: .whitespaces)
        return lower == "date" || lower == "day"
    }

    private static func mapNutritionColumns(headers: [String], dateIndex: Int) -> [(Int, NutritionField)] {
        var mapped: [(Int, NutritionField)] = []
        var usedFields = Set<String>()

        for (i, header) in headers.enumerated() {
            if i == dateIndex { continue }
            let lower = header.lowercased().trimmingCharacters(in: .whitespaces)

            for (field, patterns) in columnPatterns {
                let fieldKey = "\(field)"
                if usedFields.contains(fieldKey) { continue }

                if patterns.contains(where: { lower == $0 }) {
                    mapped.append((i, field))
                    usedFields.insert(fieldKey)
                    break
                }
            }
        }

        return mapped
    }

    // MARK: - CSV Line Parsing (handles quoted fields with commas)

    private static func parseCSVLine(_ line: String) -> [String] {
        var fields: [String] = []
        var current = ""
        var inQuotes = false

        for char in line {
            if char == "\"" {
                inQuotes.toggle()
            } else if char == "," && !inQuotes {
                fields.append(current.trimmingCharacters(in: .whitespaces))
                current = ""
            } else {
                current.append(char)
            }
        }
        fields.append(current.trimmingCharacters(in: .whitespaces))
        return fields
    }

    // MARK: - Helpers

    private static func parseNumeric(_ value: String) -> Double? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return nil }
        guard let num = Double(trimmed), !num.isNaN, num >= 0 else { return nil }
        return num
    }

    private static func normalizeDate(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)

        // YYYY-MM-DD
        if trimmed.range(of: #"^\d{4}-\d{2}-\d{2}$"#, options: .regularExpression) != nil {
            return trimmed
        }

        // MM/DD/YYYY or M/D/YYYY
        if trimmed.range(of: #"^(\d{1,2})/(\d{1,2})/(\d{4})$"#, options: .regularExpression) != nil {
            let parts = trimmed.split(separator: "/")
            if parts.count == 3 {
                let m = String(format: "%02d", Int(parts[0]) ?? 0)
                let d = String(format: "%02d", Int(parts[1]) ?? 0)
                let y = parts[2]
                return "\(y)-\(m)-\(d)"
            }
        }

        // Fallback: DateFormatter
        let formatter = DateFormatter()
        for fmt in ["yyyy-MM-dd", "MM/dd/yyyy", "M/d/yyyy", "MMM d, yyyy"] {
            formatter.dateFormat = fmt
            if let date = formatter.date(from: trimmed) {
                let outFmt = DateFormatter()
                outFmt.dateFormat = "yyyy-MM-dd"
                return outFmt.string(from: date)
            }
        }

        return nil
    }
}
