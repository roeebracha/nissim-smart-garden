// HTTP client for the Claude Messages API. The key and model id come
// from the environment (12-factor). Missing config fails before fetch,
// so a test or a boot without a key never calls Claude.
import {
  BadGatewayException,
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  LLM_REQUEST_TIMEOUT_MS,
} from './constants';
import { isRecord } from './guards';
import {
  MessagesClient,
  MessagesRequest,
  MessagesResponse,
  parseMessagesResponse,
  readJson,
} from './messages';

// Optional test seam. The module does not provide this, so production
// uses the global fetch. Service tests fake MessagesClient instead.
export const ANTHROPIC_FETCH = Symbol('ANTHROPIC_FETCH');

@Injectable()
export class AnthropicMessagesClient implements MessagesClient {
  private readonly fetchImpl: typeof fetch;

  constructor(@Optional() @Inject(ANTHROPIC_FETCH) fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async create(request: MessagesRequest): Promise<MessagesResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL;
    if (!apiKey || !model) {
      throw new ServiceUnavailableException(
        'ANTHROPIC_API_KEY and ANTHROPIC_MODEL must be set',
      );
    }

    const body: Record<string, unknown> = {
      model,
      max_tokens: request.maxTokens,
      system: request.system,
      messages: request.messages,
    };
    if (request.tools.length > 0) {
      body.tools = request.tools;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LLM_REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      if (isTimeout(err)) {
        throw new BadGatewayException(
          `Claude request timed out after ${LLM_REQUEST_TIMEOUT_MS}ms`,
        );
      }
      throw err;
    }

    if (!response.ok) {
      throw new BadGatewayException(`Claude API returned ${response.status}`);
    }

    const parsed = parseMessagesResponse(await readJson(response));
    if (!parsed) {
      throw new BadGatewayException(
        'Claude response was not a messages payload',
      );
    }
    return parsed;
  }
}

function isTimeout(err: unknown): boolean {
  return isRecord(err) && err.name === 'TimeoutError';
}
