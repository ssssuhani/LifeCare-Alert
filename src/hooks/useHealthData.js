import { useState, useEffect } from 'react';
import { isSupabaseConfigured, getSupabase } from '../lib/supabaseClient';

/**
 * Custom hook for health sensor data.
 * Supabase-only: fetch latest reading + subscribe to realtime updates.
 */
const INITIAL_STATE = null;

const HEALTH_TABLE = import.meta.env.VITE_SUPABASE_HEALTH_TABLE || 'health_readings';
const RAW_URL = import.meta.env.VITE_SUPABASE_URL;
const RAW_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toStringOrNull(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function toBooleanOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;

  const normalized = String(value).trim().toLowerCase();

  if (['true', '1', 'yes', 'active', 'alert', 'detected'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'inactive', 'normal', 'safe', 'resolved'].includes(normalized)) {
    return false;
  }

  return null;
}

function mapCoordinates(row) {
  const latitude = toNumberOrNull(
    row.latitude ?? row.lat ?? row.location_latitude ?? row.locationLat
  );
  const longitude = toNumberOrNull(
    row.longitude ?? row.lng ?? row.lon ?? row.location_longitude ?? row.locationLng
  );
  const gpsAccuracy = toNumberOrNull(row.gps_accuracy ?? row.gpsAccuracy);
  const locationTimestamp = toNumberOrNull(
    row.location_timestamp ?? row.locationTimestamp
  );

  if (latitude === null || longitude === null) return null;
  if (latitude === 0 && longitude === 0 && !gpsAccuracy && !locationTimestamp) return null;

  return { latitude, longitude };
}

function mapRowToState(row) {
  if (!row) return null;

  const eventType = toStringOrNull(
    row.event_type ?? row.eventType ?? row.alert_type ?? row.status
  );
  const fallDetected =
    toBooleanOrNull(
      row.fall_detected ??
        row.fallDetected ??
        row.is_fall ??
        row.isFall ??
        row.alert_active ??
        row.alertActive
    ) ??
    Boolean(eventType && eventType.toLowerCase().includes('fall'));

  return {
    id: row.id ?? null,
    temperature: toNumberOrNull(row.temperature ?? row.temp),
    heartRate: toNumberOrNull(row.heart_rate ?? row.heartRate),
    bloodOxygen: toNumberOrNull(row.blood_oxygen ?? row.bloodOxygen ?? row.spo2),
    activityLevel: toNumberOrNull(
      row.activity_level ?? row.activityLevel ?? row.acceleration
    ),
    lastUpdated: row.created_at ?? row.timestamp ?? null,
    lastEventTime:
      row.event_time ?? row.detected_at ?? row.last_event_time ?? row.created_at ?? row.timestamp ?? null,
    deviceId: toStringOrNull(row.device_id ?? row.deviceId ?? row.patient_id ?? row.sensor_id),
    eventType,
    eventMessage: toStringOrNull(
      row.event_message ?? row.alert_message ?? row.message ?? row.description
    ),
    fallDetected,
    coordinates: mapCoordinates(row),
    locationSource:
      toStringOrNull(row.location_source ?? row.locationSource) ??
      (toNumberOrNull(row.location_timestamp ?? row.locationTimestamp)
        ? 'phone-browser'
        : null),
    locationSyncedAt:
      row.location_synced_at ??
      row.locationSyncedAt ??
      (row.location_timestamp ? new Date(Number(row.location_timestamp)).toISOString() : null),
  };
}

export function useHealthData(patientId = null) {
  const [data, setData] = useState(INITIAL_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heartRateHistory, setHeartRateHistory] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      setError(
        'Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the dev server.'
      );
      return;
    }

    if (
      String(RAW_URL || '').includes('YOUR_PROJECT_REF') ||
      String(RAW_KEY || '').includes('YOUR_SUPABASE_ANON_KEY')
    ) {
      setLoading(false);
      setError(
        'Supabase .env values are still placeholders. Replace VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your real Supabase Project URL + anon key, then restart the dev server.'
      );
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      setError(
        'Supabase client could not be initialized. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart the dev server.'
      );
      return;
    }
    let isCancelled = false;
    setLoading(true);
    setError(null);

    async function bootstrap() {
      const query = supabase
        .from(HEALTH_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      // Some existing schemas may not have patient_id; in that case useHealthData()
      // should be called without a patientId (we do not hard-fail here).
      const { data: rows, error } = patientId
        ? await query.eq('patient_id', patientId)
        : await query;

      if (isCancelled) return;

      if (error) {
        setError(error.message ?? 'Failed to fetch health data from Supabase.');
        setLoading(false);
        return;
      }

      const mapped = mapRowToState(rows?.[0]);
      setData(mapped);
      setLoading(false);

      const hr = toNumberOrNull(mapped?.heartRate);
      if (hr !== null) {
        setHeartRateHistory((prev) => {
          const newPoint = {
            time: new Date().toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            value: hr,
          };
          const next = [...prev, newPoint];
          return next.slice(-20);
        });
      }
    }

    bootstrap();

    const channel = supabase
      .channel(`${HEALTH_TABLE}:${patientId ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: HEALTH_TABLE,
          ...(patientId ? { filter: `patient_id=eq.${patientId}` } : {}),
        },
        (payload) => {
          const row = payload?.new ?? payload?.record ?? null;
          const mapped = mapRowToState(row);
          if (!mapped) return;
          setData(mapped);
          setLoading(false);
          setError(null);

          const hr = toNumberOrNull(mapped.heartRate);
          if (hr === null) return;
          setHeartRateHistory((prev) => {
            const newPoint = {
              time: new Date().toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              }),
              value: hr,
            };
            const next = [...prev, newPoint];
            return next.slice(-20);
          });
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [patientId]);

  return { data, heartRateHistory, loading, error };
}
