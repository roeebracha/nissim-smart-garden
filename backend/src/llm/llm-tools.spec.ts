import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_READING_DAYS,
  MAX_READING_ROWS,
  SUGGEST_RULE_CHANGE,
} from './constants';
import { LlmTools } from './llm-tools';

type ReadingQuery = {
  where: { recordedAt: { gte: Date }; sensor: { planterId: number } };
  take: number;
  orderBy: { recordedAt: 'desc' };
};

type StoredReading = {
  value: number;
  recordedAt: Date;
  receivedAt: Date;
  sensor: { name: string; type: string };
};

function toolsWith(overrides?: { readings?: StoredReading[] }) {
  const findMany = jest.fn<Promise<StoredReading[]>, [ReadingQuery]>();
  findMany.mockResolvedValue(overrides?.readings ?? []);
  const prisma = {
    sensorReading: {
      findMany,
    },
    suggestion: {
      create: jest.fn().mockResolvedValue({ id: 9, status: 'pending' }),
    },
    automationRule: {
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };
  return {
    prisma,
    findMany,
    tools: new LlmTools(prisma as unknown as PrismaService),
  };
}

const suggestionInput = {
  planter_id: 1,
  sensor_type: 'moisture',
  actuator_type: 'pump',
  on_threshold: 20,
  off_threshold: 40,
  operator: 'less_than',
  summary: 'Water the tea planter sooner.',
};

describe('LlmTools.get_recent_readings', () => {
  it.each([undefined, null, '7', 7.5, 0, -1, MAX_READING_DAYS + 1])(
    'does not query for unknown or over-cap days (%s)',
    async (days) => {
      const { prisma, tools } = toolsWith();

      const result = await tools.execute(
        'get_recent_readings',
        { planter_id: 1, days },
        {},
      );

      expect(prisma.sensorReading.findMany).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: `days must be an integer from 1 to ${MAX_READING_DAYS}`,
      });
    },
  );

  it('caps a 7-day window at the newest rows', async () => {
    const recordedAt = new Date('2026-10-01T00:00:00.000Z');
    const receivedAt = new Date('2026-10-01T00:00:05.000Z');
    const { findMany, tools } = toolsWith({
      readings: [
        {
          value: 33,
          recordedAt,
          receivedAt,
          sensor: { name: 'soil', type: 'moisture' },
        },
      ],
    });

    const result = await tools.execute(
      'get_recent_readings',
      { planter_id: 1, days: MAX_READING_DAYS },
      {},
    );

    const query = findMany.mock.calls[0]?.[0];
    expect(query).toBeDefined();
    if (!query) return;
    expect(query.take).toBe(MAX_READING_ROWS);
    expect(query.orderBy).toEqual({ recordedAt: 'desc' });
    expect(query.where.sensor).toEqual({ planterId: 1 });
    const ageMs = Date.now() - query.where.recordedAt.gte.getTime();
    expect(ageMs).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    expect(ageMs).toBeLessThan(7.1 * 24 * 60 * 60 * 1000);
    expect(result).toEqual({
      planter_id: 1,
      days: 7,
      truncated: false,
      covers_from: '2026-10-01T00:00:00.000Z',
      readings: [
        {
          sensor: 'soil',
          type: 'moisture',
          value: 33,
          recorded_at: '2026-10-01T00:00:00.000Z',
          received_at: '2026-10-01T00:00:05.000Z',
        },
      ],
    });
  });

  it('says when the cap is hit and reports the oldest device time', async () => {
    const readings = Array.from({ length: MAX_READING_ROWS }, (_, i) => ({
      value: i,
      recordedAt: new Date(Date.UTC(2026, 9, 1, 0, 0, MAX_READING_ROWS - i)),
      receivedAt: new Date(Date.UTC(2026, 9, 1, 1, 0, i)),
      sensor: { name: 'soil', type: 'moisture' },
    }));
    const { tools } = toolsWith({ readings });

    const result = await tools.execute(
      'get_recent_readings',
      { planter_id: 1, days: 1 },
      {},
    );

    expect(result).toMatchObject({
      truncated: true,
      covers_from: readings[readings.length - 1]?.recordedAt.toISOString(),
    });
  });

  it('reports a null window when nothing was returned', async () => {
    const { tools } = toolsWith();

    const result = await tools.execute(
      'get_recent_readings',
      { planter_id: 1, days: 1 },
      {},
    );

    expect(result).toMatchObject({ truncated: false, covers_from: null });
  });

  it('does not query another planter when the question is scoped', async () => {
    const { prisma, tools } = toolsWith();

    const result = await tools.execute(
      'get_recent_readings',
      { planter_id: 2, days: 1 },
      { planterId: 1 },
    );

    expect(prisma.sensorReading.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ error: 'planter_id is outside this question' });
  });
});

