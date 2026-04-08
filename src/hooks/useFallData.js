import { useEffect, useMemo, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const RAW_URL = import.meta.env.VITE_SUPABASE_URL;
const RAW_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function mapEventRow(eventRow, locationsByEventId) {
  if (!eventRow) return null;

  const latestLocation = locationsByEventId.get(eventRow.id) ?? null;

  return {
    id: eventRow.id,
    deviceId:
      eventRow.devices?.device_name ??
      eventRow.device_id ??
      'ESP32 Device',
    deviceUuid: eventRow.device_id,
    eventType: eventRow.event_type ?? 'fall',
    fallDetected: (eventRow.event_type ?? 'fall') === 'fall',
    heartRate: eventRow.heart_rate ?? null,
    spo2: eventRow.spo2 ?? null,
    acceleration: null,
    timestamp: eventRow.created_at ?? null,
    createdAt: eventRow.created_at ?? null,
    location: latestLocation,
  };
}

export function useFallData(limit = 10) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        'Supabase .env values are still placeholders. Replace VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY with your real values, then restart the dev server.'
      );
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      setError(
        'Supabase client could not be initialized. Check your environment values and restart the dev server.'
      );
      return;
    }

    let isCancelled = false;

    async function loadData() {
      setLoading(true);

      const { data: eventRows, error: eventError } = await supabase
        .from('fall_events')
        .select(
          `
            id,
            device_id,
            event_type,
            heart_rate,
            spo2,
            created_at,
            devices (
              id,
              device_name,
              user_id
            )
          `
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (isCancelled) return;

      if (eventError) {
        setError(eventError.message ?? 'Failed to load fall event data from Supabase.');
        setLoading(false);
        return;
      }

      const eventIds = (eventRows ?? []).map((row) => row.id);
      const locationsByEventId = new Map();

      if (eventIds.length > 0) {
        const { data: locationRows, error: locationError } = await supabase
          .from('locations')
          .select('id, event_id, latitude, longitude, created_at')
          .in('event_id', eventIds)
          .order('created_at', { ascending: false });

        if (isCancelled) return;

        if (locationError) {
          setError(locationError.message ?? 'Failed to load location data from Supabase.');
          setLoading(false);
          return;
        }

        (locationRows ?? []).forEach((locationRow) => {
          if (!locationsByEventId.has(locationRow.event_id)) {
            locationsByEventId.set(locationRow.event_id, {
              id: locationRow.id,
              latitude: Number(locationRow.latitude),
              longitude: Number(locationRow.longitude),
              createdAt: locationRow.created_at,
            });
          }
        });
      }

      setEvents((eventRows ?? []).map((row) => mapEventRow(row, locationsByEventId)).filter(Boolean));
      setError(null);
      setLoading(false);
    }

    loadData();

    const channel = supabase
      .channel('fall-monitoring-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fall_events',
        },
        loadData
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'locations',
        },
        loadData
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  const latestEvent = useMemo(() => events[0] ?? null, [events]);

  return {
    latestEvent,
    events,
    loading,
    error,
  };
}
