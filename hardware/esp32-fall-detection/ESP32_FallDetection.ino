/*
  LifeCare+ ESP32 Fall Detection
  Sensors: MPU6050 + MAX30102

  Typical ESP32 <-> MPU6050 wiring:
  VCC -> 3V3
  GND -> GND
  SDA -> GPIO 21
  SCL -> GPIO 22

  Typical ESP32 <-> MAX30102 wiring:
  VIN/3V3 -> 3V3
  GND -> GND
  SDA -> GPIO 21
  SCL -> GPIO 22

  This sketch detects a likely fall using:
  1. Free fall or sharp impact
  2. Large posture change
  3. Short inactivity window

  On detection it prints an event payload to Serial and can also
  insert the fall event row into Supabase over Wi-Fi / HTTPS.
*/

#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <math.h>

Adafruit_MPU6050 mpu;
MAX30105 pulseSensor;

const char* DEVICE_ID = "esp32-fall-detector-01";
const char* PATIENT_ID = "patient_001";
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SUPABASE_URL = "https://pgcslptsxtqarencwses.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY3NscHRzeHRxYXJlbmN3c2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2Njc0MzAsImV4cCI6MjA5MTI0MzQzMH0.1gEVE0Kd6lxFky6xhhRYHK9zBnGcJiDPLuftR5NW0KI";
const char* SUPABASE_TABLE = "health_data";

// Sampling and smoothing
const uint16_t LOOP_DELAY_MS = 20;
const float SENSOR_EMA_ALPHA = 0.25f;
const float REFERENCE_TILT_ALPHA = 0.02f;

// Fall tuning thresholds
const float FREE_FALL_G = 0.55f;
const float IMPACT_G = 2.40f;
const float TILT_CHANGE_DEG = 45.0f;
const float STILL_ACCEL_BAND_G = 0.18f;
const float STILL_GYRO_DPS = 35.0f;

// Timing windows
const uint32_t FREE_FALL_TIMEOUT_MS = 700;
const uint32_t POSTURE_TIMEOUT_MS = 1800;
const uint32_t STILLNESS_CONFIRM_MS = 2500;
const uint32_t MAX_FALL_SEQUENCE_MS = 5500;
const uint32_t COOLDOWN_MS = 10000;
const uint32_t DEBUG_PRINT_MS = 300;

// MAX30102 pulse-oximeter tuning
const uint8_t MAX30102_BUFFER_LENGTH = 100;
const uint8_t MAX30102_RECALC_SAMPLES = 25;
const uint32_t MAX30102_MIN_IR_FOR_FINGER = 50000;
const uint32_t MAX30102_MIN_COMPUTE_INTERVAL_MS = 900;

enum DetectorState {
  STATE_IDLE,
  STATE_FREE_FALL,
  STATE_POST_IMPACT,
  STATE_COOLDOWN
};

struct SensorFrame {
  float ax;
  float ay;
  float az;
  float gx;
  float gy;
  float gz;
  int heartRateBpm;
  int spo2Percent;
  float accelMagnitudeG;
  float gyroMagnitudeDps;
  float tiltDeg;
  uint32_t sampleTimeMs;
};

DetectorState detectorState = STATE_IDLE;

float filteredAccelMagnitudeG = 1.0f;
float filteredGyroMagnitudeDps = 0.0f;
float filteredTiltDeg = 0.0f;
float referenceTiltDeg = 0.0f;
float postureBaselineDeg = 0.0f;

uint32_t freeFallStartedAtMs = 0;
uint32_t impactStartedAtMs = 0;
uint32_t stillnessStartedAtMs = 0;
uint32_t cooldownUntilMs = 0;
uint32_t lastDebugPrintMs = 0;

bool max30102Ready = false;
uint8_t max30102SampleCount = 0;
uint8_t max30102WriteIndex = 0;
uint8_t max30102SamplesSinceCompute = 0;
uint32_t max30102IrBuffer[MAX30102_BUFFER_LENGTH];
uint32_t max30102RedBuffer[MAX30102_BUFFER_LENGTH];
uint32_t max30102AlgoIrBuffer[MAX30102_BUFFER_LENGTH];
uint32_t max30102AlgoRedBuffer[MAX30102_BUFFER_LENGTH];
uint32_t latestMax30102Ir = 0;
uint32_t lastMax30102ComputeAtMs = 0;
int latestHeartRateBpm = -1;
int latestSpo2Percent = -1;