describe('LlmTools.suggest_rule_change', () => {
  it('inserts a pending suggestion and does not touch automation rules', async () => {
    const { prisma, tools } = toolsWith();

    const result = await tools.execute(
      SUGGEST_RULE_CHANGE,
      suggestionInput,
      {},
    );

    expect(result).toEqual({ suggestion_id: 9, status: 'pending' });
    expect(prisma.suggestion.create).toHaveBeenCalledWith({
      data: {
        status: 'pending',
        planterId: 1,
        sensorType: 'moisture',
        actuatorType: 'pump',
        onThreshold: 20,
        offThreshold: 40,
        operator: 'less_than',
        summary: 'Water the tea planter sooner.',
      },
      select: { id: true, status: true },
    });
    expect(prisma.automationRule.create).not.toHaveBeenCalled();
    expect(prisma.automationRule.update).not.toHaveBeenCalled();
    expect(prisma.automationRule.upsert).not.toHaveBeenCalled();
    expect(prisma.automationRule.delete).not.toHaveBeenCalled();
  });

  it.each(['soil_moisture', 'humidity', 'lamp', 'float'])(
    'rejects sensor_type %s before insert',
    async (sensorType) => {
      const { prisma, tools } = toolsWith();

      const result = await tools.execute(
        SUGGEST_RULE_CHANGE,
        { ...suggestionInput, sensor_type: sensorType },
        {},
      );

      expect(prisma.suggestion.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        error: 'sensor_type must be one of: moisture, light, temperature',
      });
    },
  );

  it('rejects actuator_type lamp before insert', async () => {
    const { prisma, tools } = toolsWith();

    const result = await tools.execute(
      SUGGEST_RULE_CHANGE,
      { ...suggestionInput, actuator_type: 'lamp' },
      {},
    );

    expect(prisma.suggestion.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: 'actuator_type must be one of: pump, light',
    });
  });

  it('rejects an inverted less_than band before insert', async () => {
    const { prisma, tools } = toolsWith();

    const result = await tools.execute(
      SUGGEST_RULE_CHANGE,
      { ...suggestionInput, on_threshold: 40, off_threshold: 20 },
      {},
    );

    expect(prisma.suggestion.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      error: 'for less_than, on_threshold must be below off_threshold',
    });
  });

  it('rejects an inverted greater_than band and accepts the matching direction', async () => {
    const { prisma, tools } = toolsWith();

    const inverted = await tools.execute(
      SUGGEST_RULE_CHANGE,
      {
        ...suggestionInput,
        operator: 'greater_than',
        on_threshold: 20,
        off_threshold: 40,
      },
      {},
    );
    expect(inverted).toEqual({
      error: 'for greater_than, on_threshold must be above off_threshold',
    });
    expect(prisma.suggestion.create).not.toHaveBeenCalled();

    const accepted = await tools.execute(
      SUGGEST_RULE_CHANGE,
      {
        ...suggestionInput,
        operator: 'greater_than',
        on_threshold: 40,
        off_threshold: 20,
      },
      {},
    );
    expect(accepted).toEqual({ suggestion_id: 9, status: 'pending' });
    expect(prisma.suggestion.create).toHaveBeenCalledTimes(1);
  });

  it('does not write when the summary is missing', async () => {
    const { prisma, tools } = toolsWith();

    const result = await tools.execute(
      SUGGEST_RULE_CHANGE,
      { ...suggestionInput, summary: '  ' },
      {},
    );

    expect(prisma.suggestion.create).not.toHaveBeenCalled();
    expect(prisma.automationRule.update).not.toHaveBeenCalled();
    expect(result).toHaveProperty('error');
  });
});
