// MlService — trains only (decision #20). Writes automation_rules
// thresholds from recent readings. Never actuates.
//
// The three class methods below touch Prisma. The three standalone
// functions at the bottom are pure (no DB) so each can be unit-tested with
// a plain array of numbers, no Postgres required.
import { Injectable } from '@nestjs/common';
import {
  AutomationRule,
  ThresholdOperator,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WINDOW_DAYS = 7;
const MIN_SAMPLES = 50;
const MIN_GAP = 5;
const MAX_STEP = 10;

type ThresholdPair = { onThreshold: number; offThreshold: number };

@Injectable()
export class MlService {
  constructor(private readonly prisma: PrismaService) {}

  // Entry point for the nightly cron (wire with @Cron once
  // @nestjs/schedule is installed, decision #20). Loads active rules and
  // recalibrates each one in turn (for...of + await) — not in parallel,
  // so DB load stays predictable and one bad rule can't race another.
  //
  // Not marked `async` yet since the body has no `await` — add it back
  // once you call `await this.findActiveRules()` /
  // `await this.recalibrateRule(...)` inside.
  recalibrateRules(): Promise<void> {
    throw new Error('TODO: implement recalibrateRules');
  }

  // Enabled automation_rules only — mirrors
  // DecisionService.findMatchingRules (decision.service.ts).
  findActiveRules(): Promise<AutomationRule[]> {
    throw new Error('TODO: implement findActiveRules');
  }

  // One rule, end to end:
  // - load sensor_readings for rule.planterId + rule.sensorType, limited
  //   to the last WINDOW_DAYS
  // - if fewer than MIN_SAMPLES readings, return without writing anything
  //   (cold start — leave existing seed/ml thresholds as they are)
  // - sort the values, call percentile() twice for a low and high cut
  // - call deriveThresholds() to map those two numbers to on/off by
  //   rule.operator
  // - call enforceSafetyLimits() against the rule's current thresholds
  // - prisma.automationRule.update(...) with the result + updatedBy: 'ml'
  recalibrateRule(rule: AutomationRule): Promise<void> {
    void rule;
    void WINDOW_DAYS;
    void MIN_SAMPLES;
    void percentile;
    void deriveThresholds;
    void enforceSafetyLimits;
    throw new Error('TODO: implement recalibrateRule');
  }
}

// `values` must already be sorted ascending. `p` is 0–1 (e.g. 0.2 for the
// 20th percentile). Pick one interpolation method and say which one in a
// comment here — there is more than one valid definition of "percentile".
function percentile(values: number[], p: number): number {
  void values;
  void p;
  throw new Error('TODO: implement percentile');
}

// Maps a low/high percentile pair to { onThreshold, offThreshold }
// according to operator direction (decision #20):
//   less_than:    onThreshold = lowPercentile,  offThreshold = highPercentile
//   greater_than: reversed
function deriveThresholds(
  lowPercentile: number,
  highPercentile: number,
  operator: ThresholdOperator,
): ThresholdPair {
  void lowPercentile;
  void highPercentile;
  void operator;
  throw new Error('TODO: implement deriveThresholds');
}

// Enforces hysteresis order + MIN_GAP, clamps to a safe range for the
// sensor type, and caps how far `proposed` may move from `previous` in a
// single run (MAX_STEP) so one noisy week can't swing a rule all at once.
function enforceSafetyLimits(
  proposed: ThresholdPair,
  previous: ThresholdPair,
): ThresholdPair {
  void proposed;
  void previous;
  void MIN_GAP;
  void MAX_STEP;
  throw new Error('TODO: implement enforceSafetyLimits');
}
