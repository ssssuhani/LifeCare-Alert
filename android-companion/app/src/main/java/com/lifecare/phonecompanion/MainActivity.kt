package com.lifecare.phonecompanion

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.lifecare.phonecompanion.ui.CompanionScreen
import com.lifecare.phonecompanion.ui.theme.LifeCarePhoneCompanionTheme

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    setContent {
      LifeCarePhoneCompanionTheme {
        val viewModel: CompanionViewModel = viewModel(
          factory = CompanionViewModel.provideFactory(applicationContext)
        )
        val uiState by viewModel.uiState.collectAsStateWithLifecycle()
        val permissionLauncher = rememberLauncherForActivityResult(
          contract = ActivityResultContracts.RequestPermission()
        ) { granted ->
          viewModel.onLocationPermissionResult(granted)
        }

        Surface {
          CompanionScreen(
            uiState = uiState,
            onPatientIdChange = viewModel::onPatientIdChange,
            onDeviceIdChange = viewModel::onDeviceIdChange,
            onGrantLocationPermission = {
              permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            },
            onRefreshGpsPreview = viewModel::refreshPreviewLocation,
            onSimulateHardwareFall = viewModel::dispatchManualHardwareFall
          )
        }
      }
    }
  }
}
