package com.askadam.coachfit.ui.screens.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.remote.StreakResponse
import com.askadam.coachfit.data.remote.WorkoutRecord
import com.askadam.coachfit.data.repository.AuthRepository
import com.askadam.coachfit.data.repository.CheckInRepository
import com.askadam.coachfit.data.repository.FoodRepository
import com.askadam.coachfit.health.HealthConnectManager
import com.askadam.coachfit.data.remote.ApiService
import com.askadam.coachfit.util.DateUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class TodayUiState(
    val coachName: String = "",
    val isLoading: Boolean = true,
    val isSubmitting: Boolean = false,
    val isSubmitted: Boolean = false,
    val error: String? = null,
    // Health data
    val steps: Int? = null,
    val weightLbs: Double? = null,
    val sleepMinutes: Int? = null,
    val recentWorkouts: List<WorkoutRecord> = emptyList(),
    val foodCalories: Int? = null,
    // Form fields
    val weightInput: String = "",
    val stepsInput: String = "",
    val caloriesInput: String = "",
    val sleepQuality: Int? = null,
    val perceivedStress: Int? = null,
    val notes: String = "",
    val selectedNoteChips: Set<String> = emptySet(),
    // Streak
    val streak: StreakResponse? = null
)

@HiltViewModel
class TodayViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val checkInRepository: CheckInRepository,
    private val healthConnectManager: HealthConnectManager,
    private val foodRepository: FoodRepository,
    private val apiService: ApiService
) : ViewModel() {

    private val _uiState = MutableStateFlow(TodayUiState())
    val uiState: StateFlow<TodayUiState> = _uiState

    init {
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(
                isLoading = true,
                coachName = authRepository.getCoachName() ?: "Coach"
            )}

            // Check if already submitted today
            val submitted = checkInRepository.isCheckedInToday()

            // Fetch health data
            val healthData = healthConnectManager.fetchTodayData()

            // Fetch food calories
            val foodCal = foodRepository.getTodayCalories().toInt().let { if (it > 0) it else null }

            // Fetch streak
            val streak = try { apiService.getStreak() } catch (_: Exception) { null }

            _uiState.update {
                it.copy(
                    isLoading = false,
                    isSubmitted = submitted,
                    steps = healthData.steps,
                    weightLbs = healthData.weightLbs,
                    sleepMinutes = healthData.lastNightSleep?.totalSleepMinutes,
                    recentWorkouts = healthData.recentWorkouts,
                    foodCalories = foodCal,
                    // Pre-fill form
                    stepsInput = healthData.steps?.toString() ?: "",
                    weightInput = healthData.weightLbs?.let { String.format("%.1f", it) } ?: "",
                    caloriesInput = foodCal?.toString() ?: "",
                    streak = streak
                )
            }
        }
    }

    fun setWeightInput(value: String) = _uiState.update { it.copy(weightInput = value) }
    fun setStepsInput(value: String) = _uiState.update { it.copy(stepsInput = value) }
    fun setCaloriesInput(value: String) = _uiState.update { it.copy(caloriesInput = value) }
    fun setSleepQuality(value: Int) = _uiState.update { it.copy(sleepQuality = value) }
    fun setPerceivedStress(value: Int) = _uiState.update { it.copy(perceivedStress = value) }
    fun setNotes(value: String) = _uiState.update { it.copy(notes = value) }

    fun toggleNoteChip(note: String) {
        _uiState.update { state ->
            val chips = state.selectedNoteChips.toMutableSet()
            if (note in chips) chips.remove(note) else chips.add(note)
            val notesText = chips.joinToString(", ").let { combined ->
                if (state.notes.isNotBlank() && combined.isNotBlank()) {
                    "${state.notes}, $combined"
                } else combined.ifBlank { state.notes }
            }
            state.copy(selectedNoteChips = chips)
        }
    }

    fun submitCheckIn() {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, error = null) }

            val state = _uiState.value
            val chipNotes = state.selectedNoteChips.joinToString(", ")
            val allNotes = listOf(state.notes, chipNotes)
                .filter { it.isNotBlank() }
                .joinToString(". ")

            val result = checkInRepository.submitEntry(
                date = DateUtils.today(),
                weightLbs = state.weightInput.toDoubleOrNull(),
                steps = state.stepsInput.toIntOrNull(),
                calories = state.caloriesInput.toIntOrNull(),
                sleepQuality = state.sleepQuality,
                perceivedStress = state.perceivedStress,
                notes = allNotes.ifBlank { null }
            )

            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isSubmitting = false, isSubmitted = true) }
                },
                onFailure = { e ->
                    _uiState.update { it.copy(isSubmitting = false, error = e.message) }
                }
            )
        }
    }

    fun editCheckIn() {
        viewModelScope.launch {
            checkInRepository.clearCheckedIn(DateUtils.today())
            _uiState.update { it.copy(isSubmitted = false) }
        }
    }
}
