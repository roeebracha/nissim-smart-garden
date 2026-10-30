// IngestionService — one MQTT reading, end to end (decisions #6, #10, #11).
// MQTT subscriber calls ingest() with deviceId from the topic + parsed JSON.
import { Injectable } from '@nestjs/common';
import { DecisionService } from '../decision/decision.service';
import { parseReadingPayload } from '../mqtt/contract';
import { PrismaService } from '../prisma/prisma.service';

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
