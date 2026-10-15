// HTTP reads for the dashboard. Paths are the shared contract:
// GET /planters, GET /readings, GET /actuators.
// Suggestions and approval stay on the other branch (PR 5).
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { GardenService } from './garden.service';

@Controller()
export class GardenController {
  constructor(private readonly garden: GardenService) {}

  @Get('planters')
  listPlanters() {
    return this.garden.listPlanters();
  }

  @Get('readings')
  listReadings(
    @Query('sensorId') sensorId?: string,
    @Query('since') since?: string,
  ) {
    return this.garden.listReadings(parseSensorId(sensorId), parseSince(since));
  }

  @Get('actuators')
  listActuators() {
    return this.garden.listActuators();
  }
}

function parseSensorId(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    throw new BadRequestException('sensorId must be a positive integer');
  }
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestException('sensorId must be a positive integer');
  }
  return id;
}

function parseSince(raw: string | undefined): Date {
  if (raw === undefined || raw.trim() === '') {
    throw new BadRequestException('since must be an ISO-8601 timestamp');
  }
  const since = new Date(raw);
  if (Number.isNaN(since.getTime())) {
    throw new BadRequestException('since must be an ISO-8601 timestamp');
  }
  return since;
}
