// Root NestJS module — wires Ingestion, Decision, Operation, ML (calibration).
// LLM / HTTP API are not modules yet. See docs/architecture.md.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { DecisionModule } from './decision/decision.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { OperationModule } from './operation/operation.module';
import { MlModule } from './ml/ml.module';

@Module({
  imports: [
    PrismaModule,
    MqttModule,
    DecisionModule,
    IngestionModule,
    OperationModule,
    MlModule,
  ],
})
export class AppModule {}
