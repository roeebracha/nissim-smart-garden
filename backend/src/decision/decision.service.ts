// DecisionService — decides if an actuator should flip state (decisions #2, #9, #12).
// Decides only; OperationModule enforces safety and sends the command.
import { Injectable } from '@nestjs/common';
import {
  ActuatorState,
  AutomationRule,
  SensorReading,
  ThresholdOperator,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Ingestion loads the reading with its sensor so Decision can match rules
// without a second lookup. Keep the shape explicit so eslint sees real types
// (not Prisma's default scalar-only SensorReading).
type ReadingWithSensor = SensorReading & {
  sensor: {
    planterId: number;
    type: string;
  };
};

@Injectable()
export class DecisionService {
  constructor(private readonly prisma: PrismaService) {}

  // reading → matching rules → evaluate each
  async evaluate(reading: ReadingWithSensor): Promise<void> {
    const rules = await this.findMatchingRules(reading);
    for (const rule of rules) {
      await this.evaluateRuleAndLog(rule, reading);
    }
  }

  // enabled rules for this planter + sensor type (may be more than one)
  async findMatchingRules(
    reading: ReadingWithSensor,
  ): Promise<AutomationRule[]> {
    return await this.prisma.automationRule.findMany({
      where: {
        planterId: reading.sensor.planterId,
        sensorType: reading.sensor.type,
        enabled: true,
      },
    });
  }

  // one rule: load actuator by desiredState, hysteresis, hand off if changed
  async evaluateRuleAndLog(
    rule: AutomationRule,
    reading: ReadingWithSensor,
  ): Promise<void> {
    const actuator = await this.prisma.actuator.findFirst({
      where: {
        planterId: rule.planterId,
        type: rule.actuatorType,
      },
    });
    if (!actuator) return;

    const nextState = evaluateHysteresis(
      rule.offThreshold,
      rule.onThreshold,
      rule.operator,
      reading.value,
      actuator.desiredState,
    );
    if (nextState !== actuator.desiredState) {
      // TODO: OperationModule
    }
  }
}

// on/off thresholds with hysteresis — uses desiredState, not reportedState
function evaluateHysteresis(
  offThreshold: number,
  onThreshold: number,
  operator: ThresholdOperator,
  value: number,
  currentState: ActuatorState,
): ActuatorState {
  if (currentState === 'off') {
    const shouldTurnOn =
      operator === 'less_than' ? value < onThreshold : value > onThreshold;
    return shouldTurnOn ? 'on' : 'off';
  }

  const shouldTurnOff =
    operator === 'less_than' ? value > offThreshold : value < offThreshold;
  return shouldTurnOff ? 'off' : 'on';
}
