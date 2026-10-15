import { MAX_TOOL_CALLS } from './constants';
import { Explanation, runAgentLoop } from './agent-loop';
import { ClaudeTool, MessagesRequest, MessagesResponse } from './messages';

const tools: ClaudeTool[] = [
  {
    name: 'get_recent_readings',
    description: 'test tool',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

function toolUse(id: string): MessagesResponse {
  return {
    stop_reason: 'tool_use',
    content: [
      {
        type: 'tool_use',
        id,
        name: 'get_recent_readings',
        input: { planter_id: 1, days: 2 },
      },
    ],
  };
}

describe('runAgentLoop', () => {
  it('sends the tool result back and then returns the text', async () => {
    const requests: MessagesRequest[] = [];
    const executeTool = jest.fn().mockResolvedValue({ rows: 1 });
    const client = {
      create: jest.fn((request: MessagesRequest) => {
        requests.push(request);
        if (requests.length === 1) return Promise.resolve(toolUse('toolu_1'));
        return Promise.resolve({
          stop_reason: 'end_turn',
          content: [{ type: 'text' as const, text: 'Soil is dry.' }],
        });
      }),
    };

    const result: Explanation = await runAgentLoop({
      client,
      system: 'system',
      tools,
      question: 'How wet is it?',
      executeTool,
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(executeTool).toHaveBeenCalledWith('get_recent_readings', {
      planter_id: 1,
      days: 2,
    });
    expect(result.content).toBe('Soil is dry.');
    expect(result.trace).toEqual([
      {
        name: 'get_recent_readings',
        input: { planter_id: 1, days: 2 },
        output: { rows: 1 },
      },
    ]);

    const followUp = requests[1];
    expect(followUp.messages[1]).toEqual({
      role: 'assistant',
      content: toolUse('toolu_1').content,
    });
    expect(followUp.messages[2]).toEqual({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: 'toolu_1',
          content: JSON.stringify({ rows: 1 }),
        },
      ],
    });
  });

  it('stops at MAX_TOOL_CALLS', async () => {
    expect(MAX_TOOL_CALLS).toBe(5);
    const executeTool = jest.fn().mockResolvedValue({ ok: true });
    let n = 0;
    const client = {
      create: jest.fn(() => {
        n += 1;
        return Promise.resolve(toolUse(`toolu_${n}`));
      }),
    };

    const result = await runAgentLoop({
      client,
      system: 'system',
      tools,
      question: 'Keep going',
      executeTool,
    });

    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_CALLS);
    expect(result.trace).toHaveLength(MAX_TOOL_CALLS);
    const calls = client.create.mock.calls;
    expect(calls.length).toBe(MAX_TOOL_CALLS + 1);
    const last = calls[calls.length - 1]?.[0] as MessagesRequest;
    expect(last.tools).toEqual([]);
  });

  it('does not execute tools past the cap inside one response', async () => {
    const executeTool = jest.fn().mockResolvedValue({ ok: true });
    const many: MessagesResponse = {
      stop_reason: 'tool_use',
      content: Array.from({ length: MAX_TOOL_CALLS + 1 }, (_, i) => ({
        type: 'tool_use' as const,
        id: `toolu_${i}`,
        name: 'get_recent_readings',
        input: { planter_id: 1, days: 1 },
      })),
    };
    const client = {
      create: jest
        .fn()
        .mockResolvedValueOnce(many)
        .mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text' as const, text: 'Enough.' }],
        }),
    };

    const result = await runAgentLoop({
      client,
      system: 'system',
      tools,
      question: 'Batch',
      executeTool,
    });

    expect(executeTool).toHaveBeenCalledTimes(MAX_TOOL_CALLS);
    expect(result.content).toBe('Enough.');
    expect(result.trace).toHaveLength(MAX_TOOL_CALLS);
  });
});
