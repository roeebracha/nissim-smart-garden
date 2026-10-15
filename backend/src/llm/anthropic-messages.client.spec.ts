import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AnthropicMessagesClient } from './anthropic-messages.client';
import { ANTHROPIC_MESSAGES_URL, ANTHROPIC_VERSION } from './constants';
import { MessagesRequest } from './messages';

const request: MessagesRequest = {
  system: 'system',
  messages: [{ role: 'user', content: 'Hello' }],
  tools: [],
  maxTokens: 32,
};

function restoreEnv(
  name: 'ANTHROPIC_API_KEY' | 'ANTHROPIC_MODEL',
  previous: string | undefined,
) {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

describe('AnthropicMessagesClient', () => {
  const previousKey = process.env.ANTHROPIC_API_KEY;
  const previousModel = process.env.ANTHROPIC_MODEL;

  afterEach(() => {
    restoreEnv('ANTHROPIC_API_KEY', previousKey);
    restoreEnv('ANTHROPIC_MODEL', previousModel);
  });

  it('does not call fetch when the key or model is missing', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_MODEL;
    const client = new AnthropicMessagesClient();
    const fetchImpl = jest.fn();
    client.fetchImpl = fetchImpl;

    await expect(client.create(request)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the model from the environment and does not use a live host', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'claude-test';
    const client = new AnthropicMessagesClient();
    const fetchImpl = jest.fn<Promise<Response>, [string, RequestInit]>();
    fetchImpl.mockResolvedValue(
      new Response(
        JSON.stringify({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'ok' }],
        }),
        { status: 200 },
      ),
    );
    client.fetchImpl = fetchImpl;

    const result = await client.create(request);

    expect(result).toEqual({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'ok' }],
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(init.method).toBe('POST');
    const headers = new Headers(init.headers);
    expect(headers.get('x-api-key')).toBe('test-key');
    expect(headers.get('anthropic-version')).toBe(ANTHROPIC_VERSION);
    expect(typeof init.body).toBe('string');
    if (typeof init.body !== 'string') {
      throw new Error('expected a string body');
    }
    const payload: unknown = JSON.parse(init.body);
    expect(payload).toEqual({
      model: 'claude-test',
      max_tokens: 32,
      system: 'system',
      messages: [{ role: 'user', content: 'Hello' }],
    });
  });

  it('does not parse a failed response as a successful turn', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'claude-test';
    const client = new AnthropicMessagesClient();
    client.fetchImpl = jest
      .fn()
      .mockResolvedValue(new Response('no', { status: 500 }));

    await expect(client.create(request)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
