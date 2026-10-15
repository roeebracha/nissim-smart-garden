// On-demand explanations (decision #2). explain() is the shared entry a
// future daily summary can call. This module does not schedule that job:
// decision #2 allows it and does not name the hour.
import { Injectable } from '@nestjs/common';
import { LlmInsight } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Explanation, runAgentLoop } from './agent-loop';
import { AnthropicMessagesClient } from './anthropic-messages.client';
import { AskRequest } from './ask-body';
import { LLM_TOOLS, SYSTEM_PROMPT } from './messages';
import { toInputJson } from './json-value';
import { LlmTools } from './llm-tools';

@Injectable()
export class LlmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claude: AnthropicMessagesClient,
    private readonly tools: LlmTools,
  ) {}

  explain(input: AskRequest): Promise<Explanation> {
    const question =
      input.planterId === undefined
        ? input.question
        : `This question is about planter ${input.planterId}.\n\n${input.question}`;

    return runAgentLoop({
      client: this.claude,
      system: SYSTEM_PROMPT,
      tools: LLM_TOOLS,
      question,
      executeTool: (name, toolInput) =>
        this.tools.execute(name, toolInput, { planterId: input.planterId }),
    });
  }

  async ask(input: AskRequest): Promise<LlmInsight> {
    const explanation = await this.explain(input);
    return this.prisma.llmInsight.create({
      data: {
        content: explanation.content,
        trace: toInputJson(explanation.trace),
        planterId: input.planterId ?? null,
      },
    });
  }
}
