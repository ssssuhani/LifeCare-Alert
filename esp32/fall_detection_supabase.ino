#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <MPU6050.h>
#include <time.h>

// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase settings
const char* SUPABASE_URL = "https://spuyqhrinpbrvosareaq.supabase.co";
const char* SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwdXlxaHJpbnBicnZvc2FyZWFxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjE4MjMsImV4cCI6MjA4OTM5NzgyM30.e2hRsqqmtXVXHM3VkULQ85-8Q_HDfckB7rV_4bgrNOI";
const char* SUPABASE_FALL_EVENTS_ENDPOINT = "/rest/v1/fall_events";
const char* DEVICE_ID = "YOUR_DEVICE_UUID";

// Fall detection
const float FALL_THRESHOLD_G = 2.5;
const unsigned long FALL_COOLDOWN_MS = 8000;

MPU6050 mpu;
unsigned long lastFallSentAt = 0;

int getHeartRate() {
  // Replace this placeholder with your pulse sensor logic if available.
  return 82;
}

int getSpo2() {
  // Replace this placeholder with your SpO2 sensor logic if available.
  return 97;
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}

void syncClock() {
  Serial.println("Syncing time using NTP...");
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  time_t now = time(nullptr);
  int attempts = 0;

  while (now < 100000 && attempts < 20) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
    attempts++;
  }

  Serial.println();
  if (now >= 100000) {
    Serial.println("Time synced");
  } else {
    Serial.println("Time sync failed, using fallback timestamp");
  }
}

String getCurrentTimestamp() {
  time_t now = time(nullptr);
  struct tm timeInfo;

  if (now < 100000 || !gmtime_r(&now, &timeInfo)) {
    return "1970-01-01T00:00:00Z";
  }

  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeInfo);
  return String(buffer);
}

float readAccelerationInG() {
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);

  const float x = ax / 16384.0f;
  const float y = ay / 16384.0f;
  const float z = az / 16384.0f;

  return sqrt((x * x) + (y * y) + (z * z));
}

bool sendFallEvent(const String& timestamp, int heartRate, int spo2) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
  }

  HTTPClient http;
  const String url = String(SUPABASE_URL) + SUPABASE_FALL_EVENTS_ENDPOINT;

  Serial.print("Sending POST request to: ");
  Serial.println(url);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_ANON_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
  http.addHeader("Prefer", "return=representation");

  const String payload =
    String("{") +
    "\"device_id\":\"" + DEVICE_ID + "\"," +
    "\"event_type\":\"fall\"," +
    "\"heart_rate\":" + String(heartRate) + "," +
    "\"spo2\":" + String(spo2) + "," +
    "\"created_at\":\"" + timestamp + "\"" +
    "}";

  Serial.print("Payload: ");
  Serial.println(payload);

  const int statusCode = http.POST(payload);
  const String response = http.getString();

  Serial.print("HTTP status: ");
  Serial.println(statusCode);
  Serial.print("Response: ");
  Serial.println(response);

  http.end();

  return statusCode > 0 && statusCode < 300;
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("Starting ESP32 fall detector...");

  Wire.begin();
  mpu.initialize();

  if (!mpu.testConnection()) {
    Serial.println("MPU6050 connection failed");
    while (true) {
      delay(1000);
    }
  }

  Serial.println("MPU6050 connected");

  connectToWiFi();
  syncClock();
}

void loop() {
  const float acceleration = readAccelerationInG();

  Serial.print("Acceleration: ");
  Serial.print(acceleration, 2);
  Serial.println(" g");

  const bool cooldownActive = millis() - lastFallSentAt < FALL_COOLDOWN_MS;

  if (acceleration > FALL_THRESHOLD_G && !cooldownActive) {
    Serial.println("Fall threshold crossed");

    const String timestamp = getCurrentTimestamp();
    const int heartRate = getHeartRate();
    const int spo2 = getSpo2();

    Serial.print("Heart Rate: ");
    Serial.print(heartRate);
    Serial.println(" bpm");
    Serial.print("SpO2: ");
    Serial.print(spo2);
    Serial.println(" %");

    const bool sent = sendFallEvent(timestamp, heartRate, spo2);

    if (sent) {
      Serial.println("Fall event sent successfully");
      lastFallSentAt = millis();
    } else {
      Serial.println("Failed to send fall event");
    }
  }

  delay(300);
}
