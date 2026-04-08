import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSupabase, isSupabaseConfigured } from '../lib/supabaseClient';

const STORAGE_KEY = 'lifecare-phone-sync-enabled';

function readStoredSyncPreference() {
  if (typeof window === 'undefined') return false;

  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredSyncPreference(enabled) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage write issues on restricted browsers/private mode.
  }
}

function isSecureGeolocationContext() {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  const localhostHosts = new Set(['localhost', '127.0.0.1', '::1']);

  return window.isSecureContext || localhostHosts.has(hostname);
}

function getPreciseLocation() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    if (!isSecureGeolocationContext()) {
      reject(
        new Error(
          'Exact phone GPS works only on HTTPS or localhost. Open this portal securely on the patient phone.'
        )
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied on this phone.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Phone GPS location is unavailable right now.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Phone GPS request timed out. Please try again.'));
            break;
          default:
            reject(new Error(error.message || 'Unknown geolocation error.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}

export function usePhoneLocationSync() {
  const [syncEnabled, setSyncEnabled] = useState(() => readStoredSyncPreference());
  const [permissionState, setPermissionState] = useState('prompt');
  const [syncState, setSyncState] = useState('idle');
  const [syncMessage, setSyncMessage] = useState(
    'Open this portal on the patient phone and enable exact GPS to capture the fall location.'
  );
  const [syncError, setSyncError] = useState('');
  const [lastLocation, setLastLocation] = useState(null);
  const processedEventIdsRef = useRef(new Set());

  useEffect(() => {
    writeStoredSyncPreference(syncEnabled);
  }, [syncEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    if (!('permissions' in navigator) || !navigator.permissions?.query) return undefined;

    let isMounted = true;

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((result) => {
        if (!isMounted) return;
        setPermissionState(result.state);

        result.onchange = () => {
          setPermissionState(result.state);
        };
      })
      .catch(() => {
        // Some browsers do not support permission query cleanly.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const requestLocationAccess = useCallback(async () => {
    setSyncError('');

    try {
      const location = await getPreciseLocation();
      setLastLocation(location);
      setPermissionState('granted');
      setSyncEnabled(true);
      setSyncState('active');
      setSyncMessage(
        `Exact phone GPS sync is active. Latest position: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
      );
      return true;
    } catch (error) {
      setSyncEnabled(false);
      setSyncState('error');
      setSyncError(error.message);
      setSyncMessage(error.message);
      return false;
    }
  }, []);

  useEffect(() => {
    if (!syncEnabled) return undefined;
    if (!isSupabaseConfigured()) return undefined;

    const supabase = getSupabase();
    if (!supabase) return undefined;

    let isActive = true;

    const syncLocationForEvent = async (eventRow) => {
      if (!isActive || !eventRow || eventRow.event_type !== 'fall') return;
      if (processedEventIdsRef.current.has(eventRow.id)) return;

      processedEventIdsRef.current.add(eventRow.id);
      setSyncState('syncing');
      setSyncError('');
      setSyncMessage(`Fall event #${eventRow.id} received. Fetching exact phone location...`);

      try {
        const { data: existingLocationRows, error: locationLookupError } = await supabase
          .from('locations')
          .select('id, latitude, longitude, created_at')
          .eq('event_id', eventRow.id)
          .limit(1);

        if (locationLookupError) {
          throw locationLookupError;
        }

        if (existingLocationRows?.length) {
          const existing = existingLocationRows[0];
          setLastLocation({
            eventId: eventRow.id,
            latitude: Number(existing.latitude),
            longitude: Number(existing.longitude),
            accuracy: null,
            capturedAt: existing.created_at,
          });
          setSyncState('active');
          setSyncMessage(`Exact location already saved for fall event #${eventRow.id}.`);
          return;
        }

        const location = await getPreciseLocation();

        const { error: insertError } = await supabase.from('locations').insert({
          event_id: eventRow.id,
          latitude: location.latitude,
          longitude: location.longitude,
        });

        if (insertError) {
          throw insertError;
        }

        setLastLocation({
          ...location,
          eventId: eventRow.id,
        });
        setPermissionState('granted');
        setSyncState('active');
        setSyncMessage(
          `Exact location synced for fall event #${eventRow.id}: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
        );
      } catch (error) {
        processedEventIdsRef.current.delete(eventRow.id);
        setSyncState('error');
        setSyncError(error.message || 'Location sync failed.');
        setSyncMessage(`Fall detected, but exact location sync failed: ${error.message}`);
      }
    };

    const channel = supabase
      .channel('react-phone-location-sync')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'fall_events',
        },
        (payload) => {
          syncLocationForEvent(payload?.new);
        }
      )
      .subscribe((status) => {
        if (!isActive) return;

        if (status === 'SUBSCRIBED') {
          setSyncState('active');
          setSyncMessage((currentMessage) =>
            currentMessage.includes('Exact location synced') || currentMessage.includes('Latest position')
              ? currentMessage
              : 'Exact phone GPS sync is active. Waiting for the next fall event.'
          );
        }
      });

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
    };
  }, [syncEnabled]);

  const isSecureContextReady = useMemo(() => isSecureGeolocationContext(), []);

  return {
    syncEnabled,
    permissionState,
    syncState,
    syncMessage,
    syncError,
    lastLocation,
    isSecureContextReady,
    requestLocationAccess,
  };
}
