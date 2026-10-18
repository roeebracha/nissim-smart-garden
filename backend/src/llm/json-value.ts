import { Prisma } from '../../generated/prisma/client';
import { isRecord } from './guards';

// Prisma's InputJsonValue rejects null (it is ambiguous with DB null).
// A trace still has to be stored, so null becomes the string "null".
export function toInputJson(value: unknown): Prisma.InputJsonValue {
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 'non-finite';
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toInputJson(entry));
  }
  if (isRecord(value)) {
    const out: Record<string, Prisma.InputJsonValue> = {};
    for (const key of Object.keys(value)) {
      const entry = value[key];
      if (entry === undefined) continue;
      out[key] = toInputJson(entry);
    }
    return out;
  }
  if (value === null) return 'null';
  return 'unserializable';
}
