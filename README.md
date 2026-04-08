# Fall Detection System with ESP32, Phone Browser, and Supabase

This project includes:

- ESP32 Arduino code for MPU6050 fall detection
- Supabase SQL schema for users, devices, fall events, and locations
- A plain JavaScript phone web app that listens for new fall events
- A plain JavaScript monitoring dashboard
- A React dashboard in the main Vite app

## Files

- ESP32 sketch: [esp32/fall_detection_supabase.ino](/Users/suhanisharma/majorproject/esp32/fall_detection_supabase.ino)
- Supabase SQL: [supabase/fall_data.sql](/Users/suhanisharma/majorproject/supabase/fall_data.sql)
- Phone listener page: [public/phone-listener.html](/Users/suhanisharma/majorproject/public/phone-listener.html)
- Plain dashboard page: [public/dashboard.html](/Users/suhanisharma/majorproject/public/dashboard.html)
- React dashboard: [src/App.jsx](/Users/suhanisharma/majorproject/src/App.jsx)
- React data hook: [src/hooks/useFallData.js](/Users/suhanisharma/majorproject/src/hooks/useFallData.js)

## SQL Queries

Run [supabase/fall_data.sql](/Users/suhanisharma/majorproject/supabase/fall_data.sql) in the Supabase SQL Editor.

```sql
create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  device_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.fall_events (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null default 'fall',
  heart_rate integer,
  spo2 integer,
  created_at timestamptz not null default now()
);

create table if not exists public.locations (
  id bigint generated always as identity primary key,
  event_id bigint not null references public.fall_events(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  created_at timestamptz not null default now()
);
```

## Supabase Dashboard Setup

1. Create a new Supabase project.
2. Open `SQL Editor`.
3. Run [supabase/fall_data.sql](/Users/suhanisharma/majorproject/supabase/fall_data.sql).
4. Open `Database -> Tables` and confirm `users`, `devices`, `fall_events`, and `locations` were created.
5. Open `Project Settings -> API` and copy:
   - Project URL
   - anon public key
6. Open `Database -> Replication`.
7. Confirm `fall_events` and `locations` are included in realtime. The SQL file also adds them to `supabase_realtime`.
8. In `Table Editor`, insert one user and one device if you do not want to use the sample rows.
9. Copy the `devices.id` UUID. This is the `DEVICE_ID` used by the ESP32 sketch and phone listener filter.

## Realtime Setup

Supabase realtime is enabled by:

- adding `fall_events` to `supabase_realtime`
- adding `locations` to `supabase_realtime`
- subscribing from the browser with `postgres_changes`

The SQL file already performs the publication step. In the Supabase dashboard, you only need to verify the tables are visible under replication.

## ESP32 Flow

The ESP32 sketch in [esp32/fall_detection_supabase.ino](/Users/suhanisharma/majorproject/esp32/fall_detection_supabase.ino) does this:

1. Connects to WiFi using `WiFi.h`
2. Reads acceleration from MPU6050 over `Wire.h`
3. Detects a fall when total acceleration is greater than `2.5g`
4. Builds JSON with:

```json
{
  "event": "fall",
  "timestamp": "current time"
}
```

5. Sends an HTTP POST using `HTTPClient.h`

For the database insert, the current sketch posts to `fall_events` with:

- `device_id`
- `event_type`
- `created_at`

If you also have heart rate and SpO2 sensors, extend the payload by adding:

```json
{
  "device_id": "device uuid",
  "event_type": "fall",
  "heart_rate": 78,
  "spo2": 97,
  "created_at": "2026-04-07T10:30:00Z"
}
```

Then Supabase stores that row in `fall_events`.

## Phone Browser Flow

The phone page in [public/phone-listener.html](/Users/suhanisharma/majorproject/public/phone-listener.html) does this:

1. Connects to Supabase
2. Listens for new `INSERT` events in `fall_events`
3. When a new fall event arrives:
   - reads current GPS coordinates with `navigator.geolocation`
   - inserts `event_id`, `latitude`, and `longitude` into `locations`
   - shows `Fall Detected`
   - plays an alarm sound
4. If location permission is blocked, it shows the permission error clearly

This is how the phone automatically syncs location after the ESP32 inserts a new fall event.

## Dashboard Flow

The monitoring dashboard in [public/dashboard.html](/Users/suhanisharma/majorproject/public/dashboard.html) and the React app in [src/App.jsx](/Users/suhanisharma/majorproject/src/App.jsx) do this:

1. Load the latest row from `fall_events`
2. Load the newest matching row from `locations`
3. Show:
   - alert message
   - latitude and longitude
   - Google Maps embed with marker
4. Subscribe to realtime changes on both `fall_events` and `locations`
5. Refresh automatically when a new location arrives

## Data Flow Diagram

