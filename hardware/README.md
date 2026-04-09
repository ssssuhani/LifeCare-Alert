# Hardware Fall Detection

This folder contains a reference fall-detection implementation for the hardware side of LifeCare+.

## Target Flow

The intended production flow is:

1. Hardware measures `heart rate`, `SpO2`, and detects a likely fall.
2. ESP32 inserts those values plus `fall_detected` into Supabase.
3. A phone already has the website open in `/?mode=phone` with location permission enabled.
4. When the fall row appears, the phone page writes its current GPS into that same row.
5. The dashboard shows the alert, sounds the alarm, and renders the map.

In short:

`Hardware (HR + SpO2 + fall) -> Supabase -> phone website adds GPS -> Dashboard shows event`

## Files

- [ESP32_FallDetection.ino](/Users/samarthchauhan/Downloads/majorproject/hardware/esp32-fall-detection/ESP32_FallDetection.ino)

## Sensor Setup

This reference sketch is written for:

- `MPU6050` for fall detection
- `MAX30102` for heart rate and SpO2

Typical ESP32 wiring:

- `MPU6050 VCC -> 3V3`
- `MPU6050 GND -> GND`
- `MPU6050 SDA -> GPIO 21`
- `MPU6050 SCL -> GPIO 22`
- `MAX30102 VIN/3V3 -> 3V3`
- `MAX30102 GND -> GND`
- `MAX30102 SDA -> GPIO 21`
- `MAX30102 SCL -> GPIO 22`

Arduino libraries needed:

- `Adafruit MPU6050`
- `Adafruit Unified Sensor`
- `SparkFun MAX3010x Sensor Library`

ESP32 built-in libraries used by the sketch:

- `WiFi.h`
- `WiFiClientSecure.h`
- `HTTPClient.h`

Serial monitor:

- baud rate: `115200`

Notes for MAX30102:

- Keep a fingertip steady on the sensor for a few seconds before trusting the numbers.
- If no finger is detected, the sketch will send `null` for `heart_rate` and `spo2`.
- `spo2_algorithm.h` comes from the SparkFun `MAX3010x` library/examples.

## Detection Logic

The reference sketch uses a three-stage rule:

1. `Free fall or impact`
2. `Posture/orientation change`
3. `Inactivity for a few seconds`

This avoids treating every shake or jump as a fall.

Current default thresholds in the sketch:

- `FREE_FALL_G = 0.55`
- `IMPACT_G = 2.40`
- `TILT_CHANGE_DEG = 45`
- `STILLNESS_CONFIRM_MS = 2500`

These are starting values only. Real testing on body placement is required.

## Event Trigger Path

Simple project flow:

1. Hardware confirms a fall
2. ESP32 sends `heart rate`, `SpO2`, and `fall_detected` into Supabase
3. Phone website in `/?mode=phone` sees the new fall row
4. Phone website captures current GPS and updates the same row
5. Dashboard map updates automatically

## ESP32 Supabase Config

Update these constants in [ESP32_FallDetection.ino](/Users/samarthchauhan/Downloads/majorproject/hardware/esp32-fall-detection/ESP32_FallDetection.ino):

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_TABLE`

The sketch sends:

`POST https://<project-ref>.supabase.co/rest/v1/health_data`

with headers:

- `apikey: <anon-key>`
- `Authorization: Bearer <anon-key>`
- `Content-Type: application/json`
- `Prefer: return=representation`

If Wi-Fi or Supabase values are still placeholders, the sketch will only print the fall payload to Serial.

The sketch auto-adjusts its insert payload based on `SUPABASE_TABLE`:

- `health_data`: sends `patient_id`, `device_id`, `heart_rate`, `spo2`, `fall_detected`, `acceleration`, `device_timestamp_ms`
- `health_readings`: sends `patient_id`, `device_id`, `fall_detected`, `event_type`, `event_message`

If your live project uses `health_data`, run [supabase/health_data.sql](/Users/samarthchauhan/Downloads/majorproject/supabase/health_data.sql) before testing the website phone-mode flow.

## Event Payload

If you use the direct ESP32 fallback, the hardware row can look like this:

```json
{
  "device_id": "esp32-fall-detector-01",
  "patient_id": "patient_001",
  "heart_rate": 84,
  "spo2": 98,
  "fall_detected": true,
  "acceleration": 2.63,
  "device_timestamp_ms": 159131
}
```

Then the phone website updates that same row with GPS:

```json
{
  "latitude": 30.273230,
  "longitude": 77.992584,
  "gps_accuracy": 12,
  "location_timestamp": 1775672305147
}
```

## Phone Website Mode

Open the phone page on the mobile browser:

- `/?mode=phone`

Requirements:

- the page should already be open on the phone
- location permission should already be enabled
- mobile geolocation needs a secure `https://` URL

## Notes

- This is a reference algorithm, not a medical-certified fall detector.
- Thresholds will need tuning on real hardware.
- If you use a different IMU than `MPU6050`, keep the same state machine and just replace the motion sensor read code.
- The MAX30102 logic is based on SparkFun's `MAX3010x` SPO2 example:
  [https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/examples/Example8_SPO2/Example8_SPO2.ino](https://github.com/sparkfun/SparkFun_MAX3010x_Sensor_Library/blob/master/examples/Example8_SPO2/Example8_SPO2.ino)
