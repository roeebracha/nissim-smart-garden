// Mock MQTT publisher (decisions #10, #16) — not Nest, not the subscriber.
// Stand-in for the ESP32 until firmware exists. One publish, then exit.
//
// Topic:   nissim/<device_id>/readings
// Payload: { sensor, value, recorded_at }  — sensor is Sensor.name, not the DB id.
//
// Run from the host against compose Mosquitto (localhost:1883), not the
// "mosquitto" hostname (that name only works inside the compose network):
//
//   npx ts-node scripts/publish-reading.ts <deviceId> <sensor> <value> [recordedAt]
//
// --dry-run prints the topic and JSON and does not open a socket. CI uses
// that path. device_id must already exist as Device.id; sensor must exist
// as Sensor.name on that device, or ingest() will reject the message.
import mqtt from 'mqtt';
import { buildReadingPayload, readingsTopic } from '../src/mqtt/contract';
import { parsePublishReadingArgs } from '../src/mqtt/publish-reading-args';

async function publishOnce(topic: string, body: string): Promise<void> {
  const host = process.env.MQTT_BROKER_HOST ?? 'localhost';
  const port = process.env.MQTT_BROKER_PORT ?? '1883';
  const client = await mqtt.connectAsync(`mqtt://${host}:${port}`, {
    reconnectPeriod: 0,
    connectTimeout: 5_000,
  });
  try {
    await client.publishAsync(topic, body);
  } finally {
    await client.endAsync();
  }
}

async function main(): Promise<void> {
  const args = parsePublishReadingArgs(process.argv.slice(2));
  const topic = readingsTopic(args.deviceId);
  const payload = buildReadingPayload({
    sensor: args.sensor,
    value: args.value,
    recordedAt: args.recordedAt,
  });
  if (args.dryRun) {
    process.stdout.write(`${JSON.stringify({ topic, payload })}\n`);
    return;
  }
  await publishOnce(topic, JSON.stringify(payload));
}

if (require.main === module) {
  void main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
