package com.auraaudio.app.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.auraaudio.app.data.ThemeMode

// ------- Paleta AURA: sofisticada, sem neon -------
object AuraColors {
    // Escuro
    val InkBlack = Color(0xFF0B0C0F)
    val Graphite = Color(0xFF14161C)
    val GraphiteHigh = Color(0xFF1C1F27)
    val Mist = Color(0xFFE8EAEE)
    val MistDim = Color(0xFF9AA0AC)
    val AccentBlue = Color(0xFF8AB4F8)
    val AccentBlueDeep = Color(0xFF4F76C5)
    // Claro
    val Porcelain = Color(0xFFF7F8FA)
    val CardLight = Color(0xFFFFFFFF)
    val InkText = Color(0xFF17191E)
    val InkTextDim = Color(0xFF5B616C)
    val AccentLight = Color(0xFF3B66B0)

    val Success = Color(0xFF5BB97E)
    val Warning = Color(0xFFE0A84E)
    val Danger = Color(0xFFD96A6A)
}

private val DarkScheme: ColorScheme = darkColorScheme(
    primary = AuraColors.AccentBlue,
    onPrimary = Color(0xFF0B1018),
    secondary = AuraColors.AccentBlueDeep,
    onSecondary = AuraColors.Mist,
    background = AuraColors.InkBlack,
    onBackground = AuraColors.Mist,
    surface = AuraColors.Graphite,
    onSurface = AuraColors.Mist,
    surfaceVariant = AuraColors.GraphiteHigh,
    onSurfaceVariant = AuraColors.MistDim,
    outline = Color(0xFF2A2E38),
    error = AuraColors.Danger
)

private val LightScheme: ColorScheme = lightColorScheme(
    primary = AuraColors.AccentLight,
    onPrimary = Color.White,
    secondary = AuraColors.AccentBlueDeep,
    onSecondary = Color.White,
    background = AuraColors.Porcelain,
    onBackground = AuraColors.InkText,
    surface = AuraColors.CardLight,
    onSurface = AuraColors.InkText,
    surfaceVariant = Color(0xFFEEF0F4),
    onSurfaceVariant = AuraColors.InkTextDim,
    outline = Color(0xFFDDE1E8),
    error = AuraColors.Danger
)

private val AuraTypography = Typography(
    displaySmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 34.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 26.sp, letterSpacing = (-0.3).sp),
    headlineSmall = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 22.sp),
    titleLarge = TextStyle(fontWeight = FontWeight.Medium, fontSize = 19.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 16.sp, letterSpacing = 0.1.sp),
    titleSmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 14.sp, letterSpacing = 0.8.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 23.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 17.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.Medium, fontSize = 14.sp, letterSpacing = 0.4.sp),
    labelMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, letterSpacing = 1.2.sp),
    labelSmall = TextStyle(fontWeight = FontWeight.Medium, fontSize = 10.sp, letterSpacing = 1.4.sp)
)

val LocalDarkTheme = staticCompositionLocalOf { true }

@Composable
fun AuraTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    androidx.compose.runtime.CompositionLocalProvider(LocalDarkTheme provides dark) {
        MaterialTheme(
            colorScheme = if (dark) DarkScheme else LightScheme,
            typography = AuraTypography,
            content = content
        )
    }
}
