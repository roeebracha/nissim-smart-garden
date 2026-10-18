// Root NestJS module — wires Ingestion, Decision, Operation, ML, and the
// on-demand LLM. LlmModule does not import Operation (decisions #2, #5).
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { DecisionModule } from './decision/decision.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { OperationModule } from './operation/operation.module';
import { MlModule } from './ml/ml.module';
import { LlmModule } from './llm/llm.module';

@Module({
  imports: [
    PrismaModule,
    MqttModule,
    DecisionModule,
    IngestionModule,
    OperationModule,
    MlModule,
    LlmModule,
  ],
})
export class AppModule {}
