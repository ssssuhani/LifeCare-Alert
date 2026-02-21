import { useState, useEffect } from 'react';

/**
 * Custom hook for health sensor data.
 * Uses mock simulation via setInterval.
 * Structure designed for easy Firebase Realtime Database integration:
 * - Replace setInterval with onValue(ref, callback) from Firebase
 * - Map Firebase snapshot to this state shape
 */
const INITIAL_STATE = {
  temperature: 36.5,
  heartRate: 72,
  bloodOxygen: 98,
  activityLevel: 0.2,
  lastUpdated: new Date().toISOString(),
};

// Random value within range
const randomInRange = (min, max, decimals = 1) => {
  const value = Math.random() * (max - min) + min;
  return decimals === 0 ? Math.round(value) : Number(value.toFixed(decimals));
};

export function useHealthData() {
  const [data, setData] = useState(INITIAL_STATE);
  const [heartRateHistory, setHeartRateHistory] = useState(() => {
    const now = new Date();
    return Array.from({ length: 20 }, (_, i) => ({
      time: new Date(now - (19 - i) * 5000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      value: randomInRange(65, 85, 0),
    }));
  });

  useEffect(() => {
    const interval = setInterval(() => {
      // Occasional alert-triggering values for demo (10% chance)
      const demoMode = Math.random() < 0.1;
      const newHeartRate = demoMode
        ? randomInRange(115, 125, 0)
        : randomInRange(68, 95, 0);
      const newTemp = demoMode
        ? randomInRange(37.8, 38.5, 1)
        : randomInRange(36.2, 37.2, 1);
      const newSpO2 = demoMode
        ? randomInRange(85, 92, 0)
        : randomInRange(95, 100, 0);
      const newActivity = randomInRange(0.1, 0.5, 2);

      setData({
        temperature: newTemp,
        heartRate: newHeartRate,
        bloodOxygen: newSpO2,
        activityLevel: newActivity,
        lastUpdated: new Date().toISOString(),
      });

      setHeartRateHistory((prev) => {
        const newPoint = {
          time: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          value: newHeartRate,
        };
        const updated = [...prev.slice(1), newPoint];
        return updated;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return { data, heartRateHistory };
}
