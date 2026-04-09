package com.lifecare.phonecompanion.hardware

data class HardwareFallSignal(
  val patientId: String,
  val deviceId: String,
  val heartRate: Int? = null,
  val spo2: Int? = null,
  val accelerationG: Double? = null,
  val hardwareTimestampMs: Long = System.currentTimeMillis(),
)
