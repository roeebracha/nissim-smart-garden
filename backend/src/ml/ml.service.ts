// MlService — trains only (decision #20). Writes automation_rules
// thresholds from recent readings. Never actuates.
//
// The three class methods below touch Prisma. The three standalone
// functions at the bottom are pure (no DB) so each can be unit-tested with
// a plain array of numbers, no Postgres required.
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AutomationRule,
  ThresholdOperator,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WINDOW_DAYS = 7;
const MIN_SAMPLES = 50;
const MIN_GAP = 5;
const MAX_STEP = 10;
// Low/high cuts for v1. Decision #20 says "a low percentile" and "a higher
// one" and leaves the exact cuts tunable.
const LOW_PERCENTILE = 0.2;
const HIGH_PERCENTILE = 0.8;

// Domain clamp by sensor type (decision #20). Unknown types get hysteresis
// order, gap, and step limit only — no invented numeric range.
const SENSOR_RANGE: Record<string, { min: number; max: number }> = {
  moisture: { min: 0, max: 100 },
  temperature: { min: 0, max: 50 },
  light: { min: 0, max: 100_000 },
};

type ThresholdPair = { onThreshold: number; offThreshold: number };

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Nightly, sequential (decision #20). One rule's failure is logged and
  // skipped so the rest of the batch still runs. A failed job leaves the
  // previous thresholds in place; Decision keeps using them.
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'ml-recalibrate' })
  async recalibrateRules(): Promise<void> {
    const rules = await this.findActiveRules();
    for (const rule of rules) {
      try {
        await this.recalibrateRule(rule);
      } catch (err: unknown) {
        const stack = err instanceof Error ? err.stack : undefined;
        this.logger.error(`recalibrate failed for rule ${rule.id}`, stack);
      }
    }
  }

  // Enabled automation_rules only — mirrors
  // DecisionService.findMatchingRules (decision.service.ts).
  findActiveRules(): Promise<AutomationRule[]> {
    return this.prisma.automationRule.findMany({
      where: { enabled: true },
    });
  }

  // One rule, end to end. Window is server time (`receivedAt`): the device
  // clock on `recordedAt` can be wrong, and this job is about "the last
  // 7 days we actually stored".
  async recalibrateRule(rule: AutomationRule): Promise<void> {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const readings = await this.prisma.sensorReading.findMany({
      where: {
        receivedAt: { gte: since },
        sensor: { planterId: rule.planterId, type: rule.sensorType },
      },
      select: { value: true },
    });

    if (readings.length < MIN_SAMPLES) {
      this.logger.log(
        `skip rule ${rule.id}: ${readings.length} samples < ${MIN_SAMPLES}`,
      );
      return;
    }

    const values = readings
      .map((reading) => reading.value)
      .sort((a, b) => a - b);
    const proposed = deriveThresholds(
      percentile(values, LOW_PERCENTILE),
      percentile(values, HIGH_PERCENTILE),
      rule.operator,
    );
    const next = enforceSafetyLimits(
      proposed,
      { onThreshold: rule.onThreshold, offThreshold: rule.offThreshold },
      rule.operator,
      rule.sensorType,
    );

    await this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        onThreshold: next.onThreshold,
        offThreshold: next.offThreshold,
        updatedBy: 'ml',
      },
    });
  }
}

// Hyndman–Fan type 7 (numpy's default, Excel PERCENTILE.INC):
// h = p * (n - 1), then linear interpolation between floor(h) and ceil(h).
// `values` must already be sorted ascending. `p` is 0–1.
export function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    throw new Error('percentile requires at least one value');
  }
  if (p < 0 || p > 1) {
    throw new Error('percentile p must be between 0 and 1');
  }
  const h = p * (values.length - 1);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) {
    return values[lo];
  }
  return values[lo] + (h - lo) * (values[hi] - values[lo]);
}

// Maps a low/high percentile pair to { onThreshold, offThreshold }
// according to operator direction (decision #20):
//   less_than:    onThreshold = lowPercentile,  offThreshold = highPercentile
//   greater_than: reversed
export function deriveThresholds(
  lowPercentile: number,
  highPercentile: number,
  operator: ThresholdOperator,
): ThresholdPair {
  if (operator === 'less_than') {
    return { onThreshold: lowPercentile, offThreshold: highPercentile };
  }
  return { onThreshold: highPercentile, offThreshold: lowPercentile };
}

// 1. Move each threshold at most MAX_STEP from `previous`.
// 2. Clamp into the sensor domain (may exceed the step — an illegal seed
//    should not stay out of range for weeks).
// 3. Restore hysteresis order and MIN_GAP inside that domain. Gap and
//    domain outrank MAX_STEP when one step cannot satisfy both.
export function enforceSafetyLimits(
  proposed: ThresholdPair,
  previous: ThresholdPair,
  operator: ThresholdOperator,
  sensorType: string,
): ThresholdPair {
  const range = SENSOR_RANGE[sensorType];
  let on = stepToward(previous.onThreshold, proposed.onThreshold);
  let off = stepToward(previous.offThreshold, proposed.offThreshold);
  if (range) {
    on = clamp(on, range.min, range.max);
    off = clamp(off, range.min, range.max);
  }

  if (operator === 'less_than') {
    if (off < on + MIN_GAP) {
      const liftedOff = on + MIN_GAP;
      if (!range || liftedOff <= range.max) {
        off = liftedOff;
      } else {
        off = range.max;
        on = Math.max(range.min, off - MIN_GAP);
      }
    }
  } else if (on < off + MIN_GAP) {
    const liftedOn = off + MIN_GAP;
    if (!range || liftedOn <= range.max) {
      on = liftedOn;
    } else {
      on = range.max;
      off = Math.max(range.min, on - MIN_GAP);
    }
  }

  return { onThreshold: on, offThreshold: off };
}

function stepToward(previous: number, target: number): number {
  const delta = target - previous;
  if (Math.abs(delta) <= MAX_STEP) {
    return target;
  }
  return previous + Math.sign(delta) * MAX_STEP;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
