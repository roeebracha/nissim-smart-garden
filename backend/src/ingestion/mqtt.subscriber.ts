// MqttSubscriber — readings handler only (decisions #10, #16, #19).
// Connect / close live on MqttConnection. This file only maps topic → ingest().
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { MqttConnection } from '../mqtt/mqtt.client';
import {
  READINGS_SUBSCRIPTION,
  parseDeviceIdFromTopic,
} from '../mqtt/contract';
import { IngestionService } from './ingestion.service';

@Injectable()
export class MqttSubscriber implements OnModuleInit {
  private readonly logger = new Logger(MqttSubscriber.name);

  constructor(
    private readonly mqtt: MqttConnection,
    private readonly ingestion: IngestionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.mqtt.subscribe(READINGS_SUBSCRIPTION, (topic, payload) =>
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

function parseJsonPayload(payload: Buffer): unknown {
  return JSON.parse(payload.toString('utf8')) as unknown;
}
