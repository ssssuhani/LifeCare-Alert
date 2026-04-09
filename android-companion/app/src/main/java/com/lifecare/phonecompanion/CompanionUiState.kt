package com.lifecare.phonecompanion

import com.lifecare.phonecompanion.data.PhoneLocation

data class CompanionUiState(
  val patientId: String = BuildConfig.DEFAULT_PATIENT_ID,
  val deviceId: String = BuildConfig.DEFAULT_DEVICE_ID,
  val permissionGranted: Boolean = false,
  val isSyncing: Boolean = false,
  val statusTitle: String = "Phone companion ready",
  val statusMessage: String =
    "Connected hardware can trigger this phone to capture GPS and write a full fall row into Supabase.",
  val lastPreviewLocation: PhoneLocation? = null,
  val lastSyncedLocation: PhoneLocation? = null,
  val lastSyncedAtMs: Long? = null,
  val lastSignalDeviceId: String? = null,
  val lastResponseBody: String? = null,
  val lastError: String? = null,
)
