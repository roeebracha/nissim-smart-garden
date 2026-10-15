import {
  ACTUATOR_TYPES,
  GET_RECENT_READINGS,
  SENSOR_TYPES,
  SUGGEST_RULE_CHANGE,
} from './constants';
import { isRecord } from './guards';

// Nest token for the Messages API. The service depends on this contract,
// not on the Anthropic class (decision #5 stays behind the token).
export const MESSAGES_CLIENT = Symbol('MESSAGES_CLIENT');

export const SYSTEM_PROMPT = [
  'You explain a two-planter balcony garden (tea and peppers).',
  'You may read recent sensor values and you may store a pending suggestion to change an automation rule.',
  'get_recent_readings takes planter_id and days. days must be an integer from 1 to 7.',
  'The result is the newest rows by device time (recorded_at), capped.',
  'truncated is true when that cap is hit. covers_from is the oldest recorded_at returned, or null.',
  'Each row has recorded_at (device clock) and received_at (server clock).',
  'suggest_rule_change only stores a pending suggestion. It does not change automation rules and it does not turn a pump or a lamp on or off.',
  'There is no tool that actuates. If the tools are not enough, say so.',
  `A suggestion sensor_type must be one of: ${SENSOR_TYPES.join(', ')}.`,
  `A suggestion actuator_type must be one of: ${ACTUATOR_TYPES.join(', ')}. light is the lamp.`,
  'less_than requires on_threshold below off_threshold.',
  'greater_than requires on_threshold above off_threshold.',
  'If a tool returns an error, correct the arguments and try again.',
].join('\n');

type JsonSchemaProperty = {
  type: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: string[];
};

export type ClaudeTool = {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
  };
};

export const LLM_TOOLS: ClaudeTool[] = [
  {
    name: GET_RECENT_READINGS,
    description:
      'Read recent sensor readings for one planter. days is an integer from 1 to 7. Rows are newest by recorded_at and capped. truncated is true when the cap is hit. covers_from is the oldest recorded_at returned, or null. Each row includes recorded_at and received_at.',
    input_schema: {
      type: 'object',
      properties: {
        planter_id: {
          type: 'integer',
          description: 'Planter id',
          minimum: 1,
        },
        days: {
          type: 'integer',
          description: 'How many days back, from 1 to 7',
          minimum: 1,
          maximum: 7,
        },
      },
      required: ['planter_id', 'days'],
    },
  },
  {
    name: SUGGEST_RULE_CHANGE,
    description:
      'Store a pending suggestion for an automation rule. Does not change the live rule and does not turn anything on or off.',
    input_schema: {
      type: 'object',
      properties: {
        planter_id: { type: 'integer', minimum: 1 },
        sensor_type: {
          type: 'string',
          enum: [...SENSOR_TYPES],
          description: 'moisture, light, or temperature',
        },
        actuator_type: {
          type: 'string',
          enum: [...ACTUATOR_TYPES],
          description: 'pump, or light for the lamp',
        },
        on_threshold: {
          type: 'number',
          description:
            'For less_than, below off_threshold. For greater_than, above it.',
        },
        off_threshold: { type: 'number' },
        operator: { type: 'string', enum: ['less_than', 'greater_than'] },
        summary: {
          type: 'string',
          description: 'Plain-language recommendation shown on the dashboard',
        },
      },
      required: [
        'planter_id',
        'sensor_type',
        'actuator_type',
        'on_threshold',
        'off_threshold',
        'operator',
        'summary',
      ],
    },
  },
];

export type ClaudeTextBlock = { type: 'text'; text: string };

export type ClaudeToolUseBlock = {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type ClaudeContentBlock = ClaudeTextBlock | ClaudeToolUseBlock;

export type ClaudeToolResultBlock = {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};

export type ClaudeMessage =
  | { role: 'user'; content: string | ClaudeToolResultBlock[] }
  | { role: 'assistant'; content: ClaudeContentBlock[] };

export type MessagesRequest = {
  system: string;
  messages: ClaudeMessage[];
  tools: ClaudeTool[];
  maxTokens: number;
};

export type MessagesResponse = {
  stop_reason: string;
  content: ClaudeContentBlock[];
};

export interface MessagesClient {
  create(request: MessagesRequest): Promise<MessagesResponse>;
}

export function textOf(blocks: ClaudeContentBlock[]): string {
  return blocks
    .filter((block): block is ClaudeTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();
}

// Unknown block types (for example a thinking block) are skipped.
// A malformed tool_use fails the whole payload so we never drop a call
// the API will expect a tool_result for.
export function parseMessagesResponse(value: unknown): MessagesResponse | null {
  if (!isRecord(value) || typeof value.stop_reason !== 'string') return null;
  if (!Array.isArray(value.content)) return null;

  const content: ClaudeContentBlock[] = [];
  for (const block of value.content) {
    const parsed = parseBlock(block);
    if (parsed === 'invalid') return null;
    if (parsed !== 'skip') content.push(parsed);
  }
  return { stop_reason: value.stop_reason, content };
}

function parseBlock(value: unknown): ClaudeContentBlock | 'skip' | 'invalid' {
  if (!isRecord(value) || typeof value.type !== 'string') return 'invalid';
  if (value.type === 'text') {
    return typeof value.text === 'string'
      ? { type: 'text', text: value.text }
      : 'invalid';
  }
  if (value.type === 'tool_use') {
    if (typeof value.id !== 'string' || typeof value.name !== 'string') {
      return 'invalid';
    }
    return {
      type: 'tool_use',
      id: value.id,
      name: value.name,
      input: isRecord(value.input) ? value.input : {},
    };
  }
  return 'skip';
}

export async function readJson(response: Response): Promise<unknown> {
  return parseJsonText(await response.text());
}

function parseJsonText(text: string): unknown {
  const value: unknown = JSON.parse(text);
  return value;
}
