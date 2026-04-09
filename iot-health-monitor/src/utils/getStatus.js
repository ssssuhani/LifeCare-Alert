/**
 * Computes overall health status from sensor values.
 * Returns: 'normal' | 'warning' | 'critical'
 */
export function getStatus(temperature, heartRate, bloodOxygen) {
  const critical =
    heartRate > 120 ||
    bloodOxygen < 90 ||
    temperature > 38;
  
  const warning =
    heartRate > 100 ||
    bloodOxygen < 93 ||
    temperature > 37.5;

  if (critical) return 'critical';
  if (warning) return 'warning';
  return 'normal';
}
