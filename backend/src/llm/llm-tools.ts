// Bounded tools for the agent (decision #2). Read a capped window of
// readings, or insert a pending suggestion. Never update automation
// rules and never actuate.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  hysteresisError,
  ThresholdOperatorName,
} from '../rules/threshold-band';
import {
  ACTUATOR_TYPES,
  GET_RECENT_READINGS,
  MAX_READING_DAYS,
  MAX_READING_ROWS,
  MAX_SUMMARY_CHARS,
  SENSOR_TYPES,
  SUGGEST_RULE_CHANGE,
} from './constants';

type ToolScope = { planterId?: number };

@Injectable()
export class LlmTools {
  constructor(private readonly prisma: PrismaService) {}

  execute(
    name: string,
    input: Record<string, unknown>,
    scope: ToolScope,
  ): Promise<Record<string, unknown>> {
    if (name === GET_RECENT_READINGS) {
      return this.getRecentReadings(input, scope);
    }
    if (name === SUGGEST_RULE_CHANGE) {
      return this.suggestRuleChange(input, scope);
    }
    return Promise.resolve({ error: `unknown tool: ${name}` });
  }

  private async getRecentReadings(
    input: Record<string, unknown>,
    scope: ToolScope,
  ): Promise<Record<string, unknown>> {
    const planterId = parsePlanterId(input.planter_id);
    const days = parseDays(input.days);
    if (planterId === null) {
      return { error: 'planter_id must be a positive integer' };
    }
    if (days === null) {
      return {
        error: `days must be an integer from 1 to ${MAX_READING_DAYS}`,
      };
    }
    if (!planterAllowed(planterId, scope)) {
      return { error: 'planter_id is outside this question' };
    }

    // One clock for the cut, the sort, and covers_from: the device
    // timestamp the model reads. received_at is still returned so a
    // skewed device clock is visible next to server time.
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.sensorReading.findMany({
      where: {
        sensor: { planterId },
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'desc' },
      take: MAX_READING_ROWS,
      select: {
        value: true,
        recordedAt: true,
        receivedAt: true,
        sensor: { select: { name: true, type: true } },
      },
    });

    return {
      planter_id: planterId,
      days,
      truncated: rows.length === MAX_READING_ROWS,
      covers_from: oldestRecordedAt(rows),
      readings: rows.map((row) => ({
        sensor: row.sensor.name,
        type: row.sensor.type,
        value: row.value,
        recorded_at: row.recordedAt.toISOString(),
        received_at: row.receivedAt.toISOString(),
      })),
    };
  }

  private async suggestRuleChange(
    input: Record<string, unknown>,
    scope: ToolScope,
  ): Promise<Record<string, unknown>> {
    const planterId = parsePlanterId(input.planter_id);
    const sensorType = parseOneOf(input.sensor_type, SENSOR_TYPES);
    const actuatorType = parseOneOf(input.actuator_type, ACTUATOR_TYPES);
    const onThreshold = parseFinite(input.on_threshold);
    const offThreshold = parseFinite(input.off_threshold);
    const operator = parseOperator(input.operator);
    const summary = parseSummary(input.summary);

    if (planterId === null) {
      return { error: 'planter_id must be a positive integer' };
    }
    if (sensorType === null) {
      return {
        error: `sensor_type must be one of: ${SENSOR_TYPES.join(', ')}`,
      };
    }
    if (actuatorType === null) {
      return {
        error: `actuator_type must be one of: ${ACTUATOR_TYPES.join(', ')}`,
      };
    }
    if (onThreshold === null || offThreshold === null) {
      return { error: 'on_threshold and off_threshold must be finite numbers' };
    }
    if (operator === null) {
      return { error: 'operator must be less_than or greater_than' };
    }
    if (summary === null) {
      return {
        error: `summary must be a non-empty string up to ${MAX_SUMMARY_CHARS} characters`,
      };
    }
    const bandError = hysteresisError(operator, onThreshold, offThreshold);
    if (bandError !== null) {
      return { error: bandError };
    }
    if (!planterAllowed(planterId, scope)) {
      return { error: 'planter_id is outside this question' };
    }

    const created = await this.prisma.suggestion.create({
      data: {
        status: 'pending',
        planterId,
        sensorType,
        actuatorType,
        onThreshold,
        offThreshold,
        operator,
        summary,
      },
      select: { id: true, status: true },
    });

    return { suggestion_id: created.id, status: created.status };
  }
}

function planterAllowed(planterId: number, scope: ToolScope): boolean {
  return scope.planterId === undefined || scope.planterId === planterId;
}

function parsePlanterId(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return null;
  }
  return value;
}

// Missing, fractional, string, zero, negative, and over-cap days are all
// rejected. Callers must not query when this returns null.
function parseDays(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > MAX_READING_DAYS) return null;
  return value;
}

function oldestRecordedAt(rows: { recordedAt: Date }[]): string | null {
  let oldest: Date | null = null;
  for (const row of rows) {
    if (oldest === null || row.recordedAt < oldest) oldest = row.recordedAt;
  }
  return oldest === null ? null : oldest.toISOString();
}

function parseOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  for (const candidate of allowed) {
    if (candidate === trimmed) return candidate;
  }
  return null;
}

function parseLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function parseFinite(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function parseOperator(value: unknown): ThresholdOperatorName | null {
  if (value === 'less_than' || value === 'greater_than') return value;
  return null;
}

function parseSummary(value: unknown): string | null {
  const summary = parseLabel(value);
  if (summary === null || summary.length > MAX_SUMMARY_CHARS) return null;
  return summary;
}
