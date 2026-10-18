// CLI args for the separate mock publisher (decision #16).
// Kept next to the contract so unit tests can build a reading without
// importing the script or opening a broker.

export type PublishReadingArgs = {
  deviceId: number;
  sensor: string;
  value: number;
  recordedAt: Date;
  dryRun: boolean;
};

export function parsePublishReadingArgs(argv: string[]): PublishReadingArgs {
  const dryRun = argv[0] === '--dry-run';
  const rest = dryRun ? argv.slice(1) : argv;
  if (rest.length < 3 || rest.length > 4) {
    throw new Error(
      'Usage: publish-reading [--dry-run] <deviceId> <sensor> <value> [recordedAt]',
    );
  }

  const deviceId = Number(rest[0]);
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    throw new Error(`Invalid deviceId: ${rest[0]}`);
  }

  const sensor = rest[1] ?? '';
  if (sensor.length === 0) {
    throw new Error('sensor must be a non-empty string');
  }

  const value = Number(rest[2]);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid value: ${rest[2]}`);
  }

  const recordedAt = rest[3] !== undefined ? new Date(rest[3]) : new Date();
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error(`Invalid recordedAt: ${rest[3]}`);
  }

  return { deviceId, sensor, value, recordedAt, dryRun };
}