void invalidatePulseMetrics() {
  latestHeartRateBpm = -1;
  latestSpo2Percent = -1;
}

void setupMax30102() {
  if (!pulseSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102 not found. Heart rate and SpO2 will be sent as null.");
    return;
  }

  const uint8_t ledBrightness = 60;
  const uint8_t sampleAverage = 4;
  const uint8_t ledMode = 2;
  const uint16_t sampleRate = 100;
  const uint16_t pulseWidth = 411;
  const uint16_t adcRange = 4096;

  pulseSensor.setup(ledBrightness, sampleAverage, ledMode, sampleRate, pulseWidth, adcRange);
  pulseSensor.setPulseAmplitudeGreen(0);
  max30102Ready = true;

  Serial.println("MAX30102 ready. Keep a fingertip steady on the sensor for HR/SpO2.");
}

void copyPulseSamplesForAlgorithm() {
  const uint8_t startIndex =
    max30102SampleCount < MAX30102_BUFFER_LENGTH ? 0 : max30102WriteIndex;

  for (uint8_t i = 0; i < MAX30102_BUFFER_LENGTH; i += 1) {
    const uint8_t sourceIndex = (startIndex + i) % MAX30102_BUFFER_LENGTH;
    max30102AlgoIrBuffer[i] = max30102IrBuffer[sourceIndex];
    max30102AlgoRedBuffer[i] = max30102RedBuffer[sourceIndex];
  }
}

void computePulseMetrics() {
  if (!max30102Ready) return;
  if (max30102SampleCount < MAX30102_BUFFER_LENGTH) return;

  const uint32_t now = millis();
  const bool firstFullWindow = lastMax30102ComputeAtMs == 0;
  const bool enoughFreshSamples = max30102SamplesSinceCompute >= MAX30102_RECALC_SAMPLES;
  const bool enoughTimePassed = now - lastMax30102ComputeAtMs >= MAX30102_MIN_COMPUTE_INTERVAL_MS;

  if (!firstFullWindow && (!enoughFreshSamples || !enoughTimePassed)) {
    return;
  }

  copyPulseSamplesForAlgorithm();

  int32_t computedHeartRate = 0;
  int32_t computedSpo2 = 0;
  int8_t validHeartRate = 0;
  int8_t validSpo2 = 0;

  maxim_heart_rate_and_oxygen_saturation(
    max30102AlgoIrBuffer,
    MAX30102_BUFFER_LENGTH,
    max30102AlgoRedBuffer,
    &computedSpo2,
    &validSpo2,
    &computedHeartRate,
    &validHeartRate
  );

  lastMax30102ComputeAtMs = now;
  max30102SamplesSinceCompute = 0;

  if (latestMax30102Ir < MAX30102_MIN_IR_FOR_FINGER) {
    invalidatePulseMetrics();
    return;
  }

  latestHeartRateBpm =
    (validHeartRate && computedHeartRate > 0 && computedHeartRate <= 240)
      ? static_cast<int>(computedHeartRate)
      : -1;
  latestSpo2Percent =
    (validSpo2 && computedSpo2 > 0 && computedSpo2 <= 100)
      ? static_cast<int>(computedSpo2)
      : -1;
}

void updateMax30102() {
  if (!max30102Ready) return;

  pulseSensor.check();

  while (pulseSensor.available()) {
    latestMax30102Ir = pulseSensor.getIR();
    const uint32_t redSample = pulseSensor.getRed();

    if (max30102SampleCount < MAX30102_BUFFER_LENGTH) {
      max30102IrBuffer[max30102SampleCount] = latestMax30102Ir;
      max30102RedBuffer[max30102SampleCount] = redSample;
      max30102SampleCount += 1;
    } else {
      max30102IrBuffer[max30102WriteIndex] = latestMax30102Ir;
      max30102RedBuffer[max30102WriteIndex] = redSample;
      max30102WriteIndex = (max30102WriteIndex + 1) % MAX30102_BUFFER_LENGTH;
    }

    if (max30102SamplesSinceCompute < 255) {
      max30102SamplesSinceCompute += 1;
    }

    pulseSensor.nextSample();
  }

  if (latestMax30102Ir < MAX30102_MIN_IR_FOR_FINGER) {
    invalidatePulseMetrics();
  }

  computePulseMetrics();
}

int readHeartRateBpm() {
  return latestHeartRateBpm;
}

int readSpO2Percent() {
  return latestSpo2Percent;
}

