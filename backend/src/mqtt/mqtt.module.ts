// MQTT infra module — single shared client (decision #19).
// Same idea as PrismaModule (decision #14): one broker connection.
import { Global, Module } from '@nestjs/common';
import { MqttConnection } from './mqtt.client';

@Global()
@Module({
  providers: [MqttConnection],
  exports: [MqttConnection],
})
export class MqttModule {}
