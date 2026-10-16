// Root NestJS module — wires Ingestion, Decision, Operation, ML (calibration),
// and the read-only garden HTTP API. LLM and suggestion approval are separate
// branches and are not imported here.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { DecisionModule } from './decision/decision.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { OperationModule } from './operation/operation.module';
import { MlModule } from './ml/ml.module';
import { GardenModule } from './garden/garden.module';

@Module({
  imports: [
    PrismaModule,
    MqttModule,
    DecisionModule,
    IngestionModule,
    OperationModule,
    MlModule,
    GardenModule,
  ],
})
export class AppModule {}
