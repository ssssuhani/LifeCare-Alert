package com.lifecare.phonecompanion.data

import com.lifecare.phonecompanion.hardware.HardwareFallSignal

data class SyncedFallEvent(
  val signal: HardwareFallSignal,
  val location: PhoneLocation,
  val receipt: SupabaseSyncReceipt,
)

class FallEventSyncRepository(
  private val locationProvider: PhoneLocationProvider,
  private val api: SupabaseHealthDataApi,
) {
  suspend fun previewCurrentLocation(): PhoneLocation {
    return locationProvider.getCurrentLocation()
  }

  suspend fun syncFallFromPhone(signal: HardwareFallSignal): SyncedFallEvent {
    val location = locationProvider.getCurrentLocation()
    val receipt = api.insertFallEvent(signal, location)
    return SyncedFallEvent(
      signal = signal,
      location = location,
      receipt = receipt,
    )
  }
}
