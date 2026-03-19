package com.askadam.coachfit

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.repeatOnLifecycle
import com.askadam.coachfit.ui.navigation.CoachFitNavHost
import com.askadam.coachfit.ui.navigation.MainViewModel
import com.askadam.coachfit.ui.theme.CoachFitTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            CoachFitTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val mainViewModel: MainViewModel = hiltViewModel()
                    val isSignedIn by mainViewModel.isSignedIn.collectAsStateWithLifecycle()
                    val onboardingComplete by mainViewModel.onboardingComplete.collectAsStateWithLifecycle()

                    // Trigger sync on foreground entry
                    val lifecycleOwner = LocalLifecycleOwner.current
                    LaunchedEffect(lifecycleOwner) {
                        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
                            mainViewModel.onForegroundEntry()
                        }
                    }

                    CoachFitNavHost(
                        isSignedIn = isSignedIn,
                        onboardingComplete = onboardingComplete
                    )
                }
            }
        }
    }
}
