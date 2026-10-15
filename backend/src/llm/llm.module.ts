// LlmModule — on-demand Claude loop and pending suggestions (decisions
// #2, #5). Does not import Operation, Decision, Ingestion, or ML.
// Prisma is the global module (decision #14); it is not imported again.
import { Module } from '@nestjs/common';
import { AnthropicMessagesClient } from './anthropic-messages.client';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';
import { LlmTools } from './llm-tools';

@Module({
  controllers: [LlmController],
  providers: [LlmService, LlmTools, AnthropicMessagesClient],
})
export class LlmModule {}
