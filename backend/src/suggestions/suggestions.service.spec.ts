import { MODULE_METADATA } from '@nestjs/common/constants';
import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Suggestion } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SuggestionsModule } from './suggestions.module';
import { SuggestionsService } from './suggestions.service';

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 12,
    status: 'pending',
    planterId: 2,
    sensorType: 'moisture',
    actuatorType: 'pump',
    onThreshold: 31.5,
    offThreshold: 58.25,
    operator: 'less_than',
    summary: 'Water the tea pot when the soil is dry',
    createdAt: new Date('2026-10-15T12:00:00.000Z'),
    updatedAt: new Date('2026-10-15T12:00:00.000Z'),
    ...overrides,
  };
}

function createHarness() {
  const tx = {
    suggestion: {
      updateManyAndReturn: jest.fn(),
      findUnique: jest.fn(),
    },
    automationRule: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    actuatorEvent: {
      create: jest.fn(),
    },
  };
  const prisma = {
    suggestion: {
      findMany: jest.fn(),
    },
    actuatorEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };
  const service = new SuggestionsService(prisma as unknown as PrismaService);
  return { prisma, tx, service };
}

describe('SuggestionsModule', () => {
  it('does not import Operation or MQTT', () => {
    expect(
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, SuggestionsModule),
    ).toEqual([]);
    expect(
      Reflect.getMetadata(MODULE_METADATA.PROVIDERS, SuggestionsModule),
    ).toEqual([SuggestionsService]);

    expect(
      Reflect.getMetadata('design:paramtypes', SuggestionsService),
    ).toEqual([PrismaService]);
  });
});

describe('SuggestionsService', () => {
  it('lists pending suggestions oldest first', async () => {
    const { prisma, service } = createHarness();
    const pending = suggestion();
    prisma.suggestion.findMany.mockResolvedValue([pending]);

    await expect(service.listPending()).resolves.toEqual([pending]);
    expect(prisma.suggestion.findMany).toHaveBeenCalledWith({
      where: { status: 'pending' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approves a pending suggestion and copies thresholds onto the rule', async () => {
    const { tx, prisma, service } = createHarness();
    const pending = suggestion({
      operator: 'greater_than',
      onThreshold: 58.25,
      offThreshold: 31.5,
    });
    const approved = suggestion({
      ...pending,
      status: 'approved',
      updatedAt: new Date('2026-10-15T12:05:00.000Z'),
    });
    tx.suggestion.updateManyAndReturn.mockResolvedValue([approved]);

    await expect(service.approve(pending.id)).resolves.toEqual(approved);

    expect(tx.suggestion.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: pending.id, status: 'pending' },
      data: { status: 'approved' },
    });
    expect(tx.suggestion.findUnique).not.toHaveBeenCalled();
    expect(tx.automationRule.upsert).toHaveBeenCalledWith({
      where: {
        planterId_sensorType_actuatorType: {
          planterId: pending.planterId,
          sensorType: pending.sensorType,
          actuatorType: pending.actuatorType,
        },
      },
      create: {
        name: pending.summary,
        sensorType: pending.sensorType,
        actuatorType: pending.actuatorType,
        onThreshold: pending.onThreshold,
        offThreshold: pending.offThreshold,
        operator: pending.operator,
        updatedBy: 'seed',
        enabled: true,
        planterId: pending.planterId,
      },
      update: {
        onThreshold: pending.onThreshold,
        offThreshold: pending.offThreshold,
        operator: pending.operator,
        updatedBy: 'seed',
      },
    });
    expect(tx.actuatorEvent.create).not.toHaveBeenCalled();
    expect(prisma.actuatorEvent.create).not.toHaveBeenCalled();
  });

  it('does not write the rule again on a second approve', async () => {
    const { tx, prisma, service } = createHarness();
    const pending = suggestion();
    let stored = pending;
    tx.suggestion.updateManyAndReturn.mockImplementation(() => {
      if (stored.status !== 'pending') {
        return Promise.resolve([]);
      }
      stored = {
        ...stored,
        status: 'approved',
        updatedAt: new Date('2026-10-15T12:05:00.000Z'),
      };
      return Promise.resolve([stored]);
    });
    tx.suggestion.findUnique.mockImplementation(() =>
      Promise.resolve({ id: stored.id }),
    );

    await service.approve(pending.id);
    await expect(service.approve(pending.id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(tx.automationRule.upsert).toHaveBeenCalledTimes(1);
    expect(tx.actuatorEvent.create).not.toHaveBeenCalled();
    expect(prisma.actuatorEvent.create).not.toHaveBeenCalled();
  });

  it('fails when the suggestion id does not exist', async () => {
    const { tx, service } = createHarness();
    tx.suggestion.updateManyAndReturn.mockResolvedValue([]);
    tx.suggestion.findUnique.mockResolvedValue(null);

    await expect(service.approve(99)).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.suggestion.findUnique).toHaveBeenCalledWith({
      where: { id: 99 },
      select: { id: true },
    });
    expect(tx.automationRule.upsert).not.toHaveBeenCalled();
    expect(tx.actuatorEvent.create).not.toHaveBeenCalled();
  });

  it('rejects an inverted band and does not write the rule', async () => {
    const { tx, service } = createHarness();
    // Explicitly illegal: less_than requires on below off. The throw is
    // inside the transaction callback, which is what rolls the claim back.
    const claimed = suggestion({
      status: 'approved',
      operator: 'less_than',
      onThreshold: 58.25,
      offThreshold: 31.5,
    });
    tx.suggestion.updateManyAndReturn.mockResolvedValue([claimed]);

    await expect(service.approve(claimed.id)).rejects.toThrow(
      new UnprocessableEntityException(
        'for less_than, on_threshold must be below off_threshold',
      ),
    );
    expect(tx.automationRule.upsert).not.toHaveBeenCalled();
    expect(tx.actuatorEvent.create).not.toHaveBeenCalled();
  });
});
