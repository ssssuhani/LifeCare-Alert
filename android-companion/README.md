# LifeCare Phone Companion

This Android app is the production-oriented companion for the LifeCare+ hardware project.

## What It Does

1. Phone stays connected to the hardware device.
2. Hardware sends `heart rate`, `SpO2`, and `fall detected`.
3. Android app receives that hardware signal.
4. App captures the phone's GPS location.
5. App inserts one complete fall row into Supabase.
6. Website reads that row and shows the map + alert.

In short:

`Hardware -> Android companion app -> Supabase -> Website dashboard`

## Why This App Exists

The browser-based `?mode=phone` flow is fine for demos, but not ideal for the real project:

- mobile browsers need secure `https://` origin for GPS
- the page must stay open
- background behavior is unreliable
- hardware-to-phone connection is easier to handle in a native app

This Android app solves that by moving the GPS + database write into the phone itself.

## Current App Scope

The scaffold already includes:

- Compose UI for patient/device linking
- phone GPS permission flow
- live GPS preview from the phone
- direct Supabase REST insert into `health_data`
- a manual hardware test button for lab verification
- a hardware bridge entry point for future BLE/Wi-Fi/USB service integration

Hardware is assumed to provide only:

- `heart rate`
- `SpO2`
- `fall detected`

## Hardware Integration Hook

Actual hardware transport can call this when a fall is detected:

```kotlin
HardwareSignalRouter.dispatch(
  HardwareFallSignal(
    patientId = "patient_001",
    deviceId = "esp32-fall-detector-01",
    heartRate = 84,
    spo2 = 98,
  )
)
```

That single dispatch will:

1. capture phone GPS
2. insert `heart_rate`, `spo2`, `fall_detected`, and phone GPS into Supabase
3. let the website pick it up automatically

## Open In Android Studio

1. Open Android Studio
2. Choose `Open`
3. Select [android-companion](/Users/samarthchauhan/Downloads/majorproject/android-companion)
4. Let Gradle sync complete
5. Run on an Android phone

## Current Config

The project is prefilled with:

- Supabase URL
- Supabase anon key
- `health_data` table
- default patient/device IDs

These values live in:

- [android-companion/gradle.properties](/Users/samarthchauhan/Downloads/majorproject/android-companion/gradle.properties)

## Testing Flow

1. Install the app on Android
2. Grant location permission
3. Tap `Refresh GPS Preview`
4. Tap `Simulate Connected Hardware Fall`
5. Check Supabase `health_data`
6. Open the website dashboard and confirm map + alert update

## Notes

- This repo does not include Android SDK or Gradle wrapper binaries locally.
- Open the project in Android Studio to sync and build it.
- Next real step is replacing the manual trigger with your actual hardware connection layer.
