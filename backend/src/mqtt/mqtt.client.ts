// Shared mqtt.js client — one TCP session to Mosquitto (decisions #16, #19).
// Ingestion subscribes through this. Operation publishes through this.
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import mqtt, { type MqttClient } from 'mqtt';

export type MqttMessageHandler = (
  topic: string,
  payload: Buffer,
) => void | Promise<void>;

type Subscription = {
  filter: string;
  handler: MqttMessageHandler;
};

@Injectable()
export class MqttConnection implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttConnection.name);
  private client: MqttClient | undefined;
  private readonly subscriptions: Subscription[] = [];

  async onModuleInit(): Promise<void> {
    const host = process.env.MQTT_BROKER_HOST;
    const port = process.env.MQTT_BROKER_PORT;
    if (!host || !port) {
      throw new Error('MQTT_BROKER_HOST and MQTT_BROKER_PORT must be set');
    }

    this.client = await mqtt.connectAsync(`mqtt://${host}:${port}`);

    this.client.on('error', (err) => {
      this.logger.error('MQTT client error', errorStack(err));
    });

    this.client.on('message', (topic, payload) => {
      this.dispatch(topic, payload);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.endAsync();
  }

  async subscribe(filter: string, handler: MqttMessageHandler): Promise<void> {
    this.subscriptions.push({ filter, handler });
    await this.requireClient().subscribeAsync(filter);
  }

  async publish(topic: string, payload: unknown): Promise<void> {
    const body =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    await this.requireClient().publishAsync(topic, body);
  }

  private requireClient(): MqttClient {
    if (!this.client) {
      throw new Error('MQTT client is not connected');
    }
    return this.client;
  }

  private dispatch(topic: string, payload: Buffer): void {
    for (const { filter, handler } of this.subscriptions) {
      if (!topicMatches(filter, topic)) {
        continue;
      }
      void Promise.resolve(handler(topic, payload)).catch((err: unknown) => {
        this.logger.error(`MQTT handler failed on ${topic}`, errorStack(err));
      });
    }
  }
}

function errorStack(err: unknown): string {
  return err instanceof Error ? (err.stack ?? err.message) : String(err);
}

function topicMatches(filter: string, topic: string): boolean {
  const filterParts = filter.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < filterParts.length; i++) {
    const part = filterParts[i];
    if (part === '#') {
      return true;
    }
    if (part === '+') {
      if (topicParts[i] === undefined) {
        return false;
      }
      continue;
    }
    if (part !== topicParts[i]) {
      return false;
    }
  }

  return filterParts.length === topicParts.length;
}
