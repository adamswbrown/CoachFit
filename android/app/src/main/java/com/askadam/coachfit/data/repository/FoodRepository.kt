package com.askadam.coachfit.data.repository

import com.askadam.coachfit.data.local.FoodLogDao
import com.askadam.coachfit.data.local.FoodLogEntry
import com.askadam.coachfit.util.DateUtils
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

data class Product(
    val barcode: String,
    val name: String,
    val brand: String,
    val imageUrl: String?,
    val servingLabel: String?,
    val servingGrams: Double,
    val caloriesPer100g: Double,
    val proteinPer100g: Double,
    val fatPer100g: Double,
    val carbsPer100g: Double,
    val sugarsPer100g: Double,
    val fiberPer100g: Double,
    val sodiumPer100g: Double
) {
    fun scaledCalories(grams: Double): Double = caloriesPer100g * grams / 100.0
    fun scaledProtein(grams: Double): Double = proteinPer100g * grams / 100.0
    fun scaledFat(grams: Double): Double = fatPer100g * grams / 100.0
    fun scaledCarbs(grams: Double): Double = carbsPer100g * grams / 100.0
    fun scaledSugar(grams: Double): Double = sugarsPer100g * grams / 100.0
    fun scaledFiber(grams: Double): Double = fiberPer100g * grams / 100.0
    fun scaledSodium(grams: Double): Double = sodiumPer100g * grams / 100.0
}

data class CronometerRow(
    val date: String,
    val calories: Int?,
    val proteinGrams: Double?,
    val carbsGrams: Double?,
    val fatGrams: Double?,
    val fiberGrams: Double?
)

data class CronometerParseResult(
    val rows: List<CronometerRow>,
    val warnings: List<String>,
    val totalRowsInFile: Int
)

