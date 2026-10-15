import { Logger } from '@nestjs/common';
import { Actuator } from '../../generated/prisma/client';
import { MqttConnection } from '../mqtt/mqtt.client';
import { PrismaService } from '../prisma/prisma.service';
import { OperationService } from './operation.service';

const NOW = new Date('2026-10-16T03:00:00.000Z');
const MAX_ON_MS = 5000;

function actuator(overrides: Partial<Actuator> = {}): Actuator {
  return {
    id: 1,
    name: 'pump',
    type: 'pump',
    desiredState: 'on',
    desiredSince: new Date(NOW.getTime() - 1000),
    reportedState: 'off',
    reportedAt: new Date('2026-10-16T02:00:00.000Z'),
    planterId: 1,
    deviceId: 3,
    ...overrides,
  };
}

function harness(onStartup: Actuator[]) {
  const byId = new Map(onStartup.map((row) => [row.id, row]));
  const prisma = {
    actuator: {
      findMany: jest.fn().mockResolvedValue(onStartup),
      findUnique: jest.fn((args: { where: { id: number } }) =>
        Promise.resolve(byId.get(args.where.id) ?? null),
      ),
      update: jest.fn().mockResolvedValue({}),
    },
    actuatorEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const publish = jest.fn().mockResolvedValue(undefined);
  const service = new OperationService(
    prisma as unknown as PrismaService,
    { publish } as unknown as MqttConnection,
  );
  return { service, prisma, publish };
}

function expectForcedOff(
  prisma: ReturnType<typeof harness>['prisma'],
  publish: ReturnType<typeof harness>['publish'],
  row: Actuator,
  desiredSince: Date,
): void {
  expect(prisma.actuator.update).toHaveBeenCalledWith({
    where: { id: row.id },
    data: {
      desiredState: 'off',
      desiredSince,
    },
  });
  expect(prisma.actuatorEvent.create).toHaveBeenCalledWith({
    data: {
      actuatorId: row.id,
      decisionSource: 'rule',
    },
  });
  expect(prisma.$transaction).toHaveBeenCalled();
  expect(publish).toHaveBeenCalledWith(`nissim/${row.deviceId}/commands`, {
    actuator: row.name,
    state: 'off',
  });
}

describe('OperationService max-on re-arm', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: NOW.getTime() });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('forces an overdue desired-on actuator off during startup', async () => {
    const pump = actuator({
      desiredSince: new Date(NOW.getTime() - MAX_ON_MS - 1000),
    });
    const { service, prisma, publish } = harness([pump]);

    await service.onModuleInit();

    expect(prisma.actuator.findMany).toHaveBeenCalledWith({
      where: { desiredState: 'on' },
    });
    expectForcedOff(prisma, publish, pump, NOW);
    expect(jest.getTimerCount()).toBe(0);
    expect(prisma.actuator.findUnique).not.toHaveBeenCalled();
  });

  it('forces off immediately when desiredSince is exactly MAX_ON_MS ago', async () => {
    const pump = actuator({
      desiredSince: new Date(NOW.getTime() - MAX_ON_MS),
    });
    const { service, prisma, publish } = harness([pump]);

    await service.onModuleInit();

    expectForcedOff(prisma, publish, pump, NOW);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('schedules the remaining max-on time and then forces off', async () => {
    const elapsed = 1000;
    const pump = actuator({
      desiredSince: new Date(NOW.getTime() - elapsed),
    });
    const { service, prisma, publish } = harness([pump]);

    await service.onModuleInit();

    expect(publish).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(MAX_ON_MS - elapsed - 1);
    expect(publish).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);

    expectForcedOff(
      prisma,
      publish,
      pump,
      new Date(NOW.getTime() + (MAX_ON_MS - elapsed)),
    );
  });

  it('does not arm a timer when every actuator is desired off', async () => {
    const { service, prisma, publish } = harness([]);

    await service.onModuleInit();

    expect(prisma.actuator.findMany).toHaveBeenCalledWith({
      where: { desiredState: 'on' },
    });
    expect(jest.getTimerCount()).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('drops a pending re-arm timer on destroy so force-off does not run', async () => {
    const pump = actuator({
      desiredSince: new Date(NOW.getTime() - 1000),
    });
    const { service, prisma, publish } = harness([pump]);

    await service.onModuleInit();
    expect(jest.getTimerCount()).toBe(1);

    service.onModuleDestroy();

    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(MAX_ON_MS);
    expect(prisma.actuator.findUnique).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('re-arms an overdue pump immediately and a recent pump for the remainder', async () => {
    const overdue = actuator({
      id: 1,
      name: 'tea-pump',
      planterId: 1,
      desiredSince: new Date(NOW.getTime() - 8000),
    });
    const recent = actuator({
      id: 2,
      name: 'pepper-pump',
      planterId: 2,
      desiredSince: new Date(NOW.getTime() - 1000),
    });
    const { service, prisma, publish } = harness([overdue, recent]);

    await service.onModuleInit();

    expectForcedOff(prisma, publish, overdue, NOW);
    expect(publish).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(4000);

    expectForcedOff(prisma, publish, recent, new Date(NOW.getTime() + 4000));
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('arms a full max-on timer when requestActuation turns a pump on', async () => {
    const pump = actuator({
      desiredState: 'off',
      desiredSince: new Date(NOW.getTime() - 60_000),
    });
    const turnedOn = actuator({ desiredState: 'on', desiredSince: NOW });
    const { service, prisma, publish } = harness([]);
    prisma.actuator.findUnique.mockResolvedValue(turnedOn);

    await service.requestActuation({
      actuator: pump,
      nextState: 'on',
      source: 'rule',
    });

    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith('nissim/3/commands', {
      actuator: 'pump',
      state: 'on',
    });
    expect(jest.getTimerCount()).toBe(1);

    await jest.advanceTimersByTimeAsync(MAX_ON_MS - 1);
    expect(publish).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);

    expectForcedOff(
      prisma,
      publish,
      turnedOn,
      new Date(NOW.getTime() + MAX_ON_MS),
    );
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('clears a timer armed by requestActuation when the module is destroyed', async () => {
    const pump = actuator({
      desiredState: 'off',
      desiredSince: new Date(NOW.getTime() - 60_000),
    });
    const { service, prisma, publish } = harness([]);

    await service.requestActuation({
      actuator: pump,
      nextState: 'on',
      source: 'rule',
    });
    expect(jest.getTimerCount()).toBe(1);

    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(MAX_ON_MS);

    expect(publish).toHaveBeenCalledTimes(1);
    expect(prisma.actuator.findUnique).not.toHaveBeenCalled();
    expect(prisma.actuatorEvent.create).toHaveBeenCalledTimes(1);
  });
});
