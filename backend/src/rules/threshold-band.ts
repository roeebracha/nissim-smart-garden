// Hysteresis band invariant for an automation rule (decision #9).
//
// less_than turns on below on_threshold and off above off_threshold, so
// on must sit below off. greater_than is the mirror. An inverted band
// chatters: the same reading turns the actuator on and then off.
//
// This is a domain rule, not an entry-point check. The suggest tool and
// the approve API both call it. Equal thresholds are inverted too.

export type ThresholdOperatorName = 'less_than' | 'greater_than';

export function hysteresisError(
  operator: ThresholdOperatorName,
  onThreshold: number,
  offThreshold: number,
): string | null {
  if (operator === 'less_than' && !(onThreshold < offThreshold)) {
    return 'for less_than, on_threshold must be below off_threshold';
  }
  if (operator === 'greater_than' && !(onThreshold > offThreshold)) {
    return 'for greater_than, on_threshold must be above off_threshold';
  }
  return null;
}
