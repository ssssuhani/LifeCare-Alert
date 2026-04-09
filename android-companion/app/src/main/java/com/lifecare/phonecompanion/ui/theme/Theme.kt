package com.lifecare.phonecompanion.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val AppColors = lightColorScheme(
  primary = Sky,
  secondary = Mint,
  tertiary = Coral,
  background = Mist,
  surface = Color.White,
  onPrimary = Color.White,
  onBackground = Ink,
  onSurface = Ink,
)

@Composable
fun LifeCarePhoneCompanionTheme(
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = AppColors,
    content = content,
  )
}
