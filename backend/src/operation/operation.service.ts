// OperationService — only door that may change the physical world
// (decisions #2, #6, #19). Decision decides; this module actuates.
import { Injectable, Logger } from '@nestjs/common';
import {
  Actuator,
  ActuatorState,
  DecisionSource,
} from '../../generated/prisma/client';
import { MqttConnection } from '../mqtt/mqtt.client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ON_MS = 5000;

@Injectable()
export class OperationService {
  private readonly logger = new Logger(OperationService.name);
  private readonly safetyTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttConnection,
  ) {}

  async requestActuation(args: {
    actuator: Actuator;
    nextState: ActuatorState;
    source: DecisionSource;
  }): Promise<void> {
    const { actuator, source } = args;
    let nextState = args.nextState;

    const onTooLong =
      actuator.desiredState === 'on' &&
      Date.now() - actuator.desiredSince.getTime() >= MAX_ON_MS;

    if (nextState === 'on' && onTooLong) {
      this.logger.warn(
        `Safety: actuator ${actuator.id} stayed on longer than ${MAX_ON_MS}ms; forcing off`,
      );
      nextState = 'off';
    }

    if (nextState === actuator.desiredState) {
      return;
    }

    await this.applyState(actuator, nextState, source);
  }

  private async applyState(
    actuator: Actuator,
    nextState: ActuatorState,
    source: DecisionSource,
  ): Promise<void> {
    this.clearSafetyTimer(actuator.id);

    await this.prisma.$transaction([
      this.prisma.actuator.update({
        where: { id: actuator.id },
        data: {
          desiredState: nextState,
          desiredSince: new Date(),
        },
      }),
      this.prisma.actuatorEvent.create({
        data: {
          actuatorId: actuator.id,
          decisionSource: source,
        },
      }),
    ]);

    await this.mqtt.publish(`nissim/${actuator.deviceId}/commands`, {
      actuator: actuator.name,
      state: nextState,
    });

    if (nextState === 'on') {
      this.safetyTimers.set(
        actuator.id,
        setTimeout(() => {
          void this.forceOffAfterMaxOn(actuator.id, source);
        }, MAX_ON_MS),
      );
    }
  }

  private async forceOffAfterMaxOn(
    actuatorId: number,
    source: DecisionSource,
  ): Promise<void> {
    this.safetyTimers.delete(actuatorId);
    const actuator = await this.prisma.actuator.findUnique({
      where: { id: actuatorId },
    });
    if (!actuator || actuator.desiredState !== 'on') {
      return;
    }

    this.logger.warn(
      `Safety: actuator ${actuator.id} hit max on-time (${MAX_ON_MS}ms); forcing off`,
    );
    await this.requestActuation({
      actuator,
      nextState: 'off',
      source,
    });
  }

  private clearSafetyTimer(actuatorId: number): void {
    const timer = this.safetyTimers.get(actuatorId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.safetyTimers.delete(actuatorId);
    }
  }
}
