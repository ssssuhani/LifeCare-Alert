# ESP32 Upload Checklist

Use this checklist before running the real hardware test.

## 1. Wiring

- `MPU6050 VCC -> 3V3`
- `MPU6050 GND -> GND`
- `MPU6050 SDA -> GPIO 21`
- `MPU6050 SCL -> GPIO 22`
- `MAX30102 VIN/3V3 -> 3V3`
- `MAX30102 GND -> GND`
- `MAX30102 SDA -> GPIO 21`
- `MAX30102 SCL -> GPIO 22`

Both sensors can share the same I2C bus on the ESP32.

## 2. Arduino IDE Setup

Install these libraries:

- `Adafruit MPU6050`
- `Adafruit Unified Sensor`
- `SparkFun MAX3010x Sensor Library`

Board setup:

- Board: `ESP32 Dev Module` or your exact ESP32 board
- Upload speed: default is fine
- Serial monitor baud: `115200`

## 3. Fill Required Values

Open [ESP32_FallDetection.ino](/Users/samarthchauhan/Downloads/majorproject/hardware/esp32-fall-detection/ESP32_FallDetection.ino) and update:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `DEVICE_ID` if your hardware needs a different ID
- `PATIENT_ID` if required

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_TABLE` are already set for the current project.

## 4. Upload

1. Connect ESP32 to laptop
2. Select the correct serial port
3. Upload the sketch
4. Open Serial Monitor at `115200`

Expected startup logs:

- `Wi-Fi connected. IP: ...`
- `MAX30102 ready. Keep a fingertip steady on the sensor for HR/SpO2.`
- `ESP32 fall detector ready.`

If MAX30102 is not detected, the sketch will still run fall detection, but `heart_rate` and `spo2` will be sent as `null`.

## 5. Phone Setup

1. Open the secure phone page: `https://<your-secure-url>/?mode=phone`
2. Make sure linked device ID matches the ESP32 `DEVICE_ID`
3. Tap `Enable Live Location`
4. Keep the page open on the phone

## 6. Dashboard Setup

1. Open the dashboard page on laptop
2. Keep alarm audio enabled once
3. Wait for the hardware fall event

## 7. Real Test Flow

1. Wear or hold the hardware in a realistic position
2. Place finger steadily on MAX30102
3. Trigger a real or safe simulated fall event
4. Confirm:
   - ESP32 inserts a fall row into Supabase
   - phone page detects the fall row
   - phone pushes GPS into the same row
   - dashboard shows fall alert, alarm, and map

## 8. Quick Failure Checks

- If `heart_rate` and `spo2` stay `null`, check MAX30102 wiring and finger placement
- If no DB row appears, check Wi-Fi credentials and Supabase table/policies
- If map does not update, make sure the phone page is open on `https://` and location permission is enabled