bool containsPlaceholder(const char* value) {
  if (value == nullptr || strlen(value) == 0) return true;

  const String text = String(value);
  return text.indexOf("YOUR_") >= 0;
}

bool isWifiConfigured() {
  return !containsPlaceholder(WIFI_SSID) && !containsPlaceholder(WIFI_PASSWORD);
}

bool isSupabaseConfigured() {
  return !containsPlaceholder(SUPABASE_URL) && !containsPlaceholder(SUPABASE_ANON_KEY) &&
         !containsPlaceholder(SUPABASE_TABLE);
}

String buildSupabaseInsertUrl() {
  String baseUrl = String(SUPABASE_URL);
  baseUrl.trim();

  if (baseUrl.endsWith("/")) {
    baseUrl.remove(baseUrl.length() - 1);
  }

  return baseUrl + "/rest/v1/" + String(SUPABASE_TABLE);
}

String buildEventMessage(const SensorFrame& frame) {
  String message = "Impact + posture change + inactivity detected";
  message += " (accel ";
  message += String(frame.accelMagnitudeG, 2);
  message += "g, tilt ";
  message += String(frame.tiltDeg, 1);
  message += "deg)";
  return message;
}

String jsonEscape(String value) {
  value.replace("\\", "\\\\");
  value.replace("\"", "\\\"");
  value.replace("\n", "\\n");
  value.replace("\r", "\\r");
  return value;
}

String buildSupabaseInsertPayload(const SensorFrame& frame) {
  const String tableName = String(SUPABASE_TABLE);

  String payload = "{";
  payload += "\"patient_id\":\"" + jsonEscape(String(PATIENT_ID)) + "\",";
  payload += "\"device_id\":\"" + jsonEscape(String(DEVICE_ID)) + "\",";
  payload += "\"heart_rate\":";
  payload += frame.heartRateBpm >= 0 ? String(frame.heartRateBpm) : "null";
  payload += ",";
  payload += "\"spo2\":";
  payload += frame.spo2Percent >= 0 ? String(frame.spo2Percent) : "null";
  payload += ",";
  payload += "\"fall_detected\":true";

  if (tableName == "health_data") {
    payload += ",";
    payload += "\"acceleration\":";
    payload += String(frame.accelMagnitudeG, 3);
    payload += ",";
    payload += "\"device_timestamp_ms\":";
    payload += String(frame.sampleTimeMs);
  } else {
    const String eventMessage = jsonEscape(buildEventMessage(frame));
    payload += ",";
    payload += "\"event_type\":\"fall\",";
    payload += "\"event_message\":\"" + eventMessage + "\"";
  }

  payload += "}";

  return payload;
}

bool ensureWifiConnected() {
  if (!isWifiConfigured()) {
    Serial.println("Wi-Fi credentials are still placeholders. Supabase insert is disabled.");
    return false;
  }

  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.print("Connecting to Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts += 1;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected. IP: ");
    Serial.println(WiFi.localIP());
    return true;
  }

  Serial.println("Wi-Fi connection failed. Fall event will only be printed to Serial.");
  return false;
}

