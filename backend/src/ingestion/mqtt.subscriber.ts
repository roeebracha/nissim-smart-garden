// MqttSubscriber — MQTT client for readings (decision #10, #16).
// Owns connect / subscribe / close. Does not validate or save — that is ingest().
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import mqtt, { type MqttClient } from 'mqtt';
import { IngestionService } from './ingestion.service';

const READINGS_TOPIC = 'nissim/+/readings';

@Injectable()
export class MqttSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttSubscriber.name);
  private client: MqttClient | undefined;

  constructor(private readonly ingestion: IngestionService) {}

  onModuleInit(): void {
    const host = process.env.MQTT_BROKER_HOST;
    const port = process.env.MQTT_BROKER_PORT;
    if (!host || !port) {
      throw new Error('MQTT_BROKER_HOST and MQTT_BROKER_PORT must be set');
    }

    this.client = mqtt.connect(`mqtt://${host}:${port}`);

    this.client.on('connect', () => {
      this.client?.subscribe(READINGS_TOPIC, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to ${READINGS_TOPIC}`, err);
        }
      });
    });

    this.client.on('error', (err) => {
      this.logger.error('MQTT client error', err);
    });

    this.client.on('message', (topic, payload) => {
      void this.handleMessage(topic, payload);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.endAsync();
  }

  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      const deviceId = parseDeviceIdFromTopic(topic);
      const parsed = parseJsonPayload(payload);
      await this.ingestion.ingest(deviceId, parsed);
    } catch (err) {
      this.logger.error(`Dropped reading on ${topic}`, err);
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
