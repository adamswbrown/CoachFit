package com.askadam.coachfit.ui.screens.food

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.local.FoodLogEntry
import com.askadam.coachfit.data.repository.FoodRepository
import com.askadam.coachfit.data.repository.Product
import com.askadam.coachfit.health.HealthConnectManager
import com.askadam.coachfit.util.DateUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class FoodSearchState(
    val query: String = "",
    val results: List<Product> = emptyList(),
    val isSearching: Boolean = false,
    val error: String? = null
)

data class ProductState(
    val product: Product? = null,
    val isLoading: Boolean = false,
    val servingGrams: Double = 100.0,
    val isSaving: Boolean = false,
    val error: String? = null,
    // Manual entry fields
    val manualName: String = "",
    val manualBrand: String = "",
    val manualCalories: String = "",
    val manualProtein: String = "",
    val manualFat: String = "",
    val manualCarbs: String = ""
)

@HiltViewModel
class FoodViewModel @Inject constructor(
    private val foodRepository: FoodRepository,
    private val healthConnectManager: HealthConnectManager
) : ViewModel() {

    private val _searchState = MutableStateFlow(FoodSearchState())
    val searchState: StateFlow<FoodSearchState> = _searchState

    private val _productState = MutableStateFlow(ProductState())
    val productState: StateFlow<ProductState> = _productState

    val todayEntries = foodRepository.getEntriesForDate(DateUtils.today())
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    val weekEntries = foodRepository.getEntriesForDateRange(
        DateUtils.formatDate(LocalDate.now().minusDays(6)),
        DateUtils.today()
    ).stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    private var searchJob: Job? = null

    fun search(query: String, searchType: String) {
        _searchState.update { it.copy(query = query) }
        searchJob?.cancel()
        if (query.length < 2) {
            _searchState.update { it.copy(results = emptyList()) }
            return
        }

        searchJob = viewModelScope.launch {
            delay(500) // debounce
            _searchState.update { it.copy(isSearching = true, error = null) }
            try {
                val results = if (searchType == "ingredients") {
                    foodRepository.searchIngredients(query)
                } else {
                    foodRepository.searchProducts(query)
                }
                _searchState.update { it.copy(results = results, isSearching = false) }
            } catch (e: Exception) {
                _searchState.update { it.copy(isSearching = false, error = e.message) }
            }
        }
    }

    fun lookupBarcode(barcode: String) {
        viewModelScope.launch {
            _productState.update { it.copy(isLoading = true, error = null) }
            val product = foodRepository.lookupBarcode(barcode)
            _productState.update {
                it.copy(
                    isLoading = false,
                    product = product,
                    servingGrams = product?.servingGrams ?: 100.0
                )
            }
        }
    }

    fun selectProduct(product: Product) {
        _productState.update {
            it.copy(product = product, servingGrams = product.servingGrams)
        }
    }

    fun setServingGrams(grams: Double) {
        _productState.update { it.copy(servingGrams = grams) }
    }

    fun setManualField(field: String, value: String) {
        _productState.update { state ->
            when (field) {
                "name" -> state.copy(manualName = value)
                "brand" -> state.copy(manualBrand = value)
                "calories" -> state.copy(manualCalories = value)
                "protein" -> state.copy(manualProtein = value)
                "fat" -> state.copy(manualFat = value)
                "carbs" -> state.copy(manualCarbs = value)
                else -> state
            }
        }
    }

    fun logProduct(onSaved: () -> Unit) {
        viewModelScope.launch {
            _productState.update { it.copy(isSaving = true) }

            val state = _productState.value
            val product = state.product
            val grams = state.servingGrams

            val entry = if (product != null) {
                FoodLogEntry(
                    date = DateUtils.today(),
                    barcode = product.barcode.ifBlank { null },
                    name = product.name,
                    brand = product.brand.ifBlank { null },
                    servingGrams = grams,
                    calories = product.scaledCalories(grams),
                    protein = product.scaledProtein(grams),
                    fat = product.scaledFat(grams),
                    carbs = product.scaledCarbs(grams),
                    sugar = product.scaledSugar(grams),
                    fiber = product.scaledFiber(grams),
                    sodium = product.scaledSodium(grams),
                    loggedAt = DateUtils.epochMillis()
                )
            } else {
                // Manual entry
                FoodLogEntry(
                    date = DateUtils.today(),
                    barcode = null,
                    name = state.manualName.ifBlank { "Manual entry" },
                    brand = state.manualBrand.ifBlank { null },
                    servingGrams = grams,
                    calories = state.manualCalories.toDoubleOrNull() ?: 0.0,
                    protein = state.manualProtein.toDoubleOrNull() ?: 0.0,
                    fat = state.manualFat.toDoubleOrNull() ?: 0.0,
                    carbs = state.manualCarbs.toDoubleOrNull() ?: 0.0,
                    sugar = null,
                    fiber = null,
                    sodium = null,
                    loggedAt = DateUtils.epochMillis()
                )
            }

            foodRepository.logFood(entry)

            // Write to Health Connect
            try {
                healthConnectManager.saveNutrition(
                    calories = entry.calories,
                    protein = entry.protein,
                    fat = entry.fat,
                    carbs = entry.carbs,
                    date = LocalDate.now()
                )
            } catch (_: Exception) {
                // Health Connect write is best-effort
            }

            _productState.update { it.copy(isSaving = false) }
            onSaved()
        }
    }

    fun deleteEntry(id: Long) {
        viewModelScope.launch {
            foodRepository.deleteEntry(id)
        }
    }

    fun resetProduct() {
        _productState.value = ProductState()
    }

    fun resetSearch() {
        _searchState.value = FoodSearchState()
    }
}
