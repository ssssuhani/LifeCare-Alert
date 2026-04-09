-- LifeCare+ verification queries for public.health_data
-- Run these in the Supabase SQL editor when you want to confirm the full flow.

-- 1. Check the table exists and recent rows are coming in
select
  id,
  patient_id,
  device_id,
  fall_detected,
  heart_rate,
  spo2,
  acceleration,
  latitude,
  longitude,
  gps_accuracy,
  location_timestamp,
  created_at
from public.health_data
order by created_at desc
limit 20;

-- 2. Confirm RLS policies are present
select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename = 'health_data'
order by policyname;

-- 3. Confirm realtime publication includes health_data
select
  pubname,
  schemaname,
  tablename
from pg_publication_tables
where schemaname = 'public'
  and tablename = 'health_data';

-- 4. Find the newest fall event that still needs phone GPS
select
  id,
  patient_id,
  device_id,
  heart_rate,
  spo2,
  fall_detected,
  acceleration,
  latitude,
  longitude,
  location_timestamp,
  created_at
from public.health_data
where fall_detected = true
  and (latitude is null or longitude is null)
order by created_at desc
limit 10;

-- 5. Manual hardware-style insert test
insert into public.health_data (
  patient_id,
  device_id,
  heart_rate,
  spo2,
  fall_detected,
  acceleration,
  device_timestamp_ms
)
values (
  'patient_001',
  'esp32-fall-detector-01',
  84,
  98,
  true,
  2.63,
  (extract(epoch from now()) * 1000)::bigint
)
returning id, patient_id, device_id, heart_rate, spo2, fall_detected, created_at;

-- 6. Manual phone GPS update test
-- Replace <ROW_ID> with a real row id from the insert/select above.
update public.health_data
set
  latitude = 30.273230,
  longitude = 77.992584,
  gps_accuracy = 12,
  location_timestamp = (extract(epoch from now()) * 1000)::bigint
where id = <ROW_ID>
returning id, latitude, longitude, gps_accuracy, location_timestamp;

-- 7. Final row check after phone GPS sync
-- Replace <ROW_ID> with the same row id.
select
  id,
  patient_id,
  device_id,
  heart_rate,
  spo2,
  fall_detected,
  latitude,
  longitude,
  gps_accuracy,
  location_timestamp,
  created_at
from public.health_data
where id = <ROW_ID>;
