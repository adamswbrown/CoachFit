package com.askadam.coachfit.ui.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.askadam.coachfit.data.repository.AuthRepository
import com.askadam.coachfit.data.repository.SyncRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class MainViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val syncRepository: SyncRepository
) : ViewModel() {

    val isSignedIn: StateFlow<Boolean> = authRepository.isSignedIn
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), authRepository.isSignedInSync())

    val onboardingComplete: StateFlow<Boolean> = authRepository.onboardingComplete
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), authRepository.isOnboardingCompleteSync())

    fun onForegroundEntry() {
        if (authRepository.isSignedInSync()) {
            viewModelScope.launch {
                syncRepository.syncAll()
            }
        }
    }
}
