import { LlmInsight, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicMessagesClient } from './anthropic-messages.client';
import { LlmService } from './llm.service';
import { LlmTools } from './llm-tools';
import { MessagesRequest, MessagesResponse } from './messages';

function endTurn(text: string): MessagesResponse {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
  };
}

describe('LlmService', () => {
  const created: LlmInsight = {
    id: 4,
    content: 'The tea planter is dry.',
    trace: [],
    createdAt: new Date('2026-10-15T00:00:00.000Z'),
    planterId: 1,
  };

  function setup() {
    const create = jest.fn<
      Promise<LlmInsight>,
      [
        {
          data: {
            content: string;
            trace: Prisma.InputJsonValue;
            planterId: number | null;
          };
        },
      ]
    >();
    create.mockResolvedValue(created);
    const prisma = {
      llmInsight: {
        create,
      },
    };
    const claude = {
      create: jest.fn((request: MessagesRequest) => {
        if (request.messages.length === 1) {
          return Promise.resolve({
            stop_reason: 'tool_use',
            content: [
              {
                type: 'tool_use' as const,
                id: 'toolu_1',
                name: 'suggest_rule_change',
                input: { planter_id: 1 },
              },
            ],
          });
        }
        return Promise.resolve(endTurn('The tea planter is dry.'));
      }),
    };
    const tools = {
      execute: jest.fn().mockResolvedValue({
        suggestion_id: 9,
        status: 'pending',
      }),
    };
    const service = new LlmService(
      prisma as unknown as PrismaService,
      claude as unknown as AnthropicMessagesClient,
      tools as unknown as LlmTools,
    );
    return { prisma, create, claude, tools, service };
  }

  it('explain does not persist an insight', async () => {
    const { prisma, service } = setup();

    const explanation = await service.explain({
      question: 'Should I change the threshold?',
      planterId: 1,
    });

    expect(explanation.content).toBe('The tea planter is dry.');
    expect(explanation.trace).toEqual([
      {
        name: 'suggest_rule_change',
        input: { planter_id: 1 },
        output: { suggestion_id: 9, status: 'pending' },
      },
    ]);
    expect(prisma.llmInsight.create).not.toHaveBeenCalled();
  });

  it('ask stores the answer and the trace in separate columns', async () => {
    const { prisma, create, service } = setup();

    await service.ask({
      question: 'Should I change the threshold?',
      planterId: 1,
    });

    expect(prisma.llmInsight.create).toHaveBeenCalledTimes(1);
    const written = create.mock.calls[0]?.[0];
    expect(written).toBeDefined();
    if (!written) return;
    const data = written;
    expect(data.data.content).toBe('The tea planter is dry.');
    expect(data.data.content).not.toContain('suggest_rule_change');
    expect(data.data.trace).toEqual([
      {
        name: 'suggest_rule_change',
        input: { planter_id: 1 },
        output: { suggestion_id: 9, status: 'pending' },
      },
    ]);
    expect(data.data.planterId).toBe(1);
  });
});
