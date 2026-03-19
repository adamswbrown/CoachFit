package com.askadam.coachfit.ui.screens.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.remote.ApiService
import com.askadam.coachfit.data.remote.ProfileMetric
import com.askadam.coachfit.data.remote.ProfilePayload
import com.askadam.coachfit.data.repository.AuthRepository
import com.askadam.coachfit.data.repository.SyncRepository
import com.askadam.coachfit.health.HealthConnectManager
import com.askadam.coachfit.util.DateUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.Instant
import javax.inject.Inject

data class OnboardingUiState(
    val coachName: String = "",
    val selectedGoal: String? = null,
    val heightCm: String = "",
    val weightKg: String = "",
    val activityLevel: String = "moderate",
    val healthConnected: Boolean = false,
    val isSubmitting: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class OnboardingViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val apiService: ApiService,
    private val healthConnectManager: HealthConnectManager,
    private val syncRepository: SyncRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState

    init {
        _uiState.update { it.copy(coachName = authRepository.getCoachName() ?: "your coach") }
    }

    fun setGoal(goal: String) {
        _uiState.update { it.copy(selectedGoal = goal) }
    }

    fun setHeight(height: String) {
        _uiState.update { it.copy(heightCm = height) }
    }

    fun setWeight(weight: String) {
        _uiState.update { it.copy(weightKg = weight) }
    }

    fun setActivityLevel(level: String) {
        _uiState.update { it.copy(activityLevel = level) }
    }

    fun onHealthPermissionsResult(granted: Boolean) {
        _uiState.update { it.copy(healthConnected = granted) }
    }

    fun completeOnboarding(onComplete: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true) }
            try {
                submitProfile()
                authRepository.setOnboardingComplete(true)

                if (_uiState.value.healthConnected) {
                    syncRepository.performInitialBackfill()
                }

                _uiState.update { it.copy(isSubmitting = false) }
                onComplete()
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(isSubmitting = false, error = e.message)
                }
            }
        }
    }

    private suspend fun submitProfile() {
        val clientId = authRepository.getClientId() ?: return
        val metrics = mutableListOf<ProfileMetric>()
        val now = DateUtils.toIsoString(Instant.now())

        _uiState.value.weightKg.toDoubleOrNull()?.let { kg ->
            metrics.add(ProfileMetric("weight", kg, "kg", now))
        }

        _uiState.value.heightCm.toDoubleOrNull()?.let { cm ->
            metrics.add(ProfileMetric("height", cm / 100.0, "m", now))
        }

        if (metrics.isNotEmpty()) {
            apiService.submitProfile(ProfilePayload(clientId, metrics))
        }
    }
}
