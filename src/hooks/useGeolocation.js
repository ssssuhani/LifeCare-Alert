import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Hook for GPS location and sharing.
 * Uses browser Geolocation API.
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);
  const watchIdRef = useRef(null);

  const updateLocation = useCallback((position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const nextLocation = {
      latitude,
      longitude,
      accuracy: typeof accuracy === 'number' ? accuracy : null,
      capturedAt: new Date().toISOString(),
      capturedAtMs: Date.now(),
    };
    setLocation(nextLocation);
    setError(null);
    setLoading(false);
    return nextLocation;
  }, []);

  const getLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        const geolocationError = new Error(
          'Phone location needs HTTPS. Open this page on a secure https:// URL instead of the local network http:// address.'
        );
        setError(geolocationError.message);
        setLoading(false);
        reject(geolocationError);
        return;
      }

      if (!navigator.geolocation) {
        const geolocationError = new Error('Geolocation is not supported by your browser');
        setError(geolocationError.message);
        setLoading(false);
        reject(geolocationError);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve(updateLocation(position));
        },
        (err) => {
          const geolocationError = new Error(err.message || 'Unable to retrieve location');
          setError(geolocationError.message);
          setLoading(false);
          reject(geolocationError);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [updateLocation]);

  const startWatching = useCallback(() => {
    setLoading(true);
    setError(null);

    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        const geolocationError = new Error(
          'Phone location needs HTTPS. Open this page on a secure https:// URL instead of the local network http:// address.'
        );
        setError(geolocationError.message);
        setLoading(false);
        reject(geolocationError);
        return;
      }

      if (!navigator.geolocation) {
        const geolocationError = new Error('Geolocation is not supported by your browser');
        setError(geolocationError.message);
        setLoading(false);
        reject(geolocationError);
        return;
      }

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }

      let hasResolved = false;

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation = updateLocation(position);
          setWatching(true);

          if (!hasResolved) {
            hasResolved = true;
            resolve(nextLocation);
          }
        },
        (err) => {
          const geolocationError = new Error(err.message || 'Unable to watch location');
          setError(geolocationError.message);
          setLoading(false);
          setWatching(false);

          if (!hasResolved) {
            hasResolved = true;
            reject(geolocationError);
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, [updateLocation]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setWatching(false);
    setLoading(false);
  }, []);

  useEffect(() => () => stopWatching(), [stopWatching]);

  const getMapsLink = useCallback(() => {
    if (!location) return '';
    return `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  }, [location]);

  const getShareText = useCallback(() => {
    if (!location) return '';
    return `I need help! My location: ${location.latitude},${location.longitude}\nOpen in maps: ${getMapsLink()}`;
  }, [location, getMapsLink]);

  const copyToClipboard = useCallback(async () => {
    const text = getShareText();
    if (!text) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }, [getShareText]);

  const shareViaWhatsApp = useCallback(() => {
    const text = encodeURIComponent(getShareText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [getShareText]);

  return {
    location,
    error,
    loading,
    watching,
    getLocation,
    startWatching,
    stopWatching,
    getMapsLink,
    getShareText,
    copyToClipboard,
    shareViaWhatsApp,
  };
}
