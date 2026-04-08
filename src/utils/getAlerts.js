/**
 * Returns array of alert messages based on sensor thresholds.
 */
export function getAlerts({
  temperature = null,
  heartRate = null,
  bloodOxygen = null,
  fallDetected = false,
  location = null,
} = {}) {
  const alerts = [];

  if (fallDetected) {
    const locationMessage =
      location?.latitude !== undefined && location?.longitude !== undefined
        ? ` Location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}. Maps: https://www.google.com/maps?q=${location.latitude},${location.longitude}`
        : '';
    alerts.push(`Fall detected by wearable device.${locationMessage}`);
  }

  if (typeof heartRate === 'number' && heartRate > 120) {
    alerts.push(`Heart rate critically high: ${heartRate} BPM`);
  } else if (typeof heartRate === 'number' && heartRate > 100) {
    alerts.push(`Heart rate elevated: ${heartRate} BPM`);
  }

  if (typeof bloodOxygen === 'number' && bloodOxygen < 90) {
    alerts.push(`Blood oxygen critically low: ${bloodOxygen}%`);
  } else if (typeof bloodOxygen === 'number' && bloodOxygen < 93) {
    alerts.push(`Blood oxygen low: ${bloodOxygen}%`);
  }

  if (typeof temperature === 'number' && temperature > 38) {
    alerts.push(`Temperature critically high: ${temperature}°C`);
  } else if (typeof temperature === 'number' && temperature > 37.5) {
    alerts.push(`Temperature elevated: ${temperature}°C`);
  }

  return alerts;
}
