// IngestionService — one MQTT reading, end to end (decisions #6, #10, #11).
// MQTT subscriber calls ingest() with deviceId from the topic + parsed JSON.
import { Injectable } from '@nestjs/common';
import { DecisionService } from '../decision/decision.service';
import { PrismaService } from '../prisma/prisma.service';

type ParsedReading = {
  sensorName: string;
  value: number;
  recordedAt: Date;
};

@Injectable()
export class IngestionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly decision: DecisionService,
  ) {}

  async ingest(deviceId: number, payload: unknown): Promise<void> {
    const parsed = parseReadingPayload(payload);

    const sensor = await this.prisma.sensor.findFirst({
      where: { deviceId, name: parsed.sensorName },
    });
    if (!sensor) {
      throw new Error(
        `Unknown sensor "${parsed.sensorName}" for device ${deviceId}`,
      );
    }

    const reading = await this.prisma.sensorReading.create({
      data: {
        value: parsed.value,
        recordedAt: parsed.recordedAt,
        sensorId: sensor.id,
      },
      include: { sensor: true },
    });

    await this.decision.evaluate(reading);
  }
}

function parseReadingPayload(payload: unknown): ParsedReading {
  if (payload === null || typeof payload !== 'object') {
    throw new Error('Reading payload must be an object');
  }

  const record = payload as Record<string, unknown>;
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
