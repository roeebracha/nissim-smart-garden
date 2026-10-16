// Read-only garden queries for the dashboard (decision 18 step 4, decision 24).
// This module does not actuate and does not import Operation.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const READING_CAP = 2000;

export type ReadingPoint = {
  id: number;
  value: number;
  recordedAt: Date;
  receivedAt: Date;
};

export type SensorView = {
  id: number;
  name: string;
  type: string;
  latestReading: ReadingPoint | null;
};

export type ActuatorView = {
  id: number;
  name: string;
  type: string;
  planterId: number;
  desiredState: 'on' | 'off';
  desiredSince: Date;
  reportedState: 'on' | 'off';
  reportedAt: Date;
};

export type PlanterView = {
  id: number;
  name: string;
  sensors: SensorView[];
  actuators: ActuatorView[];
};

@Injectable()
export class GardenService {
  constructor(private readonly prisma: PrismaService) {}

  async listPlanters(): Promise<PlanterView[]> {
    const planters = await this.prisma.planter.findMany({
      orderBy: { id: 'asc' },
      include: {
        sensors: {
          orderBy: { id: 'asc' },
          include: {
            readings: {
              orderBy: { recordedAt: 'desc' },
              take: 1,
            },
          },
        },
        actuators: { orderBy: { id: 'asc' } },
      },
    });

    return planters.map((planter) => ({
      id: planter.id,
      name: planter.name,
      sensors: planter.sensors.map((sensor) => {
        const latest = sensor.readings[0];
        return {
          id: sensor.id,
          name: sensor.name,
          type: sensor.type,
          latestReading: latest
            ? {
                id: latest.id,
                value: latest.value,
                recordedAt: latest.recordedAt,
                receivedAt: latest.receivedAt,
              }
            : null,
        };
      }),
      actuators: planter.actuators.map(toActuatorView),
    }));
  }

  async listReadings(sensorId: number, since: Date): Promise<ReadingPoint[]> {
    const rows = await this.prisma.sensorReading.findMany({
      where: {
        sensorId,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'desc' },
      take: READING_CAP,
    });

    return rows.reverse().map((row) => ({
      id: row.id,
      value: row.value,
      recordedAt: row.recordedAt,
      receivedAt: row.receivedAt,
    }));
  }

  async listActuators(): Promise<ActuatorView[]> {
    const actuators = await this.prisma.actuator.findMany({
      orderBy: [{ planterId: 'asc' }, { id: 'asc' }],
    });
    return actuators.map(toActuatorView);
  }
}

function toActuatorView(actuator: {
  id: number;
  name: string;
  type: string;
  planterId: number;
  desiredState: 'on' | 'off';
  desiredSince: Date;
  reportedState: 'on' | 'off';
  reportedAt: Date;
}): ActuatorView {
  return {
    id: actuator.id,
    name: actuator.name,
    type: actuator.type,
    planterId: actuator.planterId,
    desiredState: actuator.desiredState,
    desiredSince: actuator.desiredSince,
    reportedState: actuator.reportedState,
    reportedAt: actuator.reportedAt,
  };
}
