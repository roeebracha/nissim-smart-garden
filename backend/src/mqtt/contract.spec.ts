import { spawnSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { Actuator } from '../../generated/prisma/client';
import { OperationService } from '../operation/operation.service';
import { PrismaService } from '../prisma/prisma.service';
import { MqttConnection } from './mqtt.client';
import { parsePublishReadingArgs } from './publish-reading-args';
import {
  READINGS_SUBSCRIPTION,
  buildCommandPayload,
  buildReadingPayload,
  commandTopic,
  parseCommandPayload,
  parseDeviceIdFromTopic,
  parseReadingPayload,
  readingsTopic,
} from './contract';

const RECORDED_AT = '2026-10-16T00:00:00.000Z';

describe('parseDeviceIdFromTopic', () => {
  it('reads the device id from nissim/<id>/readings', () => {
    expect(parseDeviceIdFromTopic('nissim/1/readings')).toBe(1);
    expect(parseDeviceIdFromTopic(readingsTopic(12))).toBe(12);
  });

  it.each([
    'nissim/1/commands',
    'nissim/1/readings/extra',
    'nissim/1',
    'nissim/0/readings',
    'nissim/-3/readings',
    'nissim/1.5/readings',
    'nissim/abc/readings',
    'other/1/readings',
  ])('rejects %s', (topic) => {
    expect(() => parseDeviceIdFromTopic(topic)).toThrow();
  });

  it('keeps the readings subscription filter unchanged', () => {
    expect(READINGS_SUBSCRIPTION).toBe('nissim/+/readings');
  });
});

describe('MQTT JSON contract', () => {
  it('locks a reading to { sensor, value, recorded_at }', () => {
    const payload = buildReadingPayload({
      sensor: 'moisture_1',
      value: 42,
      recordedAt: new Date(RECORDED_AT),
    });

    expect(payload).toEqual({
      sensor: 'moisture_1',
      value: 42,
      recorded_at: RECORDED_AT,
    });
    expect(Object.keys(payload)).toEqual(['sensor', 'value', 'recorded_at']);
    expect(parseReadingPayload(payload)).toEqual({
      sensorName: 'moisture_1',
      value: 42,
      recordedAt: new Date(RECORDED_AT),
    });
    expect(readingsTopic(1)).toBe('nissim/1/readings');
  });

  it('rejects a reading that is missing a required field', () => {
    expect(() => parseReadingPayload(null)).toThrow(
      'Reading payload must be an object',
    );
    expect(() =>
      parseReadingPayload({ sensor: '', value: 1, recorded_at: RECORDED_AT }),
    ).toThrow('sensor');
    expect(() =>
      parseReadingPayload({
        sensor: 'moisture_1',
        value: Number.NaN,
        recorded_at: RECORDED_AT,
      }),
    ).toThrow('value');
    expect(() =>
      parseReadingPayload({
        sensor: 'moisture_1',
        value: 1,
        recorded_at: 'not-a-date',
      }),
    ).toThrow('recorded_at');
  });

  it('locks a command to { actuator, state } with state on or off', () => {
    expect(buildCommandPayload('pump_tea', 'on')).toEqual({
      actuator: 'pump_tea',
      state: 'on',
    });
    expect(buildCommandPayload('lamp', 'off')).toEqual({
      actuator: 'lamp',
      state: 'off',
    });
    expect(Object.keys(buildCommandPayload('pump_tea', 'on'))).toEqual([
      'actuator',
      'state',
    ]);
    expect(parseCommandPayload({ actuator: 'pump_tea', state: 'off' })).toEqual(
      {
        actuator: 'pump_tea',
        state: 'off',
      },
    );
    expect(commandTopic(1)).toBe('nissim/1/commands');
    expect(() =>
      parseCommandPayload({ actuator: 'pump_tea', state: 'open' }),
    ).toThrow('on');
    expect(() => parseCommandPayload({ actuator: '', state: 'on' })).toThrow(
      'actuator',
    );
  });
});

describe('Operation command publish', () => {
  const publish = jest.fn<Promise<void>, [string, unknown]>();

  function service(): OperationService {
    publish.mockReset();
    publish.mockResolvedValue(undefined);
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([]),
      actuator: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      actuatorEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    return new OperationService(
      prisma as unknown as PrismaService,
      {
        publish,
      } as unknown as MqttConnection,
    );
  }

  function actuator(desiredState: 'on' | 'off'): Actuator {
    return {
      id: 7,
      name: 'pump_tea',
      type: 'pump',
      desiredState,
      desiredSince: new Date(),
      reportedState: 'off',
      reportedAt: new Date(),
      planterId: 1,
      deviceId: 1,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('publishes the command fixture when turning a pump on', async () => {
    await service().requestActuation({
      actuator: actuator('off'),
      nextState: 'on',
      source: 'rule',
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      commandTopic(1),
      buildCommandPayload('pump_tea', 'on'),
    );
  });

  it('publishes state off without inventing another payload field', async () => {
    await service().requestActuation({
      actuator: actuator('on'),
      nextState: 'off',
      source: 'rule',
    });

    expect(publish).toHaveBeenCalledWith(
      'nissim/1/commands',
      buildCommandPayload('pump_tea', 'off'),
    );
  });
});

describe('mock reading publisher', () => {
  it('builds the readings payload from CLI args and does not connect', () => {
    const args = parsePublishReadingArgs([
      '--dry-run',
      '1',
      'moisture_1',
      '42',
      RECORDED_AT,
    ]);

    expect(args.dryRun).toBe(true);
    expect(args.deviceId).toBe(1);
    expect(
      buildReadingPayload({
        sensor: args.sensor,
        value: args.value,
        recordedAt: args.recordedAt,
      }),
    ).toEqual({
      sensor: 'moisture_1',
      value: 42,
      recorded_at: RECORDED_AT,
    });
  });

  it('rejects a device id of 0 before any publish', () => {
    expect(() => parsePublishReadingArgs(['0', 'moisture_1', '1'])).toThrow(
      'deviceId',
    );
  });

  it('runs as its own process and exits without a broker', () => {
    const backendRoot = join(__dirname, '../..');
    const result = spawnSync(
      join(backendRoot, 'node_modules/.bin/ts-node'),
      [
        '--transpile-only',
        join(backendRoot, 'scripts/publish-reading.ts'),
        '--dry-run',
        '1',
        'moisture_1',
        '42',
        RECORDED_AT,
      ],
      { cwd: backendRoot, encoding: 'utf8' },
    );

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      topic: 'nissim/1/readings',
      payload: {
        sensor: 'moisture_1',
        value: 42,
        recorded_at: RECORDED_AT,
      },
    });
  });

  it('is not imported by Nest source', () => {
    const scriptImport =
      /(?:from|require\()\s*['"][^'"]*scripts\/publish-reading['"]/;
    const offenders = tsFiles(join(__dirname, '..')).filter((file) =>
      scriptImport.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

function tsFiles(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      found.push(...tsFiles(full));
      continue;
    }
    if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) {
      found.push(full);
    }
  }
  return found;
}
