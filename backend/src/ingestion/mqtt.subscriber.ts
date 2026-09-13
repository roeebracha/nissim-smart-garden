// MqttSubscriber — readings handler only (decisions #10, #16, #19).
// Connect / close live on MqttConnection. This file only maps topic → ingest().
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttConnection } from '../mqtt/mqtt.client';
import { IngestionService } from './ingestion.service';

const READINGS_TOPIC = 'nissim/+/readings';

@Injectable()
export class MqttSubscriber implements OnModuleInit {
  private readonly logger = new Logger(MqttSubscriber.name);

  constructor(
    private readonly mqtt: MqttConnection,
    private readonly ingestion: IngestionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.mqtt.subscribe(READINGS_TOPIC, (topic, payload) =>
      this.handleMessage(topic, payload),
    );
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      const deviceId = parseDeviceIdFromTopic(topic);
      const parsed = parseJsonPayload(payload);
      await this.ingestion.ingest(deviceId, parsed);
    } catch (err) {
      this.logger.error(
        `Dropped reading on ${topic}`,
        err instanceof Error ? (err.stack ?? err.message) : String(err),
      );
    }
  }
}

function parseDeviceIdFromTopic(topic: string): number {
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

function parseJsonPayload(payload: Buffer): unknown {
  return JSON.parse(payload.toString('utf8')) as unknown;
}
