// Root NestJS module — wires together Ingestion, API, Decision Engine (rules+ML),
// Operation, and LLM modules. See docs/architecture.md for the layer diagram.
//
// Empty for now - none of those feature modules exist yet (roadmap step 4+).
// This is just the minimal root Nest requires to boot.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { DecisionModule } from './decision/decision.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { OperationModule } from './operation/operation.module';

@Module({
  imports: [
    PrismaModule,
    MqttModule,
    DecisionModule,
    IngestionModule,
    OperationModule,
  ],
})
export class AppModule {}
