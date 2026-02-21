/**
 * Returns array of alert messages based on sensor thresholds.
 */
export function getAlerts(temperature, heartRate, bloodOxygen) {
  const alerts = [];

  if (heartRate > 120) {
    alerts.push(`Heart rate critically high: ${heartRate} BPM`);
  } else if (heartRate > 100) {
    alerts.push(`Heart rate elevated: ${heartRate} BPM`);
  }

  if (bloodOxygen < 90) {
    alerts.push(`Blood oxygen critically low: ${bloodOxygen}%`);
  } else if (bloodOxygen < 93) {
    alerts.push(`Blood oxygen low: ${bloodOxygen}%`);
  }

  if (temperature > 38) {
    alerts.push(`Temperature critically high: ${temperature}°C`);
  } else if (temperature > 37.5) {
    alerts.push(`Temperature elevated: ${temperature}°C`);
  }

  return alerts;
}
