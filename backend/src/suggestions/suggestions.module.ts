// Suggestions module — the thin human-approval API (decision #18 step 2).
//
// Approval is a normal HTTP endpoint, not an interrupt inside the LLM agent
// loop (decision #5). This module does not import Operation, MQTT, Decision,
// Ingestion, or ML. It writes automation_rules only. The next sensor reading
// is what runs Decision (decision #9).
//
// PrismaService comes from the global PrismaModule registered in AppModule
// (decision #14). Do not import PrismaModule here.
import { Module } from '@nestjs/common';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [],
  controllers: [SuggestionsController],
  providers: [SuggestionsService],
})
export class SuggestionsModule {}
