// MQTT wire contract (decisions #10, #16, #19).
// Pure functions only — no broker, no Nest. The mock publisher and the
// readings subscriber share this module so tests can lock the bytes
// without a live Mosquitto.
//
// Topic strings are fixed. Do not rename them here.

export const READINGS_SUBSCRIPTION = 'nissim/+/readings';

const READING_PAYLOAD_KEYS = ['sensor', 'value', 'recorded_at'] as const;
const COMMAND_PAYLOAD_KEYS = ['actuator', 'state'] as const;

export const ACTUATOR_COMMAND_STATES = ['on', 'off'] as const;
export type ActuatorCommandState = (typeof ACTUATOR_COMMAND_STATES)[number];

export type ReadingPayload = {
  sensor: string;
  value: number;
  recorded_at: string;
};

export type ParsedReading = {
  sensorName: string;
  value: number;
  recordedAt: Date;
};

export type CommandPayload = {
  actuator: string;
  state: ActuatorCommandState;
};

export function readingsTopic(deviceId: number): string {
  assertPositiveDeviceId(deviceId);
  return `nissim/${deviceId}/readings`;
}

export function commandTopic(deviceId: number): string {
  assertPositiveDeviceId(deviceId);
  return `nissim/${deviceId}/commands`;
}

// Accept only nissim/<positive integer>/readings. Anything else is not a
// reading, including the commands topic on the same device id.
export function parseDeviceIdFromTopic(topic: string): number {
  const parts = topic.split('/');
  if (parts.length !== 3 || parts[0] !== 'nissim' || parts[2] !== 'readings') {
    throw new Error(`Unexpected readings topic: ${topic}`);
  }
  const deviceId = Number(parts[1]);
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    throw new Error(`Invalid deviceId in topic: ${topic}`);
  }
  return deviceId;
}

export function parseReadingPayload(payload: unknown): ParsedReading {
  const record = readingRecord(payload);
  const sensorName = record.sensor;
  const value = record.value;
  const recordedAtRaw = record.recorded_at;

  if (typeof sensorName !== 'string' || sensorName.length === 0) {
    throw new Error('Reading payload.sensor must be a non-empty string');
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Reading payload.value must be a finite number');
  }
  if (typeof recordedAtRaw !== 'string') {
    throw new Error('Reading payload.recorded_at must be an ISO date string');
  }

  const recordedAt = new Date(recordedAtRaw);
  if (Number.isNaN(recordedAt.getTime())) {
    throw new Error('Reading payload.recorded_at is not a valid date');
  }

  return { sensorName, value, recordedAt };
}

export function buildReadingPayload(input: {
  sensor: string;
  value: number;
  recordedAt: Date;
}): ReadingPayload {
  const payload: ReadingPayload = {
    sensor: input.sensor,
    value: input.value,
    recorded_at: input.recordedAt.toISOString(),
  };
  parseReadingPayload(payload);
  assertExactKeys(payload, READING_PAYLOAD_KEYS);
  return payload;
}

export function parseCommandPayload(payload: unknown): CommandPayload {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new Error('Command payload must be an object');
  }

  const record = payload as Record<string, unknown>;
  const actuator = record.actuator;
  const state = record.state;

  if (typeof actuator !== 'string' || actuator.length === 0) {
    throw new Error('Command payload.actuator must be a non-empty string');
  }
  if (!isActuatorCommandState(state)) {
    throw new Error('Command payload.state must be "on" or "off"');
  }

  return { actuator, state };
}

export function buildCommandPayload(
  actuator: string,
  state: ActuatorCommandState,
): CommandPayload {
  const payload: CommandPayload = { actuator, state };
  parseCommandPayload(payload);
  assertExactKeys(payload, COMMAND_PAYLOAD_KEYS);
  return payload;
}

function readingRecord(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== 'object') {
    throw new Error('Reading payload must be an object');
  }
  return payload as Record<string, unknown>;
}

function assertPositiveDeviceId(deviceId: number): void {
  if (!Number.isInteger(deviceId) || deviceId <= 0) {
    throw new Error(`Invalid deviceId: ${deviceId}`);
  }
}

function isActuatorCommandState(state: unknown): state is ActuatorCommandState {
  return ACTUATOR_COMMAND_STATES.some((allowed) => allowed === state);
}

function assertExactKeys(payload: object, keys: readonly string[]): void {
  const actual = Object.keys(payload);
  if (
    actual.length !== keys.length ||
    keys.some((key, i) => actual[i] !== key)
  ) {
    throw new Error(
      `Payload keys must be ${keys.join(', ')} (got ${actual.join(', ')})`,
    );
  }
}
