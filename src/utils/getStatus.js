/**
 * Computes overall health status from sensor values.
 * Returns: 'normal' | 'warning' | 'critical'
 */
export function getStatus({
  temperature = null,
  heartRate = null,
  bloodOxygen = null,
  fallDetected = false,
} = {}) {
  const critical =
    fallDetected ||
    (typeof heartRate === 'number' && heartRate > 120) ||
    (typeof bloodOxygen === 'number' && bloodOxygen < 90) ||
    (typeof temperature === 'number' && temperature > 38);

  const warning =
    (typeof heartRate === 'number' && heartRate > 100) ||
    (typeof bloodOxygen === 'number' && bloodOxygen < 93) ||
    (typeof temperature === 'number' && temperature > 37.5);

  if (critical) return 'critical';
  if (warning) return 'warning';
  return 'normal';
}
