// OperationService — only door that may change the physical world
// (decisions #2, #6, #19). Decision decides; this module actuates.
//
// Max-on timers live in this process. Startup re-arms them from
// desiredState / desiredSince, and shutdown clears them, so a restart
// cannot leave a pump on with no force-off (decision #21).
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Actuator,
  ActuatorState,
  DecisionSource,
} from '../../generated/prisma/client';
import { MqttConnection } from '../mqtt/mqtt.client';
import { PrismaService } from '../prisma/prisma.service';

const MAX_ON_MS = 5000;

@Injectable()
export class OperationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OperationService.name);
  private readonly safetyTimers = new Map<
    number,
    ReturnType<typeof setTimeout>
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mqtt: MqttConnection,
  ) {}

  // Actuators still desired on after a restart have no in-memory timer.
  // Overdue ones are forced off in this method. The rest keep the time
  // left under MAX_ON_MS. A zero delay would be another timer; the
  // overdue path does not use one.
  async onModuleInit(): Promise<void> {
    const actuatorsOn = await this.prisma.actuator.findMany({
      where: { desiredState: 'on' },
    });
    const now = Date.now();

    for (const actuator of actuatorsOn) {
      const elapsed = now - actuator.desiredSince.getTime();
      if (elapsed >= MAX_ON_MS) {
        this.logger.warn(
          `Safety: actuator ${actuator.id} was still desired on at startup, past ${MAX_ON_MS}ms; forcing off`,
        );
        await this.requestActuation({
          actuator,
          nextState: 'off',
          source: 'rule',
        });
        continue;
      }

      this.armSafetyTimer(
        actuator.id,
        'rule',
        Math.max(0, MAX_ON_MS - elapsed),
      );
    }
  }

  // A timeout must not run after Nest has torn this provider down.
  onModuleDestroy(): void {
    for (const timer of this.safetyTimers.values()) {
      clearTimeout(timer);
    }
    this.safetyTimers.clear();
  }

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
      this.armSafetyTimer(actuator.id, source, MAX_ON_MS);
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

  private armSafetyTimer(
    actuatorId: number,
    source: DecisionSource,
    delayMs: number,
  ): void {
    this.clearSafetyTimer(actuatorId);
    this.safetyTimers.set(
      actuatorId,
      setTimeout(() => {
        void this.forceOffAfterMaxOn(actuatorId, source);
      }, delayMs),
    );
  }

  private clearSafetyTimer(actuatorId: number): void {
    const timer = this.safetyTimers.get(actuatorId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.safetyTimers.delete(actuatorId);
    }
  }
}
