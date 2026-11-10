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
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.auraaudio.app.R
import com.auraaudio.app.data.ThemeMode

/**
 * Identidade visual AURA: estética de áudio premium — neutros quentes,
 * grafite profundo e um acento champanhe discreto. Sem neon, sem "tech".
 */
object AuraColors {
    // Escuro — grafite quente
    val Night = Color(0xFF0D0D0F)
    val Charcoal = Color(0xFF17171B)
    val CharcoalHigh = Color(0xFF212126)
    val WarmWhite = Color(0xFFF3F1EC)
    val WarmGrey = Color(0xFFA3A099)
    val HairlineDark = Color(0xFF2B2B31)

    // Claro — porcelana quente
    val Porcelain = Color(0xFFFAF8F4)
    val Paper = Color(0xFFFFFFFF)
    val PaperTone = Color(0xFFF1EEE8)
    val Ink = Color(0xFF1C1B18)
    val InkSoft = Color(0xFF6E6A63)
    val HairlineLight = Color(0xFFE6E2DA)

    // Acento champanhe (escuro) / bronze (claro)
    val Champagne = Color(0xFFD3B077)
    val ChampagneDeep = Color(0xFFB08D55)
    val Bronze = Color(0xFF8E7244)

    // Semânticas sóbrias
    val Success = Color(0xFF7CA98A)
    val Warning = Color(0xFFCfA560)
    val Danger = Color(0xFFC47B74)
}

private val DarkScheme: ColorScheme = darkColorScheme(
    primary = AuraColors.Champagne,
    onPrimary = Color(0xFF17130C),
    secondary = AuraColors.ChampagneDeep,
    onSecondary = AuraColors.WarmWhite,
    background = AuraColors.Night,
    onBackground = AuraColors.WarmWhite,
    surface = AuraColors.Charcoal,
    onSurface = AuraColors.WarmWhite,
    surfaceVariant = AuraColors.CharcoalHigh,
    onSurfaceVariant = AuraColors.WarmGrey,
    outline = AuraColors.HairlineDark,
    error = AuraColors.Danger
)

private val LightScheme: ColorScheme = lightColorScheme(
    primary = AuraColors.Bronze,
    onPrimary = Color.White,
    secondary = AuraColors.ChampagneDeep,
    onSecondary = Color.White,
    background = AuraColors.Porcelain,
    onBackground = AuraColors.Ink,
    surface = AuraColors.Paper,
    onSurface = AuraColors.Ink,
    surfaceVariant = AuraColors.PaperTone,
    onSurfaceVariant = AuraColors.InkSoft,
    outline = AuraColors.HairlineLight,
    error = AuraColors.Danger
)

/** Manrope variável — a mesma família em todos os pesos. */
@OptIn(androidx.compose.ui.text.ExperimentalTextApi::class)
private fun manrope(weight: Int) = Font(
    R.font.manrope,
    weight = FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight))
)

val Manrope = FontFamily(
    manrope(300), manrope(400), manrope(500), manrope(600), manrope(700), manrope(800)
)

private val AuraTypography = Typography(
    displayLarge = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W300, fontSize = 52.sp, letterSpacing = 6.sp),
    displaySmall = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W700, fontSize = 34.sp, letterSpacing = (-0.5).sp),
    headlineMedium = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W700, fontSize = 27.sp, letterSpacing = (-0.4).sp),
    headlineSmall = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W700, fontSize = 22.sp, letterSpacing = (-0.2).sp),
    titleLarge = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W600, fontSize = 19.sp),
    titleMedium = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W600, fontSize = 16.sp, letterSpacing = 0.1.sp),
    titleSmall = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W600, fontSize = 14.sp, letterSpacing = 0.6.sp),
    bodyLarge = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W400, fontSize = 16.sp, lineHeight = 24.sp),
    bodyMedium = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W400, fontSize = 14.sp, lineHeight = 21.sp),
    bodySmall = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W400, fontSize = 12.sp, lineHeight = 18.sp),
    labelLarge = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W600, fontSize = 14.sp, letterSpacing = 0.3.sp),
    labelMedium = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W600, fontSize = 11.sp, letterSpacing = 2.2.sp),
    labelSmall = TextStyle(fontFamily = Manrope, fontWeight = FontWeight.W600, fontSize = 10.sp, letterSpacing = 1.6.sp)
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
