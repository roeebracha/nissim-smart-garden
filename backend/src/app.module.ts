// Root NestJS module — wires Ingestion, Decision, Operation, ML (calibration),
// the on-demand LLM, and the suggestion approve API (decision #18 step 2).
// LlmModule does not import Operation (decisions #2, #5). SuggestionsModule
// does not either: approval only writes automation_rules.
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { MqttModule } from './mqtt/mqtt.module';
import { DecisionModule } from './decision/decision.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { OperationModule } from './operation/operation.module';
import { MlModule } from './ml/ml.module';
import { LlmModule } from './llm/llm.module';
import { SuggestionsModule } from './suggestions/suggestions.module';

@Module({
  imports: [
    PrismaModule,
    MqttModule,
    DecisionModule,
    IngestionModule,
    OperationModule,
    MlModule,
    LlmModule,
    SuggestionsModule,
  ],
})
export class AppModule {}
