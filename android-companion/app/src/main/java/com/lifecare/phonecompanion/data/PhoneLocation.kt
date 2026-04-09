package com.lifecare.phonecompanion.data

data class PhoneLocation(
  val latitude: Double,
  val longitude: Double,
  val accuracyMeters: Float?,
  val capturedAtMs: Long,
)
