package com.askadam.coachfit.ui.screens.more

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.remote.ApiService
import com.askadam.coachfit.data.remote.Milestone
import com.askadam.coachfit.data.remote.NutritionPayload
import com.askadam.coachfit.data.remote.NutritionRow
import com.askadam.coachfit.data.repository.AuthRepository
import com.askadam.coachfit.data.repository.CronometerRow
import com.askadam.coachfit.data.repository.CronometerParseResult
import com.askadam.coachfit.data.repository.FoodRepository
import com.askadam.coachfit.data.repository.SyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.io.InputStream
import javax.inject.Inject

data class MoreUiState(
    val coachName: String = "",
    val milestones: List<Milestone> = emptyList()
)

@HiltViewModel
class MoreViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val apiService: ApiService,
    private val foodRepository: FoodRepository,
    val syncRepository: SyncRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(MoreUiState())
    val uiState: StateFlow<MoreUiState> = _uiState

    init {
        _uiState.update { it.copy(coachName = authRepository.getCoachName() ?: "Coach") }
        loadMilestones()
    }

    private fun loadMilestones() {
        viewModelScope.launch {
            try {
                val streak = apiService.getStreak()
                _uiState.update { it.copy(milestones = streak.milestones ?: emptyList()) }
            } catch (_: Exception) {
                // Milestones are best-effort
            }
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            syncRepository.syncAll()
        }
    }

    fun parseCsv(inputStream: InputStream): CronometerParseResult {
        return foodRepository.parseCronometerCsv(inputStream)
    }

    fun uploadCsvRows(rows: List<CronometerRow>) {
        viewModelScope.launch {
            val clientId = authRepository.getClientId() ?: return@launch
            val nutritionRows = rows.map { row ->
                NutritionRow(
                    date = row.date,
                    calories = row.calories,
                    proteinGrams = row.proteinGrams,
                    carbsGrams = row.carbsGrams,
                    fatGrams = row.fatGrams,
                    fiberGrams = row.fiberGrams
                )
            }
            try {
                apiService.submitNutrition(NutritionPayload(clientId, nutritionRows))
            } catch (_: Exception) {
                // Handle error in UI if needed
            }
        }
    }

    fun unpair(onComplete: () -> Unit) {
        viewModelScope.launch {
            authRepository.signOut()
            onComplete()
        }
    }
}
