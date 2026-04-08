#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <MPU6050.h>
#include <MAX30105.h>
#include "heartRate.h"
#include <math.h>

// ========= WiFi =========
const char* WIFI_SSID = "sonu";
const char* WIFI_PASSWORD = "suhani@123";

// ========= Supabase =========
const char* SUPABASE_URL = "https://spuyqhrinpbrvosareaq.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwdXlxaHJpbnBicnZvc2FyZWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjE4MjMsImV4cCI6MjA4OTM5NzgyM30.e2hRsqqmtXVXHM3VkULQ85-8Q_HDfckB7rV_4bgrNOI";
const char* SUPABASE_FALL_EVENTS_ENDPOINT = "/rest/v1/fall_events";
const char* SUPABASE_HEALTH_ENDPOINT = "/rest/v1/health_data";

// `fall_events.device_id` expects UUID from public.devices.id
const char* DEVICE_ID = "34cde90c-15d1-4569-b4a9-091ee723fdc6";
const char* PATIENT_ID = "patient_001";

// ========= Mode =========
// true  -> random HR + SpO2 for testing
// false -> real MAX3010x beat detection
const bool USE_RANDOM_VITALS = true;

// ========= Detection/Upload config =========
const float FALL_THRESHOLD_G = 2.5f;
const unsigned long FALL_COOLDOWN_MS = 8000;
const unsigned long HEALTH_UPLOAD_INTERVAL_MS = 4000;
const long FINGER_THRESHOLD_IR = 25000;

MPU6050 mpu;
MAX30105 pulseSensor;

unsigned long lastFallSentAt = 0;
unsigned long lastHealthSentAt = 0;
unsigned long lastLogAt = 0;
long lastBeatAt = 0;
unsigned long lastRandomUpdateMs = 0;

const byte RATE_SIZE = 8;
byte rates[RATE_SIZE] = {0};
byte rateSpot = 0;
int beatAvg = 0;
int instantBpm = 0;
bool fingerPresent = false;
bool pulseInitialized = false;
long latestIr = 0;

int randomHr = 82;
int randomSpo2 = 97;

void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("WiFi connection failed");
  }
}

float readAccelerationInG() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);

  const float x = ax / 16384.0f;
  const float y = ay / 16384.0f;
  const float z = az / 16384.0f;

  return sqrt((x * x) + (y * y) + (z * z));
}

bool initPulseSensor() {
  if (!pulseSensor.begin(Wire, I2C_SPEED_FAST)) {
    Serial.println("MAX30102/MAX30105 not found");
    return false;
  }

  pulseSensor.setup(60, 4, 2, 100, 411, 4096);
  pulseSensor.setPulseAmplitudeRed(0x3F);
  pulseSensor.setPulseAmplitudeGreen(0);
  Serial.println("Pulse sensor initialized");
  return true;
}

void updatePulseReadings() {
  if (USE_RANDOM_VITALS) {
    if (millis() - lastRandomUpdateMs >= 1000) {
      lastRandomUpdateMs = millis();
      randomHr = constrain(randomHr + random(-3, 4), 68, 112);
      randomSpo2 = constrain(randomSpo2 + random(-1, 2), 94, 100);
      beatAvg = randomHr;
      instantBpm = randomHr;
      fingerPresent = true;
      latestIr = 60000 + random(-2500, 2501);
    }
    return;
  }

  if (!pulseInitialized) return;

  const long ir = pulseSensor.getIR();
  latestIr = ir;
  fingerPresent = ir > FINGER_THRESHOLD_IR;

  if (!fingerPresent) {
    instantBpm = 0;
    return;
  }

  if (checkForBeat(ir)) {
    const unsigned long nowMs = millis();
    const long delta = nowMs - lastBeatAt;
    lastBeatAt = nowMs;

    if (delta > 0) {
      const float bpmFloat = 60.0f / (delta / 1000.0f);
      if (bpmFloat > 30.0f && bpmFloat < 220.0f) {
        instantBpm = (int)round(bpmFloat);

        rates[rateSpot] = (byte)instantBpm;
        rateSpot = (rateSpot + 1) % RATE_SIZE;

        int sum = 0;
        int count = 0;
        for (byte i = 0; i < RATE_SIZE; i++) {
          if (rates[i] > 0) {
            sum += rates[i];
            count++;
          }
        }

        if (count > 0) {
          beatAvg = sum / count;
          Serial.print("Beat detected, BPM(avg): ");
          Serial.println(beatAvg);
        }
      }
    }
  }
}

int getHeartRate() {
  if (USE_RANDOM_VITALS) return randomHr;
  if (!fingerPresent) return 0;
  if (beatAvg > 0) return beatAvg;
  return instantBpm;
}

int getSpo2() {
  if (USE_RANDOM_VITALS) return randomSpo2;
  // Real SpO2 algorithm not enabled in this sketch.
  return -1;
}

