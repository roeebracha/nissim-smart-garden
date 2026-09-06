// Ingestion module — MQTT subscriber + IngestionService.
// Imports DecisionModule so this service can inject DecisionService (decision #11).
import { Module } from '@nestjs/common';
import { DecisionModule } from '../decision/decision.module';
import { IngestionService } from './ingestion.service';
import { MqttSubscriber } from './mqtt.subscriber';

@Module({
  imports: [DecisionModule],
  providers: [IngestionService, MqttSubscriber],
})
export class IngestionModule {}
