package com.askadam.coachfit.ui.screens.health

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.remote.WorkoutRecord
import com.askadam.coachfit.data.repository.SyncRepository
import com.askadam.coachfit.health.DailyHealthSummary
import com.askadam.coachfit.health.HealthConnectManager
import com.askadam.coachfit.util.DateUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

enum class HealthPermissionState {
    CHECKING, UNAVAILABLE, NEEDS_PERMISSION, CONNECTED
}

data class HealthUiState(
    val permissionState: HealthPermissionState = HealthPermissionState.CHECKING,
    val isLoading: Boolean = true,
    val todaySummary: DailyHealthSummary? = null,
    val weekSummaries: List<DailyHealthSummary> = emptyList(),
    val recentWorkouts: List<WorkoutRecord> = emptyList()
)

@HiltViewModel
class HealthViewModel @Inject constructor(
    private val healthConnectManager: HealthConnectManager,
    val syncRepository: SyncRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HealthUiState())
    val uiState: StateFlow<HealthUiState> = _uiState

    init {
        checkPermissions()
    }

    fun checkPermissions() {
        viewModelScope.launch {
            if (!healthConnectManager.isAvailable()) {
                _uiState.update { it.copy(permissionState = HealthPermissionState.UNAVAILABLE, isLoading = false) }
                return@launch
            }

            val hasPermissions = healthConnectManager.hasAllPermissions()
            if (hasPermissions) {
                _uiState.update { it.copy(permissionState = HealthPermissionState.CONNECTED) }
                loadData()
            } else {
                _uiState.update { it.copy(permissionState = HealthPermissionState.NEEDS_PERMISSION, isLoading = false) }
            }
        }
    }

    fun onPermissionsGranted() {
        _uiState.update { it.copy(permissionState = HealthPermissionState.CONNECTED) }
        loadData()
    }

    fun loadData() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true) }

            val today = healthConnectManager.fetchDailySummary(LocalDate.now())
            val week = healthConnectManager.fetchWeekSummaries()
            val workouts = healthConnectManager.fetchWorkouts(DateUtils.startOfDay(LocalDate.now()))

            _uiState.update {
                it.copy(
                    isLoading = false,
                    todaySummary = today,
                    weekSummaries = week,
                    recentWorkouts = workouts
                )
            }
        }
    }
}
