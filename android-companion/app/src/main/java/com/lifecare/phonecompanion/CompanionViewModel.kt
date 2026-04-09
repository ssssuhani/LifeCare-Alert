package com.lifecare.phonecompanion

import android.content.Context
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.lifecare.phonecompanion.data.FallEventSyncRepository
import com.lifecare.phonecompanion.data.PhoneLocationProvider
import com.lifecare.phonecompanion.data.SupabaseHealthDataApi
import com.lifecare.phonecompanion.hardware.HardwareFallSignal
import com.lifecare.phonecompanion.hardware.HardwareSignalRouter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class CompanionViewModel(
  private val appContext: Context,
) : ViewModel() {
  private val repository = FallEventSyncRepository(
    locationProvider = PhoneLocationProvider(appContext),
    api = SupabaseHealthDataApi(),
  )

  private val _uiState = MutableStateFlow(CompanionUiState())
  val uiState: StateFlow<CompanionUiState> = _uiState.asStateFlow()

  private val hardwareListener: (HardwareFallSignal) -> Unit = { signal ->
    onHardwareFallSignal(signal)
  }

  init {
    refreshLocationPermissionStatus()
    HardwareSignalRouter.register(hardwareListener)
  }

  fun onPatientIdChange(value: String) {
    _uiState.update { it.copy(patientId = value.trim(), lastError = null) }
  }

  fun onDeviceIdChange(value: String) {
    _uiState.update { it.copy(deviceId = value.trim(), lastError = null) }
  }

  fun onLocationPermissionResult(granted: Boolean) {
    _uiState.update {
      it.copy(
        permissionGranted = granted,
        lastError = if (granted) null else "Location permission denied on this phone.",
      )
    }

    if (granted) {
      refreshPreviewLocation()
    }
  }

  fun refreshLocationPermissionStatus() {
    val granted = hasLocationPermission()
    _uiState.update { it.copy(permissionGranted = granted) }
  }

  fun refreshPreviewLocation() {
    if (!hasLocationPermission()) {
      _uiState.update {
        it.copy(
          permissionGranted = false,
          lastError = "Grant location permission before previewing phone GPS.",
        )
      }
      return
    }

    viewModelScope.launch {
      runCatching { repository.previewCurrentLocation() }
        .onSuccess { location ->
          _uiState.update {
            it.copy(
              permissionGranted = true,
              lastPreviewLocation = location,
              lastError = null,
              statusTitle = "Phone GPS ready",
              statusMessage = "Current phone coordinates are ready for the next hardware fall signal.",
            )
          }
        }
        .onFailure { error ->
          _uiState.update {
            it.copy(
              lastError = error.message ?: "Could not get a GPS fix from this phone.",
            )
          }
        }
    }
  }

  fun dispatchManualHardwareFall() {
    val state = _uiState.value
    HardwareSignalRouter.dispatch(
      HardwareFallSignal(
        patientId = state.patientId.ifBlank { BuildConfig.DEFAULT_PATIENT_ID },
        deviceId = state.deviceId.ifBlank { BuildConfig.DEFAULT_DEVICE_ID },
        heartRate = 84,
        spo2 = 98,
        accelerationG = 2.63,
      )
    )
  }

  /**
   * Production integration point:
   * call this from BLE/Wi-Fi/USB hardware service whenever the connected band confirms a fall.
   */
  fun onHardwareFallDetected(
    deviceId: String,
    patientId: String = _uiState.value.patientId,
    heartRate: Int? = null,
    spo2: Int? = null,
    accelerationG: Double? = null,
    hardwareTimestampMs: Long = System.currentTimeMillis(),
  ) {
    HardwareSignalRouter.dispatch(
      HardwareFallSignal(
        patientId = patientId,
        deviceId = deviceId,
        heartRate = heartRate,
        spo2 = spo2,
        accelerationG = accelerationG,
        hardwareTimestampMs = hardwareTimestampMs,
      )
    )
  }

  private fun onHardwareFallSignal(signal: HardwareFallSignal) {
    viewModelScope.launch {
      _uiState.update {
        it.copy(
          isSyncing = true,
          lastSignalDeviceId = signal.deviceId,
          lastError = null,
          statusTitle = "Fall signal received",
          statusMessage = "Capturing phone GPS and inserting the full fall row into Supabase.",
        )
      }

      runCatching { repository.syncFallFromPhone(signal) }
        .onSuccess { synced ->
          _uiState.update {
            it.copy(
              isSyncing = false,
              patientId = synced.signal.patientId,
              deviceId = synced.signal.deviceId,
              permissionGranted = true,
              lastPreviewLocation = synced.location,
              lastSyncedLocation = synced.location,
              lastSyncedAtMs = synced.receipt.syncedAtMs,
              lastSignalDeviceId = synced.signal.deviceId,
              lastResponseBody = synced.receipt.responseBody,
              lastError = null,
              statusTitle = "Phone location synced",
              statusMessage =
                "Phone GPS plus hardware fall, heart rate, and SpO2 data were inserted into Supabase successfully.",
            )
          }
        }
        .onFailure { error ->
          _uiState.update {
            it.copy(
              isSyncing = false,
              lastError = error.message ?: "Phone companion could not sync the fall event.",
              statusTitle = "Sync failed",
              statusMessage =
                "The phone received a fall signal, but GPS or Supabase sync did not finish.",
            )
          }
        }
    }
  }

  private fun hasLocationPermission(): Boolean {
    val fine = ContextCompat.checkSelfPermission(
      appContext,
      android.Manifest.permission.ACCESS_FINE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    val coarse = ContextCompat.checkSelfPermission(
      appContext,
      android.Manifest.permission.ACCESS_COARSE_LOCATION,
    ) == PackageManager.PERMISSION_GRANTED

    return fine || coarse
  }

  override fun onCleared() {
    HardwareSignalRouter.unregister(hardwareListener)
    super.onCleared()
  }

  companion object {
    fun provideFactory(appContext: Context): ViewModelProvider.Factory =
      object : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
          return CompanionViewModel(appContext) as T
        }
      }
  }
}