@Singleton
class FoodRepository @Inject constructor(
    private val foodLogDao: FoodLogDao,
    private val gson: Gson
) {
    companion object {
        private const val OFF_BASE = "https://world.openfoodfacts.net"
        private const val OFF_SEARCH = "https://world.openfoodfacts.org/cgi/search.pl"
        private const val USDA_BASE = "https://api.nal.usda.gov/fdc/v1/foods/search"
        private const val USDA_API_KEY = "DEMO_KEY"
    }

    // === Room operations ===

    fun getEntriesForDate(date: String): Flow<List<FoodLogEntry>> =
        foodLogDao.getEntriesForDate(date)

    fun getEntriesForDateRange(startDate: String, endDate: String): Flow<List<FoodLogEntry>> =
        foodLogDao.getEntriesForDateRange(startDate, endDate)

    suspend fun getTodayCalories(): Double =
        foodLogDao.getTotalCaloriesForDate(DateUtils.today()) ?: 0.0

    suspend fun logFood(entry: FoodLogEntry): Long =
        foodLogDao.insert(entry)

    suspend fun deleteEntry(id: Long) =
        foodLogDao.deleteById(id)

    // === Barcode lookup (Open Food Facts) ===

    suspend fun lookupBarcode(barcode: String): Product? = withContext(Dispatchers.IO) {
        try {
            val url = URL("$OFF_BASE/api/v2/product/$barcode.json")
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode != 200) return@withContext null

            val json = connection.inputStream.bufferedReader().readText()
            val root = gson.fromJson(json, JsonObject::class.java)

            if (root.get("status")?.asInt != 1) return@withContext null

            val product = root.getAsJsonObject("product") ?: return@withContext null
            val nutriments = product.getAsJsonObject("nutriments") ?: return@withContext null

            Product(
                barcode = barcode,
                name = product.get("product_name")?.asString ?: "Unknown",
                brand = product.get("brands")?.asString ?: "",
                imageUrl = product.get("image_front_url")?.asString,
                servingLabel = product.get("serving_size")?.asString,
                servingGrams = product.get("serving_quantity")?.asDouble ?: 100.0,
                caloriesPer100g = nutriments.get("energy-kcal_100g")?.asDouble ?: 0.0,
                proteinPer100g = nutriments.get("proteins_100g")?.asDouble ?: 0.0,
                fatPer100g = nutriments.get("fat_100g")?.asDouble ?: 0.0,
                carbsPer100g = nutriments.get("carbohydrates_100g")?.asDouble ?: 0.0,
                sugarsPer100g = nutriments.get("sugars_100g")?.asDouble ?: 0.0,
                fiberPer100g = nutriments.get("fiber_100g")?.asDouble ?: 0.0,
                sodiumPer100g = nutriments.get("sodium_100g")?.asDouble ?: 0.0
            )
        } catch (e: Exception) {
            null
        }
    }

    // === Product search (Open Food Facts) ===

    suspend fun searchProducts(query: String): List<Product> = withContext(Dispatchers.IO) {
        try {
            val encoded = URLEncoder.encode(query, "UTF-8")
            val url = URL(
                "$OFF_SEARCH?search_terms=$encoded&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,brands,image_front_url,serving_size,serving_quantity,nutriments"
            )
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode != 200) return@withContext emptyList()

            val json = connection.inputStream.bufferedReader().readText()
            val root = gson.fromJson(json, JsonObject::class.java)
            val products = root.getAsJsonArray("products") ?: return@withContext emptyList()

            products.mapNotNull { element ->
                val p = element.asJsonObject
                val nutriments = p.getAsJsonObject("nutriments") ?: return@mapNotNull null
                val name = p.get("product_name")?.asString
                if (name.isNullOrBlank()) return@mapNotNull null

                Product(
                    barcode = p.get("code")?.asString ?: "",
                    name = name,
                    brand = p.get("brands")?.asString ?: "",
                    imageUrl = p.get("image_front_url")?.asString,
                    servingLabel = p.get("serving_size")?.asString,
                    servingGrams = p.get("serving_quantity")?.asDouble ?: 100.0,
                    caloriesPer100g = nutriments.get("energy-kcal_100g")?.asDouble ?: 0.0,
                    proteinPer100g = nutriments.get("proteins_100g")?.asDouble ?: 0.0,
                    fatPer100g = nutriments.get("fat_100g")?.asDouble ?: 0.0,
                    carbsPer100g = nutriments.get("carbohydrates_100g")?.asDouble ?: 0.0,
                    sugarsPer100g = nutriments.get("sugars_100g")?.asDouble ?: 0.0,
                    fiberPer100g = nutriments.get("fiber_100g")?.asDouble ?: 0.0,
                    sodiumPer100g = nutriments.get("sodium_100g")?.asDouble ?: 0.0
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    // === Ingredient search (USDA FDC) ===

    suspend fun searchIngredients(query: String): List<Product> = withContext(Dispatchers.IO) {
        try {
            val encoded = URLEncoder.encode(query, "UTF-8")
            val url = URL("$USDA_BASE?api_key=$USDA_API_KEY&query=$encoded&pageSize=20")
            val connection = url.openConnection() as HttpURLConnection
            connection.connectTimeout = 10000
            connection.readTimeout = 10000

            if (connection.responseCode != 200) return@withContext emptyList()

            val json = connection.inputStream.bufferedReader().readText()
            val root = gson.fromJson(json, JsonObject::class.java)
            val foods = root.getAsJsonArray("foods") ?: return@withContext emptyList()

            foods.mapNotNull { element ->
                val food = element.asJsonObject
                val name = food.get("description")?.asString ?: return@mapNotNull null
                val nutrients = food.getAsJsonArray("foodNutrients") ?: return@mapNotNull null

                fun nutrientValue(id: Int): Double {
                    for (n in nutrients) {
                        val obj = n.asJsonObject
                        if (obj.get("nutrientId")?.asInt == id) {
                            return obj.get("value")?.asDouble ?: 0.0
                        }
                    }
                    return 0.0
                }

                Product(
                    barcode = "",
                    name = name,
                    brand = food.get("brandName")?.asString ?: "USDA",
                    imageUrl = null,
                    servingLabel = "per 100g",
                    servingGrams = 100.0,
                    caloriesPer100g = nutrientValue(1008).let { if (it == 0.0) nutrientValue(2047).let { v -> if (v == 0.0) nutrientValue(2048) else v } else it },
                    proteinPer100g = nutrientValue(1003),
                    fatPer100g = nutrientValue(1004),
                    carbsPer100g = nutrientValue(1005),
                    sugarsPer100g = nutrientValue(2000),
                    fiberPer100g = nutrientValue(1079),
                    sodiumPer100g = nutrientValue(1093)
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    // === CSV parsing (Cronometer) ===

    fun parseCronometerCsv(inputStream: InputStream): CronometerParseResult {
        val reader = BufferedReader(InputStreamReader(inputStream))
        val warnings = mutableListOf<String>()
        val rows = mutableListOf<CronometerRow>()
        var totalRows = 0

        val headerLine = reader.readLine() ?: return CronometerParseResult(emptyList(), listOf("Empty file"), 0)
        val headers = parseCsvLine(headerLine).map { it.trim().lowercase() }

        // Find column indices
        val dateIdx = headers.indexOfFirst { it in listOf("date", "day") }
        val caloriesIdx = headers.indexOfFirst { it in listOf("energy (kcal)", "calories", "energy") }
        val proteinIdx = headers.indexOfFirst { it in listOf("protein (g)", "protein") }
        val carbsIdx = headers.indexOfFirst { it in listOf("carbs (g)", "carbohydrates (g)", "net carbs (g)", "carbohydrates") }
        val fatIdx = headers.indexOfFirst { it in listOf("fat (g)", "total fat (g)", "fat") }
        val fiberIdx = headers.indexOfFirst { it in listOf("fiber (g)", "fibre (g)", "dietary fiber (g)", "fiber") }

        if (dateIdx == -1) {
            return CronometerParseResult(emptyList(), listOf("No date column found"), 0)
        }

        reader.forEachLine { line ->
            totalRows++
            val cols = parseCsvLine(line)
            if (cols.size <= dateIdx) return@forEachLine

            val rawDate = cols[dateIdx].trim()
            val normalizedDate = normalizeDate(rawDate)
            if (normalizedDate == null) {
                warnings.add("Unparseable date: $rawDate")
                return@forEachLine
            }

            rows.add(
                CronometerRow(
                    date = normalizedDate,
                    calories = cols.getOrNull(caloriesIdx)?.trim()?.toDoubleOrNull()?.toInt(),
                    proteinGrams = cols.getOrNull(proteinIdx)?.trim()?.toDoubleOrNull(),
                    carbsGrams = cols.getOrNull(carbsIdx)?.trim()?.toDoubleOrNull(),
                    fatGrams = cols.getOrNull(fatIdx)?.trim()?.toDoubleOrNull(),
                    fiberGrams = cols.getOrNull(fiberIdx)?.trim()?.toDoubleOrNull()
                )
            )
        }

        return CronometerParseResult(rows, warnings, totalRows)
    }

    private fun parseCsvLine(line: String): List<String> {
        val result = mutableListOf<String>()
        val current = StringBuilder()
        var inQuotes = false

        for (ch in line) {
            when {
                ch == '"' -> inQuotes = !inQuotes
                ch == ',' && !inQuotes -> {
                    result.add(current.toString())
                    current.clear()
                }
                else -> current.append(ch)
            }
        }
        result.add(current.toString())
        return result
    }

    private fun normalizeDate(raw: String): String? {
        // Try YYYY-MM-DD
        if (raw.matches(Regex("""\d{4}-\d{2}-\d{2}"""))) return raw

        // Try MM/DD/YYYY or M/D/YYYY
        val slashMatch = Regex("""(\d{1,2})/(\d{1,2})/(\d{4})""").matchEntire(raw)
        if (slashMatch != null) {
            val (m, d, y) = slashMatch.destructured
            return "$y-${m.padStart(2, '0')}-${d.padStart(2, '0')}"
        }

        // Try "MMM d yyyy" (e.g., "Mar 19 2026")
        val months = mapOf(
            "jan" to "01", "feb" to "02", "mar" to "03", "apr" to "04",
            "may" to "05", "jun" to "06", "jul" to "07", "aug" to "08",
            "sep" to "09", "oct" to "10", "nov" to "11", "dec" to "12"
        )
        val mmmMatch = Regex("""(\w{3})\s+(\d{1,2})\s+(\d{4})""").matchEntire(raw)
        if (mmmMatch != null) {
            val (mon, day, year) = mmmMatch.destructured
            val monthNum = months[mon.lowercase()] ?: return null
            return "$year-$monthNum-${day.padStart(2, '0')}"
        }

        return null
    }
}
