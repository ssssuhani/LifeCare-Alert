import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for managing health alert notifications.
 * - Adds notifications when mishaps/alerts occur
 * - Optional browser Notification API for system alerts
 */
export function useNotifications(alerts = []) {
  const [notifications, setNotifications] = useState([]);
  const [browserNotificationEnabled, setBrowserNotificationEnabled] = useState(() =>
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  );
  const lastAlertKeyRef = useRef('');

  const addNotification = useCallback((message, type = 'alert') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = new Date().toISOString();
    const newNotif = { id, message, type, timestamp };

    setNotifications((prev) => [newNotif, ...prev].slice(0, 50)); // Keep last 50

    // Browser notification
    if (browserNotificationEnabled && type === 'alert' && 'Notification' in window) {
      try {
        new Notification('LifeCare+ Alert', {
          body: message,
          icon: '/vite.svg',
          tag: id,
        });
      } catch (e) {
        // Ignore notification errors
      }
    }

    return id;
  }, [browserNotificationEnabled]);

  const clearNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Request browser notification permission
  const requestBrowserNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') {
      setBrowserNotificationEnabled(true);
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      setBrowserNotificationEnabled(permission === 'granted');
      return permission === 'granted';
    }
    return false;
  }, []);

  // Add notifications when alerts (mishaps) occur
  useEffect(() => {
    if (alerts.length === 0) return;

    const alertKey = [...alerts].sort().join('|');
    if (alertKey === lastAlertKeyRef.current) return; // Avoid duplicate for same alert set
    lastAlertKeyRef.current = alertKey;

    alerts.forEach((msg) => addNotification(msg, 'alert'));
  }, [alerts, addNotification]);

  return {
    notifications,
    addNotification,
    clearNotification,
    clearAllNotifications,
    requestBrowserNotificationPermission,
    browserNotificationEnabled: browserNotificationEnabled || (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'),
  };
}