int postJson(const char* endpoint, const String& payload, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }
  if (WiFi.status() != WL_CONNECTED) {
    responseOut = "WiFi not connected";
    return -1;
  }

  HTTPClient http;
  const String url = String(SUPABASE_URL) + endpoint;

  http.setReuse(false);
  http.setConnectTimeout(10000);
  http.setTimeout(12000);
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=minimal");
  http.addHeader("Connection", "close");

  const int statusCode = http.POST(payload);
  if (statusCode > 0) {
    responseOut = http.getString();
  } else {
    responseOut = HTTPClient::errorToString(statusCode);
  }
  http.end();
  return statusCode;
}

bool sendHealthReading(int heartRate, int spo2, float acceleration, bool fallDetected) {
  const String heartRateJson = heartRate > 0 ? String(heartRate) : "null";
  const String spo2Json = spo2 > 0 ? String(spo2) : "null";

  const String payload =
    String("{") +
    "\"patient_id\":\"" + PATIENT_ID + "\"," +
    "\"device_id\":\"" + DEVICE_ID + "\"," +
    "\"heart_rate\":" + heartRateJson + "," +
    "\"spo2\":" + spo2Json + "," +
    "\"acceleration\":" + String(acceleration, 3) + "," +
    "\"fall_detected\":" + String(fallDetected ? "true" : "false") + "," +
    "\"device_timestamp_ms\":" + String(millis()) +
    "}";

  Serial.print("Health payload: ");
  Serial.println(payload);

  String response;
  const int code = postJson(SUPABASE_HEALTH_ENDPOINT, payload, response);
  if (code > 0 && code < 300) {
    return true;
  }

  Serial.print("Health upload failed. code=");
  Serial.print(code);
  Serial.print(" response=");
  Serial.println(response);
  return false;
}

bool sendFallEvent(int heartRate, int spo2) {
  const String heartRateJson = heartRate > 0 ? String(heartRate) : "null";
  const String spo2Json = spo2 > 0 ? String(spo2) : "null";

  const String payload =
    String("{") +
    "\"device_id\":\"" + String(DEVICE_ID) + "\"," +
    "\"event_type\":\"fall\"," +
    "\"heart_rate\":" + heartRateJson + "," +
    "\"spo2\":" + spo2Json +
    "}";

  Serial.print("Fall payload: ");
  Serial.println(payload);

  String response;
  const int code = postJson(SUPABASE_FALL_EVENTS_ENDPOINT, payload, response);
  if (code > 0 && code < 300) {
    return true;
  }

  Serial.print("Fall event upload failed. code=");
  Serial.print(code);
  Serial.print(" response=");
  Serial.println(response);
  return false;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("Starting ESP32 health + fall detector...");

  Wire.begin();
  mpu.initialize();

  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed");
    while (true) {
      delay(1000);
    }
  }
  Serial.println("MPU6050 connected");

  randomSeed(micros());
  if (USE_RANDOM_VITALS) {
    pulseInitialized = true;
    fingerPresent = true;
    latestIr = 60000;
    Serial.println("TEST MODE: Random HR/SpO2 enabled");
  } else {
    pulseInitialized = initPulseSensor();
  }

  connectToWiFi();
}

void loop() {
  updatePulseReadings();
  const float acceleration = readAccelerationInG();

  const int heartRate = getHeartRate();
  const int spo2 = getSpo2();
  const unsigned long nowMs = millis();

  const bool cooldownActive = nowMs - lastFallSentAt < FALL_COOLDOWN_MS;
  if (acceleration > FALL_THRESHOLD_G && !cooldownActive) {
    const bool fallSent = sendFallEvent(heartRate, spo2);
    const bool healthSent = sendHealthReading(heartRate, spo2, acceleration, true);

    if (fallSent) {
      lastFallSentAt = nowMs;
      Serial.println("Fall event sent successfully");
    } else {
      Serial.println("Failed to send fall event");
    }

    if (healthSent) {
      Serial.println("Fall snapshot pushed to health_data");
    }
  }

  if (nowMs - lastHealthSentAt >= HEALTH_UPLOAD_INTERVAL_MS) {
    if (sendHealthReading(heartRate, spo2, acceleration, false)) {
      lastHealthSentAt = nowMs;
    }
  }

  if (nowMs - lastLogAt >= 1000) {
    lastLogAt = nowMs;
    Serial.print("HeartRate=");
    Serial.print(heartRate > 0 ? String(heartRate) : "NA");
    Serial.print(" bpm | SpO2=");
    Serial.print(spo2 > 0 ? String(spo2) : "NA");
    Serial.print(" % | Acc=");
    Serial.print(acceleration, 2);
    Serial.print(" g | Finger=");
    Serial.print(fingerPresent ? "YES" : "NO");
    Serial.print(" | IR=");
    Serial.print(latestIr);
    Serial.print(" | WiFi=");
    Serial.print(WiFi.status() == WL_CONNECTED ? "OK" : "DOWN");
    Serial.print(" | Mode=");
    Serial.println(USE_RANDOM_VITALS ? "RANDOM" : "REAL");
  }

  delay(25);
}
