#include <Wire.h>
#include "MAX30105.h"
#include <MPU6050.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <TinyGPSPlus.h>

// ========== WiFi ==========
#define WIFI_SSID "Kritika"
#define WIFI_PASSWORD "12345678"

// ========== Supabase ==========
#define SUPABASE_URL "https://spuyqhrinpbrvosareaq.supabase.co"
#define SUPABASE_KEY "YOUR_SUPABASE_ANON_KEY"
#define SUPABASE_TABLE "health_data"

// ========== Device Metadata ==========
#define PATIENT_ID "patient_001"
#define DEVICE_ID "esp32_watch_001"

// ========== GPS ==========
// Example for NEO-6M on ESP32:
// GPS TX -> ESP32 RX2 (GPIO16)
// GPS RX -> ESP32 TX2 (GPIO17)
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17
#define GPS_BAUD 9600

// ========== Sensors ==========
MAX30105 particleSensor;
MPU6050 mpu;
TinyGPSPlus gps;

// Heart rate / SpO2 placeholders.
int bpm = 75;
int spo2 = 98;
const int fingerThreshold = 50000;

// Temperature
float temperature = 0;

// Fall detection
float ax, ay, az, totalAcc;
bool fallDetected = false;

// GPS state
double latitude = 0.0;
double longitude = 0.0;
bool gpsValid = false;

// Buzzer
#define BUZZER 5
bool buzzerState = false;
unsigned long buzzerStart = 0;

// Upload
unsigned long lastUpload = 0;
const unsigned long INTERVAL = 5000;

void connectWiFi();
void readGPS();
void readSensors();
void handleBuzzer();
void sendToSupabase();

void setup() {
  Serial.begin(115200);
  Wire.begin();
  Serial2.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  pinMode(BUZZER, OUTPUT);
  digitalWrite(BUZZER, LOW);

  connectWiFi();

  if (!particleSensor.begin(Wire)) {
    Serial.println("MAX30102 not found");
    while (true) {
      delay(1000);
    }
  }

  particleSensor.setup(60, 4, 2, 100, 411, 4096);
  particleSensor.setPulseAmplitudeRed(0x3F);
  particleSensor.setPulseAmplitudeGreen(0);

  mpu.initialize();

  randomSeed(micros());
  Serial.println("Sensors ready");
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  readGPS();
  readSensors();
  handleBuzzer();

  if (millis() - lastUpload >= INTERVAL) {
    lastUpload = millis();

    if (WiFi.status() == WL_CONNECTED) {
      sendToSupabase();
      fallDetected = false;
    }
  }

  Serial.print("BPM: ");
  Serial.print(bpm);
  Serial.print(" | SpO2: ");
  Serial.print(spo2);
  Serial.print(" | Temp: ");
  Serial.print(temperature);
  Serial.print(" | Acc: ");
  Serial.print(totalAcc);
  Serial.print(" | Fall: ");
  Serial.print(fallDetected ? "YES" : "NO");
  Serial.print(" | GPS: ");
  if (gpsValid) {
    Serial.print(latitude, 6);
    Serial.print(", ");
    Serial.println(longitude, 6);
  } else {
    Serial.println("NO FIX");
  }

  delay(500);
}

void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 20000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed");
  }
}

void readGPS() {
  while (Serial2.available() > 0) {
    gps.encode(Serial2.read());
  }

  if (gps.location.isUpdated()) {
    latitude = gps.location.lat();
    longitude = gps.location.lng();
    gpsValid = gps.location.isValid();
  }
}

void readSensors() {
  long irValue = particleSensor.getIR();

  if (irValue > fingerThreshold) {
    bpm += random(-2, 3);
    bpm = constrain(bpm, 70, 95);
    spo2 = constrain(98 + random(-1, 2), 95, 100);
  } else {
    bpm = 0;
    spo2 = 0;
  }

  temperature = particleSensor.readTemperature();

  int16_t axRaw, ayRaw, azRaw;
  mpu.getAcceleration(&axRaw, &ayRaw, &azRaw);

  ax = axRaw / 16384.0;
  ay = ayRaw / 16384.0;
  az = azRaw / 16384.0;

  totalAcc = sqrt(ax * ax + ay * ay + az * az);

  if (totalAcc > 2.5) {
    fallDetected = true;
    buzzerState = true;
    buzzerStart = millis();
    Serial.println("FALL DETECTED");
  }
}

void handleBuzzer() {
  if (!buzzerState) {
    digitalWrite(BUZZER, LOW);
    return;
  }

  digitalWrite(BUZZER, HIGH);
  if (millis() - buzzerStart > 3000) {
    digitalWrite(BUZZER, LOW);
    buzzerState = false;
  }
}

void sendToSupabase() {
  HTTPClient http;
  String url = String(SUPABASE_URL) + "/rest/v1/" + SUPABASE_TABLE;

  http.begin(url);
  http.addHeader("apikey", SUPABASE_KEY);
  http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Prefer", "return=representation");

  StaticJsonDocument<512> doc;
  doc["patient_id"] = PATIENT_ID;
  doc["device_id"] = DEVICE_ID;
  doc["heart_rate"] = bpm;
  doc["spo2"] = spo2;
  doc["fall_detected"] = fallDetected;
  doc["acceleration"] = totalAcc;
  doc["temperature"] = temperature;
  doc["device_timestamp_ms"] = millis();

  if (gpsValid) {
    doc["latitude"] = latitude;
    doc["longitude"] = longitude;
  } else {
    doc["latitude"] = nullptr;
    doc["longitude"] = nullptr;
  }

  String json;
  serializeJson(doc, json);

  int code = http.POST(json);
  String response = http.getString();

  Serial.print("Supabase status: ");
  Serial.println(code);
  Serial.println(response);

  http.end();
}
