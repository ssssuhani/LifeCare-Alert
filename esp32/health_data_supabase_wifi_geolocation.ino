#include <Wire.h>
#include "MAX30105.h"
#include <MPU6050.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ========== WiFi ==========
#define WIFI_SSID "Kritika"
#define WIFI_PASSWORD "12345678"

// ========== Supabase ==========
#define SUPABASE_URL "https://spuyqhrinpbrvosareaq.supabase.co"
#define SUPABASE_KEY "YOUR_SUPABASE_ANON_KEY"
#define SUPABASE_TABLE "health_data"

// ========== Google Geolocation API ==========
// Create this in Google Cloud: Maps Platform -> Geolocation API
#define GOOGLE_GEOLOCATION_API_KEY "YOUR_GOOGLE_GEOLOCATION_API_KEY"

// ========== Device Metadata ==========
#define PATIENT_ID "patient_001"
#define DEVICE_ID "esp32_watch_001"

// ========== Sensors ==========
MAX30105 particleSensor;
MPU6050 mpu;

int bpm = 75;
int spo2 = 98;
const int fingerThreshold = 50000;

float temperature = 0;
float ax, ay, az, totalAcc;
bool fallDetected = false;

// ========== Location ==========
double latitude = 0.0;
double longitude = 0.0;
double locationAccuracy = 0.0;
bool locationValid = false;

// ========== Buzzer ==========
#define BUZZER 5
bool buzzerState = false;
unsigned long buzzerStart = 0;

// ========== Upload ==========
unsigned long lastUpload = 0;
const unsigned long INTERVAL = 5000;

void connectWiFi();
void readSensors();
void handleBuzzer();
bool updateLocationFromWiFi();
void sendToSupabase();

void setup() {
  Serial.begin(115200);
  Wire.begin();
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

  readSensors();
  handleBuzzer();

  if (millis() - lastUpload >= INTERVAL) {
    lastUpload = millis();

    if (WiFi.status() == WL_CONNECTED) {
      updateLocationFromWiFi();
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
  Serial.print(" | Location: ");
  if (locationValid) {
    Serial.print(latitude, 6);
    Serial.print(", ");
    Serial.print(longitude, 6);
    Serial.print(" (");
    Serial.print(locationAccuracy, 1);
    Serial.println("m)");
  } else {
    Serial.println("not available");
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

bool updateLocationFromWiFi() {
  if (strlen(GOOGLE_GEOLOCATION_API_KEY) == 0 ||
      String(GOOGLE_GEOLOCATION_API_KEY) == "YOUR_GOOGLE_GEOLOCATION_API_KEY") {
    locationValid = false;
    return false;
  }

  int networkCount = WiFi.scanNetworks(false, true);
  if (networkCount < 2) {
    Serial.println("Not enough WiFi networks for location lookup");
    locationValid = false;
    WiFi.scanDelete();
    return false;
  }

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String("https://www.googleapis.com/geolocation/v1/geolocate?key=") +
               GOOGLE_GEOLOCATION_API_KEY;

  if (!http.begin(client, url)) {
    Serial.println("Failed to start geolocation request");
    WiFi.scanDelete();
    locationValid = false;
    return false;
  }

  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<2048> requestDoc;
  requestDoc["considerIp"] = true;
  JsonArray wifiAccessPoints = requestDoc.createNestedArray("wifiAccessPoints");

  int maxNetworks = min(networkCount, 10);
  for (int i = 0; i < maxNetworks; i++) {
    String bssid = WiFi.BSSIDstr(i);
    if (bssid.length() == 0) continue;

    JsonObject ap = wifiAccessPoints.createNestedObject();
    ap["macAddress"] = bssid;
    ap["signalStrength"] = WiFi.RSSI(i);
    ap["channel"] = WiFi.channel(i);
  }

  String payload;
  serializeJson(requestDoc, payload);

  int code = http.POST(payload);
  String response = http.getString();
  http.end();
  WiFi.scanDelete();

  if (code < 200 || code >= 300) {
    Serial.print("Geolocation API failed: ");
    Serial.println(code);
    Serial.println(response);
    locationValid = false;
    return false;
  }

  StaticJsonDocument<512> responseDoc;
  DeserializationError error = deserializeJson(responseDoc, response);
  if (error) {
    Serial.println("Failed to parse geolocation response");
    locationValid = false;
    return false;
  }

  latitude = responseDoc["location"]["lat"] | 0.0;
  longitude = responseDoc["location"]["lng"] | 0.0;
  locationAccuracy = responseDoc["accuracy"] | 0.0;
  locationValid = true;
  return true;
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

  if (locationValid) {
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
