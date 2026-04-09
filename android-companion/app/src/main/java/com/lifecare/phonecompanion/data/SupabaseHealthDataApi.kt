package com.lifecare.phonecompanion.data

import com.lifecare.phonecompanion.BuildConfig
import com.lifecare.phonecompanion.hardware.HardwareFallSignal
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

data class SupabaseSyncReceipt(
  val httpCode: Int,
  val responseBody: String,
  val syncedAtMs: Long,
)

class SupabaseHealthDataApi {
  suspend fun insertFallEvent(
    signal: HardwareFallSignal,
    location: PhoneLocation,
  ): SupabaseSyncReceipt = withContext(Dispatchers.IO) {
    val endpoint = URL(
      "${BuildConfig.SUPABASE_URL.trimEnd('/')}/rest/v1/${BuildConfig.SUPABASE_TABLE}"
    )
    val connection = (endpoint.openConnection() as HttpURLConnection).apply {
      requestMethod = "POST"
      doInput = true
      doOutput = true
      setRequestProperty("Content-Type", "application/json")
      setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
      setRequestProperty("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
      setRequestProperty("Prefer", "return=representation")
    }

    val body = JSONObject()
      .put("patient_id", signal.patientId)
      .put("device_id", signal.deviceId)
      .put("heart_rate", signal.heartRate ?: JSONObject.NULL)
      .put("spo2", signal.spo2 ?: JSONObject.NULL)
      .put("fall_detected", true)
      .put("acceleration", signal.accelerationG ?: JSONObject.NULL)
      .put("latitude", location.latitude)
      .put("longitude", location.longitude)
      .put("gps_accuracy", location.accuracyMeters ?: JSONObject.NULL)
      .put("location_timestamp", location.capturedAtMs)
      .put("device_timestamp_ms", signal.hardwareTimestampMs)
      .toString()

    connection.outputStream.use { output ->
      output.write(body.toByteArray())
    }

    val code = connection.responseCode
    val responseText = readResponse(connection)
    connection.disconnect()

    if (code !in 200..299) {
      throw IllegalStateException("Supabase sync failed ($code): $responseText")
    }

    SupabaseSyncReceipt(
      httpCode = code,
      responseBody = responseText,
      syncedAtMs = System.currentTimeMillis(),
    )
  }

  private fun readResponse(connection: HttpURLConnection): String {
    val stream = connection.errorStream ?: connection.inputStream ?: return ""
    return BufferedReader(InputStreamReader(stream)).use { reader ->
      buildString {
        var line: String? = reader.readLine()
        while (line != null) {
          append(line)
          line = reader.readLine()
        }
      }
    }
  }
}
