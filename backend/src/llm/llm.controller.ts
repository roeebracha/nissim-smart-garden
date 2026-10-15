// POST /llm/ask — on-demand entry (decision #2). Approval is a different
// route and is not implemented here.
import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { LlmInsight } from '../../generated/prisma/client';
import { parseAskBody } from './ask-body';
import { LlmService } from './llm.service';

@Controller('llm')
export class LlmController {
  constructor(private readonly llm: LlmService) {}

  @Post('ask')
  ask(@Body() body: unknown): Promise<LlmInsight> {
    const parsed = parseAskBody(body);
    if (!parsed.ok) {
      throw new BadRequestException(parsed.message);
    }
    return this.llm.ask(parsed.value);
  }
}
