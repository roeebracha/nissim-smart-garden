// Bounded tools for the agent (decision #2). Read a capped window of
// readings, or insert a pending suggestion. Never update automation
// rules and never actuate.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GET_RECENT_READINGS,
  MAX_READING_DAYS,
  MAX_READING_ROWS,
  MAX_SUMMARY_CHARS,
  SUGGEST_RULE_CHANGE,
} from './constants';

type ToolScope = { planterId?: number };

type ThresholdOperatorName = 'less_than' | 'greater_than';

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

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.sensorReading.findMany({
      where: {
        sensor: { planterId },
        receivedAt: { gte: since },
      },
      orderBy: { receivedAt: 'desc' },
      take: MAX_READING_ROWS,
      select: {
        value: true,
        recordedAt: true,
        sensor: { select: { name: true, type: true } },
      },
    });

    return {
      planter_id: planterId,
      days,
      capped_at: MAX_READING_ROWS,
      readings: rows.map((row) => ({
        sensor: row.sensor.name,
        type: row.sensor.type,
        value: row.value,
        recorded_at: row.recordedAt.toISOString(),
      })),
    };
  }

  private async suggestRuleChange(
    input: Record<string, unknown>,
    scope: ToolScope,
  ): Promise<Record<string, unknown>> {
    const planterId = parsePlanterId(input.planter_id);
    const sensorType = parseLabel(input.sensor_type);
    const actuatorType = parseLabel(input.actuator_type);
    const onThreshold = parseFinite(input.on_threshold);
    const offThreshold = parseFinite(input.off_threshold);
    const operator = parseOperator(input.operator);
    const summary = parseSummary(input.summary);

    if (
      planterId === null ||
      sensorType === null ||
      actuatorType === null ||
      onThreshold === null ||
      offThreshold === null ||
      operator === null ||
      summary === null
    ) {
      return {
        error:
          'suggest_rule_change needs planter_id, sensor_type, actuator_type, on_threshold, off_threshold, operator, and summary',
      };
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
