import { AutomationRule } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  MlService,
  deriveThresholds,
  enforceSafetyLimits,
  percentile,
} from './ml.service';

describe('percentile', () => {
  // type 7: h = p * (n - 1). [0, 10, 20] at p=0.5 lands on index 1.
  it('interpolates between neighbours', () => {
    expect(percentile([0, 10, 20], 0.5)).toBe(10);
    expect(percentile([0, 10, 20], 0.25)).toBe(5);
  });

  it('rejects an empty sample or a p outside 0–1', () => {
    expect(() => percentile([], 0.5)).toThrow();
    expect(() => percentile([1], 1.1)).toThrow();
  });
});

describe('deriveThresholds', () => {
  it('puts the low cut on "on" for less_than and reverses greater_than', () => {
    expect(deriveThresholds(20, 60, 'less_than')).toEqual({
      onThreshold: 20,
      offThreshold: 60,
    });
    expect(deriveThresholds(20, 60, 'greater_than')).toEqual({
      onThreshold: 60,
      offThreshold: 20,
    });
  });
});

describe('enforceSafetyLimits', () => {
  const previous = { onThreshold: 30, offThreshold: 50 };

  it('caps a single run at MAX_STEP', () => {
    expect(
      enforceSafetyLimits(
        { onThreshold: 5, offThreshold: 90 },
        previous,
        'less_than',
        'moisture',
      ),
    ).toEqual({ onThreshold: 20, offThreshold: 60 });
  });

  it('restores less_than order and the minimum gap', () => {
    // Within one step the proposal stays inverted (40/32). Gap repair
    // lifts off to on + 5.
    expect(
      enforceSafetyLimits(
        { onThreshold: 40, offThreshold: 32 },
        { onThreshold: 38, offThreshold: 36 },
        'less_than',
        'moisture',
      ),
    ).toEqual({ onThreshold: 40, offThreshold: 45 });
  });

  it('clamps moisture into 0–100 and keeps a gap at the ceiling', () => {
    expect(
      enforceSafetyLimits(
        { onThreshold: 150, offThreshold: 160 },
        { onThreshold: 98, offThreshold: 99 },
        'less_than',
        'moisture',
      ),
    ).toEqual({ onThreshold: 95, offThreshold: 100 });
  });

  it('keeps greater_than on above off', () => {
    // off steps 30 → 40, on steps 12 → 10, then on is lifted to off + 5.
    expect(
      enforceSafetyLimits(
        { onThreshold: 10, offThreshold: 40 },
        { onThreshold: 12, offThreshold: 30 },
        'greater_than',
        'temperature',
      ),
    ).toEqual({ onThreshold: 45, offThreshold: 40 });
  });
});

describe('MlService.recalibrateRule', () => {
  function rule(overrides: Partial<AutomationRule> = {}): AutomationRule {
    return {
      id: 7,
      name: 'moisture-pump',
      sensorType: 'moisture',
      actuatorType: 'pump',
      onThreshold: 10,
      offThreshold: 40,
      updatedBy: 'seed',
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      operator: 'less_than',
      enabled: true,
      planterId: 1,
      ...overrides,
    };
  }

  function samples(count: number): { value: number }[] {
    return Array.from({ length: count }, (_, i) => ({ value: i }));
  }

  function serviceWith(readings: { value: number }[]) {
    const prisma = {
      automationRule: {
        findMany: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      sensorReading: {
        findMany: jest.fn().mockResolvedValue(readings),
      },
    };
    return {
      prisma,
      service: new MlService(prisma as unknown as PrismaService),
    };
  }

  it('does not write when the window has fewer than 50 samples', async () => {
    const { prisma, service } = serviceWith(samples(49));

    await service.recalibrateRule(rule());

    expect(prisma.automationRule.update).not.toHaveBeenCalled();
  });

  it('writes ml thresholds from the 20th and 80th percentiles', async () => {
    const { prisma, service } = serviceWith(samples(50));

    await service.recalibrateRule(rule());

    expect(prisma.sensorReading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sensor: { planterId: 1, type: 'moisture' },
        }) as unknown,
      }),
    );
    const since = (
      prisma.sensorReading.findMany.mock.calls as [
        [{ where: { receivedAt: { gte: Date } } }],
      ]
    )[0][0].where.receivedAt.gte;
    const ageMs = Date.now() - since.getTime();
    expect(ageMs).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);

    // values 0..49, type 7: p=0.2 → 9.8, p=0.8 → 39.2. Previous 10/40
    // is within one step, inside 0–100, and the gap holds.
    expect(prisma.automationRule.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        onThreshold: 9.8,
        offThreshold: 39.2,
        updatedBy: 'ml',
      },
    });
  });

  it('continues the batch when one rule fails', async () => {
    const prisma = {
      automationRule: {
        findMany: jest
          .fn()
          .mockResolvedValue([rule({ id: 1 }), rule({ id: 2 })]),
        update: jest.fn().mockResolvedValue({}),
      },
      sensorReading: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(samples(50))
          .mockRejectedValueOnce(new Error('db down')),
      },
    };
    const service = new MlService(prisma as unknown as PrismaService);

    await service.recalibrateRules();

    expect(prisma.automationRule.update).toHaveBeenCalledTimes(1);
    expect(prisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
  });
});
