package com.askadam.coachfit.ui.screens.signin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.remote.ApiService
import com.askadam.coachfit.data.remote.PairRequest
import com.askadam.coachfit.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignInUiState(
    val isLoading: Boolean = false,
    val error: String? = null
)

@HiltViewModel
class SignInViewModel @Inject constructor(
    private val apiService: ApiService,
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(SignInUiState())
    val uiState: StateFlow<SignInUiState> = _uiState

    fun pair(code: String, onSuccess: (needsOnboarding: Boolean) -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            try {
                val response = apiService.pair(PairRequest(code = code))
                authRepository.saveCredentials(
                    deviceToken = response.deviceToken,
                    clientId = response.clientId,
                    clientName = response.client?.name,
                    coachName = response.coach?.name
                )
                _uiState.update { it.copy(isLoading = false) }
                onSuccess(!authRepository.isOnboardingCompleteSync())
            } catch (e: Exception) {
                _uiState.update {
                    it.copy(
                        isLoading = false,
                        error = e.message ?: "Failed to pair. Check your code and try again."
                    )
                }
            }
        }
    }
}
