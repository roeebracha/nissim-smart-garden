export type AskRequest = {
  question: string;
  planterId?: number;
};

export type ParseResult =
  { ok: true; value: AskRequest } | { ok: false; message: string };

export function parseAskBody(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, message: 'Body must be a JSON object' };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.question !== 'string' || record.question.trim() === '') {
    return { ok: false, message: 'question must be a non-empty string' };
  }

  const question = record.question.trim();
  if (record.planterId === undefined) {
    return { ok: true, value: { question } };
  }
  if (
    typeof record.planterId !== 'number' ||
    !Number.isInteger(record.planterId) ||
    record.planterId < 1
  ) {
    return { ok: false, message: 'planterId must be a positive integer' };
  }
  return { ok: true, value: { question, planterId: record.planterId } };
}
