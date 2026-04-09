import { useState, useCallback } from 'react';

/**
 * Hook for GPS location and sharing.
 * Uses browser Geolocation API.
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({ latitude, longitude });
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Unable to retrieve location');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

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
    getLocation,
    getMapsLink,
    getShareText,
    copyToClipboard,
    shareViaWhatsApp,
  };
}
