package com.lifecare.phonecompanion.data

import android.annotation.SuppressLint
import android.content.Context
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class PhoneLocationProvider(
  context: Context,
) {
  private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

  @SuppressLint("MissingPermission")
  suspend fun getCurrentLocation(): PhoneLocation =
    suspendCancellableCoroutine { continuation ->
      val tokenSource = CancellationTokenSource()

      fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, tokenSource.token)
        .addOnSuccessListener { location ->
          if (location == null) {
            continuation.resumeWithException(
              IllegalStateException(
                "Phone GPS fix unavailable. Turn on device location and try again outdoors if needed.",
              )
            )
            return@addOnSuccessListener
          }

          continuation.resume(
            PhoneLocation(
              latitude = location.latitude,
              longitude = location.longitude,
              accuracyMeters = location.accuracy,
              capturedAtMs = System.currentTimeMillis(),
            )
          )
        }
        .addOnFailureListener { error ->
          continuation.resumeWithException(error)
        }

      continuation.invokeOnCancellation {
        tokenSource.cancel()
      }
    }
}