```text
MPU6050 + ESP32
  -> detects acceleration > 2.5g
  -> inserts row into fall_events
  -> Supabase realtime broadcasts new event
  -> phone browser receives event automatically
  -> phone gets live location
  -> phone inserts row into locations
  -> dashboard receives location update automatically
  -> map and alert refresh on screen
```

## Order of Execution

1. Run the SQL schema in Supabase.
2. Create or verify one user row.
3. Create or verify one device row linked to that user.
4. Put the device UUID into the ESP32 code.
5. Put the Supabase URL and anon key into:
   - [esp32/fall_detection_supabase.ino](/Users/suhanisharma/majorproject/esp32/fall_detection_supabase.ino)
   - [public/phone-listener.html](/Users/suhanisharma/majorproject/public/phone-listener.html)
   - [public/dashboard.html](/Users/suhanisharma/majorproject/public/dashboard.html)
   - `.env` for the React app
6. Upload the Arduino sketch to ESP32.
7. Open the phone listener page on the phone and allow location + audio.
8. Open the dashboard page.
9. Trigger a test fall event and confirm:
   - `fall_events` gets a new row
   - phone inserts a `locations` row
   - dashboard updates with the map

## Run the Web App

For the React dashboard:

```bash
npm install
npm run dev
```

Add `.env` based on [.env.example](/Users/suhanisharma/majorproject/.env.example):

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

Then open:

- React dashboard: `/`
- Phone listener: `/phone-listener.html`
- Plain dashboard: `/dashboard.html`

## Beginner Notes

- The ESP32 sends the fall event first.
- The phone does not create the fall event. It waits for the event, then adds the location.
- Realtime means the phone and dashboard do not need page refreshes to see new rows.
- `event_id` in `locations` connects each location to the exact fall event that triggered it.

## Realtime Heartbeat Setup (ESP32 Hardware, No Dummy Data)

The sketch [esp32/fall_detection_supabase.ino](/Users/suhanisharma/majorproject/esp32/fall_detection_supabase.ino) now does both:

1. Uploads live health rows every few seconds to `public.health_data`
2. Uploads fall events to `public.fall_events` when acceleration crosses threshold

This keeps map/alarm flow working and also gives live heart rate updates in React dashboard.

### 1) Hardware wiring (ESP32 + MAX30102 + MPU6050)

Both sensors use I2C:

- ESP32 `3V3` -> MAX30102 `VIN`, MPU6050 `VCC`
- ESP32 `GND` -> MAX30102 `GND`, MPU6050 `GND`
- ESP32 `GPIO21 (SDA)` -> MAX30102 `SDA`, MPU6050 `SDA`
- ESP32 `GPIO22 (SCL)` -> MAX30102 `SCL`, MPU6050 `SCL`

### 2) Supabase setup

Run both SQL files in Supabase SQL Editor:

1. [supabase/fall_data.sql](/Users/suhanisharma/majorproject/supabase/fall_data.sql)
2. [supabase/health_data.sql](/Users/suhanisharma/majorproject/supabase/health_data.sql)

Then:

- Create/verify one row in `public.devices`
- Copy that UUID and set it as `DEVICE_ID` in ESP32 sketch
- Confirm realtime replication includes `fall_events`, `locations`, and `health_data`

### 3) ESP32 libraries required

Install in Arduino IDE Library Manager:

- `SparkFun MAX3010x Pulse and Proximity Sensor Library`
- `MPU6050` (common I2C MPU6050 library)

### 4) Configure and upload ESP32 sketch

Open [esp32/fall_detection_supabase.ino](/Users/suhanisharma/majorproject/esp32/fall_detection_supabase.ino) and set:

- `WIFI_SSID`
- `WIFI_PASSWORD`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DEVICE_ID` (UUID from `public.devices.id`)
- `PATIENT_ID` (text label like `patient_001`)

Upload sketch and open Serial Monitor at `115200`.

You should see logs like:

- `HeartRate=... bpm`
- `Fall event sent successfully` (on fall)
- `Fall snapshot pushed to health_data` (on fall)

### 5) Frontend env

In `.env`:

```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_SUPABASE_HEALTH_TABLE="health_data"
```

Restart Vite after env updates:

```bash
npm run dev
```

### 6) Verify end-to-end

1. Open React dashboard (`/`) and keep it running.
2. Put finger on MAX30102 for stable BPM.
3. Confirm new rows appear in `public.health_data` and dashboard heart-rate card updates.
4. Trigger fall test by moving/tilting hardware sharply.
5. Confirm:
   - row inserted in `public.fall_events`
   - phone listener receives event
   - phone inserts row in `public.locations`
   - map appears in dashboard + alarm works

### 7) Important note on SpO2

Current sketches remove fake SpO2 values and send `null` until a dedicated SpO2 algorithm is added.
This is intentional to avoid dummy data.