bool sendFallEventToSupabase(const SensorFrame& frame) {
  if (!isSupabaseConfigured()) {
    Serial.println("Supabase config is still placeholder text. Skipping remote insert.");
    return false;
  }

  if (!ensureWifiConnected()) {
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  const String endpoint = buildSupabaseInsertUrl();

  if (!http.begin(client, endpoint)) {
    Serial.println("Could not open HTTPS connection to Supabase.");
    return false;
  }

  const String payload = buildSupabaseInsertPayload(frame);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=representation");

  const int statusCode = http.POST(payload);
  const String responseBody = http.getString();
  http.end();

  Serial.print("Supabase POST status: ");
  Serial.println(statusCode);

  if (statusCode < 200 || statusCode >= 300) {
    Serial.println("Supabase insert failed.");
    if (responseBody.length() > 0) {
      Serial.println(responseBody);
    }
    return false;
  }

  Serial.println("Supabase fall event inserted.");
  if (responseBody.length() > 0) {
    Serial.println(responseBody);
  }
  return true;
}

float ema(float previous, float next, float alpha) {
  return previous + ((next - previous) * alpha);
}

float magnitude3(float x, float y, float z) {
  return sqrtf((x * x) + (y * y) + (z * z));
}

float computeTiltDeg(float ax, float ay, float az) {
  const float accelMagnitude = magnitude3(ax, ay, az);
  if (accelMagnitude <= 0.001f) return 0.0f;

  float normalizedZ = az / accelMagnitude;
  if (normalizedZ > 1.0f) normalizedZ = 1.0f;
  if (normalizedZ < -1.0f) normalizedZ = -1.0f;

  return acosf(normalizedZ) * 57.29578f;
}

const char* stateLabel(DetectorState state) {
  switch (state) {
    case STATE_IDLE:
      return "idle";
    case STATE_FREE_FALL:
      return "free_fall";
    case STATE_POST_IMPACT:
      return "post_impact";
    case STATE_COOLDOWN:
      return "cooldown";
    default:
      return "unknown";
  }
}

void resetDetector() {
  detectorState = STATE_IDLE;
  freeFallStartedAtMs = 0;
  impactStartedAtMs = 0;
  stillnessStartedAtMs = 0;
}

void printFallPayload(const SensorFrame& frame) {
  Serial.println();
  Serial.println("FALL_DETECTED");
  Serial.println("{");
  Serial.print("  \"device_id\": \"");
  Serial.print(DEVICE_ID);
  Serial.println("\",");
  Serial.print("  \"patient_id\": \"");
  Serial.print(PATIENT_ID);
  Serial.println("\",");
  Serial.print("  \"heart_rate\": ");
  if (frame.heartRateBpm >= 0) {
    Serial.print(frame.heartRateBpm);
  } else {
    Serial.print("null");
  }
  Serial.println(",");
  Serial.print("  \"spo2\": ");
  if (frame.spo2Percent >= 0) {
    Serial.print(frame.spo2Percent);
  } else {
    Serial.print("null");
  }
  Serial.println(",");
  Serial.println("  \"fall_detected\": true,");
  Serial.println("  \"event_type\": \"fall\",");
  Serial.println("  \"event_message\": \"Impact + posture change + inactivity detected\",");
  Serial.print("  \"event_time_ms\": ");
  Serial.print(frame.sampleTimeMs);
  Serial.println(",");
  Serial.print("  \"accel_g\": ");
  Serial.print(frame.accelMagnitudeG, 3);
  Serial.println(",");
  Serial.print("  \"gyro_dps\": ");
  Serial.print(frame.gyroMagnitudeDps, 2);
  Serial.println(",");
  Serial.print("  \"tilt_deg\": ");
  Serial.print(frame.tiltDeg, 2);
  Serial.println();
  Serial.println("}");
  Serial.println("// If Wi-Fi + Supabase credentials are configured below,");
  Serial.println("// the ESP32 will also insert this fall row into Supabase.");
  Serial.println("// The phone companion webpage should already have GPS permission enabled.");
  Serial.println("// When this fall row appears in Supabase, the phone page will write latitude + longitude.");
  Serial.println();
}

void triggerFall(const SensorFrame& frame) {
  printFallPayload(frame);
  sendFallEventToSupabase(frame);
  detectorState = STATE_COOLDOWN;
  cooldownUntilMs = millis() + COOLDOWN_MS;
  freeFallStartedAtMs = 0;
  impactStartedAtMs = 0;
  stillnessStartedAtMs = 0;
}

bool readSensorFrame(SensorFrame& frame) {
  sensors_event_t accel;
  sensors_event_t gyro;
  sensors_event_t temp;

  updateMax30102();
  mpu.getEvent(&accel, &gyro, &temp);

  frame.ax = accel.acceleration.x / 9.80665f;
  frame.ay = accel.acceleration.y / 9.80665f;
  frame.az = accel.acceleration.z / 9.80665f;
  frame.gx = gyro.gyro.x * 57.29578f;
  frame.gy = gyro.gyro.y * 57.29578f;
  frame.gz = gyro.gyro.z * 57.29578f;
  frame.heartRateBpm = readHeartRateBpm();
  frame.spo2Percent = readSpO2Percent();
  frame.accelMagnitudeG = magnitude3(frame.ax, frame.ay, frame.az);
  frame.gyroMagnitudeDps = magnitude3(frame.gx, frame.gy, frame.gz);
  frame.tiltDeg = computeTiltDeg(frame.ax, frame.ay, frame.az);
  frame.sampleTimeMs = millis();

  filteredAccelMagnitudeG = ema(filteredAccelMagnitudeG, frame.accelMagnitudeG, SENSOR_EMA_ALPHA);
  filteredGyroMagnitudeDps = ema(filteredGyroMagnitudeDps, frame.gyroMagnitudeDps, SENSOR_EMA_ALPHA);
  filteredTiltDeg = ema(filteredTiltDeg, frame.tiltDeg, SENSOR_EMA_ALPHA);

  if (detectorState == STATE_IDLE &&
      filteredGyroMagnitudeDps < 18.0f &&
      fabsf(filteredAccelMagnitudeG - 1.0f) < 0.12f) {
    referenceTiltDeg = ema(referenceTiltDeg, filteredTiltDeg, REFERENCE_TILT_ALPHA);
  }

  return true;
}

void printDebugFrame(const SensorFrame& frame) {
  if (millis() - lastDebugPrintMs < DEBUG_PRINT_MS) return;
  lastDebugPrintMs = millis();

  Serial.print("state=");
  Serial.print(stateLabel(detectorState));
  Serial.print(" accel_g=");
  Serial.print(filteredAccelMagnitudeG, 2);
  Serial.print(" gyro_dps=");
  Serial.print(filteredGyroMagnitudeDps, 1);
  Serial.print(" tilt=");
  Serial.print(filteredTiltDeg, 1);
  Serial.print(" ref_tilt=");
  Serial.print(referenceTiltDeg, 1);
  Serial.print(" hr=");
  if (frame.heartRateBpm >= 0) {
    Serial.print(frame.heartRateBpm);
  } else {
    Serial.print("--");
  }
  Serial.print(" spo2=");
  if (frame.spo2Percent >= 0) {
    Serial.print(frame.spo2Percent);
  } else {
    Serial.print("--");
  }
  Serial.println();
}

void updateDetector(const SensorFrame& frame) {
  const uint32_t now = frame.sampleTimeMs;
  const bool impactDetected = filteredAccelMagnitudeG >= IMPACT_G;
  const bool freeFallDetected = filteredAccelMagnitudeG <= FREE_FALL_G;
  const bool postureChanged = fabsf(filteredTiltDeg - postureBaselineDeg) >= TILT_CHANGE_DEG;
  const bool stillEnough =
    filteredGyroMagnitudeDps <= STILL_GYRO_DPS &&
    fabsf(filteredAccelMagnitudeG - 1.0f) <= STILL_ACCEL_BAND_G;

  switch (detectorState) {
    case STATE_IDLE:
      if (freeFallDetected) {
        detectorState = STATE_FREE_FALL;
        freeFallStartedAtMs = now;
        postureBaselineDeg = referenceTiltDeg;
      } else if (impactDetected) {
        detectorState = STATE_POST_IMPACT;
        impactStartedAtMs = now;
        postureBaselineDeg = referenceTiltDeg;
        stillnessStartedAtMs = 0;
      }
      break;

    case STATE_FREE_FALL:
      if (impactDetected) {
        detectorState = STATE_POST_IMPACT;
        impactStartedAtMs = now;
        stillnessStartedAtMs = 0;
      } else if (now - freeFallStartedAtMs > FREE_FALL_TIMEOUT_MS) {
        resetDetector();
      }
      break;

    case STATE_POST_IMPACT:
      if (!postureChanged && (now - impactStartedAtMs > POSTURE_TIMEOUT_MS)) {
        resetDetector();
        break;
      }

      if (postureChanged) {
        if (stillEnough) {
          if (stillnessStartedAtMs == 0) {
            stillnessStartedAtMs = now;
          }

          if (now - stillnessStartedAtMs >= STILLNESS_CONFIRM_MS) {
            triggerFall(frame);
          }
        } else {
          stillnessStartedAtMs = 0;
        }
      }

      if (detectorState == STATE_POST_IMPACT &&
          now - impactStartedAtMs > MAX_FALL_SEQUENCE_MS) {
        resetDetector();
      }
      break;

    case STATE_COOLDOWN:
      if (now >= cooldownUntilMs) {
        resetDetector();
      }
      break;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1500);

  Wire.begin();
  ensureWifiConnected();

  if (!mpu.begin()) {
    Serial.println("MPU6050 not found. Check wiring.");
    while (true) {
      delay(100);
    }
  }

  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
  setupMax30102();

  Serial.println("ESP32 fall detector ready.");
  Serial.println("Keep the device still for a few seconds to settle the reference posture.");
}

void loop() {
  SensorFrame frame;

  if (!readSensorFrame(frame)) {
    delay(LOOP_DELAY_MS);
    return;
  }

  updateDetector(frame);
  printDebugFrame(frame);

  delay(LOOP_DELAY_MS);
}
