// Hand-written Claude Messages loop (decision #5). One turn: send
// messages, read stop_reason, run a tool, send tool_result. Stop after
// MAX_TOOL_CALLS executions. No framework and no actuator tool.
import { MAX_OUTPUT_TOKENS, MAX_TOOL_CALLS } from './constants';
import {
  ClaudeMessage,
  ClaudeTool,
  ClaudeToolResultBlock,
  ClaudeToolUseBlock,
  MessagesClient,
  MessagesResponse,
  textOf,
} from './messages';

export type ToolTraceEntry = {
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type Explanation = {
  content: string;
  trace: ToolTraceEntry[];
};

export async function runAgentLoop(args: {
  client: MessagesClient;
  system: string;
  tools: ClaudeTool[];
  question: string;
  executeTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  maxToolCalls?: number;
  maxTokens?: number;
}): Promise<Explanation> {
  const maxToolCalls = args.maxToolCalls ?? MAX_TOOL_CALLS;
  const maxTokens = args.maxTokens ?? MAX_OUTPUT_TOKENS;
  const messages: ClaudeMessage[] = [{ role: 'user', content: args.question }];
  const trace: ToolTraceEntry[] = [];
  let toolCalls = 0;

  if (maxToolCalls <= 0) {
    const response = await args.client.create({
      system: args.system,
      messages,
      tools: [],
      maxTokens,
    });
    return { content: answerOrThrow(response), trace };
  }

  for (let round = 0; round < maxToolCalls; round += 1) {
    const response = await args.client.create({
      system: args.system,
      messages,
      tools: args.tools,
      maxTokens,
    });
    const toolUses = toolUseBlocks(response);
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { content: answerOrThrow(response), trace };
    }

    messages.push({ role: 'assistant', content: response.content });
    const results: ClaudeToolResultBlock[] = [];
    for (const call of toolUses) {
      if (toolCalls >= maxToolCalls) {
        results.push(cappedResult(call.id));
        continue;
      }
      toolCalls += 1;
      const output = await runOne(args.executeTool, call.name, call.input);
      trace.push({ name: call.name, input: call.input, output });
      results.push(toolResult(call.id, output));
    }
    messages.push({ role: 'user', content: results });

    if (toolCalls >= maxToolCalls) {
      const finalResponse = await args.client.create({
        system: args.system,
        messages,
        tools: [],
        maxTokens,
      });
      return { content: answerOrThrow(finalResponse), trace };
    }
  }

  // Every round that continues executes at least one tool, so a finished
  // cap returns above. Landing here means the loop lost track of that.
  throw new Error('agent loop ended without a final answer');
}

function answerOrThrow(response: MessagesResponse): string {
  const content = textOf(response.content);
  if (content === '') {
    throw new Error('agent loop ended without a final answer');
  }
  return content;
}

function toolUseBlocks(response: MessagesResponse): ClaudeToolUseBlock[] {
  return response.content.filter(
    (block): block is ClaudeToolUseBlock => block.type === 'tool_use',
  );
}

async function runOne(
  executeTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>,
  name: string,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    return await executeTool(name, input);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'tool failed';
    return { error: message };
  }
}

function toolResult(
  toolUseId: string,
  output: Record<string, unknown>,
): ClaudeToolResultBlock {
  const failed = typeof output.error === 'string';
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: JSON.stringify(output),
    ...(failed ? { is_error: true } : {}),
  };
}

function cappedResult(toolUseId: string): ClaudeToolResultBlock {
  return {
    type: 'tool_result',
    tool_use_id: toolUseId,
    content: JSON.stringify({ error: 'max_tool_calls reached' }),
    is_error: true,
  };
}
