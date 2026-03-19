package com.askadam.coachfit.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// CoachFit brand colors — dark navy + teal accent
val NavyDark = Color(0xFF1A1A2E)
val NavyMedium = Color(0xFF232342)
val NavySurface = Color(0xFF2A2A4A)
val Teal = Color(0xFF4ECDC4)
val TealDark = Color(0xFF3BA99E)
val TealLight = Color(0xFF7EDDD6)
val White = Color(0xFFFFFFFF)
val WhiteAlpha70 = Color(0xB3FFFFFF)
val ErrorRed = Color(0xFFFF6B6B)
val SuccessGreen = Color(0xFF51CF66)
val WarningOrange = Color(0xFFFF922B)
val SleepPurple = Color(0xFFB197FC)
val StepGreen = Color(0xFF69DB7C)
val WeightBlue = Color(0xFF74C0FC)
val CalorieOrange = Color(0xFFFFA94D)

private val DarkColorScheme = darkColorScheme(
    primary = Teal,
    onPrimary = NavyDark,
    primaryContainer = TealDark,
    onPrimaryContainer = White,
    secondary = TealLight,
    onSecondary = NavyDark,
    background = NavyDark,
    onBackground = White,
    surface = NavyMedium,
    onSurface = White,
    surfaceVariant = NavySurface,
    onSurfaceVariant = WhiteAlpha70,
    error = ErrorRed,
    onError = White,
    outline = Color(0xFF4A4A6A),
    outlineVariant = Color(0xFF3A3A5A),
)

private val LightColorScheme = lightColorScheme(
    primary = TealDark,
    onPrimary = White,
    primaryContainer = TealLight,
    onPrimaryContainer = NavyDark,
    secondary = Teal,
    onSecondary = White,
    background = Color(0xFFF8F9FA),
    onBackground = NavyDark,
    surface = White,
    onSurface = NavyDark,
    surfaceVariant = Color(0xFFF1F3F5),
    onSurfaceVariant = Color(0xFF495057),
    error = ErrorRed,
    onError = White,
    outline = Color(0xFFCED4DA),
    outlineVariant = Color(0xFFDEE2E6),
)

@Composable
fun CoachFitTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
