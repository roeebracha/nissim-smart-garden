// Copies one pending suggestion onto automation_rules.
//
// Only a pending row can be approved. The conditional update is the claim:
// a second approve matches zero rows and does not write the rule again.
// Postgres holds the row lock until the transaction commits, so two
// concurrent approves of the same id cannot both pass the WHERE.
//
// updatedBy is `seed`. ThresholdSource is only `seed | ml`. An approved
// suggestion is a hand-set rule, not the nightly calibration job. This PR
// does not add an enum value.
//
// This service does not call requestActuation, publish MQTT, or insert
// actuator_events (decision #2, decision #9). Decision reads the new
// thresholds on the next reading.
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Suggestion } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SuggestionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Oldest first so the list is a stable queue for the dashboard.
  listPending(): Promise<Suggestion[]> {
    return this.prisma.suggestion.findMany({
      where: { status: 'pending' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async approve(id: number): Promise<Suggestion> {
    return this.prisma.$transaction(async (tx) => {
      const claimed = await tx.suggestion.updateMany({
        where: { id, status: 'pending' },
        data: { status: 'approved' },
      });

      if (claimed.count !== 1) {
        const existing = await tx.suggestion.findUnique({ where: { id } });
        if (!existing) {
          throw new NotFoundException(`Suggestion ${id} not found`);
        }
        throw new ConflictException(
          'Only a pending suggestion can be approved',
        );
      }

      const suggestion = await tx.suggestion.findUnique({ where: { id } });
      if (!suggestion) {
        throw new NotFoundException(`Suggestion ${id} not found`);
      }

      // One rule per (planterId, sensorType, actuatorType) — decision #13.
      // Create uses the summary as the rule name and starts enabled.
      // Update copies thresholds and operator only, and marks the write as
      // a hand-set seed. Name and enabled stay as they were.
      await tx.automationRule.upsert({
        where: {
          planterId_sensorType_actuatorType: {
            planterId: suggestion.planterId,
            sensorType: suggestion.sensorType,
            actuatorType: suggestion.actuatorType,
          },
        },
        create: {
          name: suggestion.summary,
          sensorType: suggestion.sensorType,
          actuatorType: suggestion.actuatorType,
          onThreshold: suggestion.onThreshold,
          offThreshold: suggestion.offThreshold,
          operator: suggestion.operator,
          updatedBy: 'seed',
          enabled: true,
          planterId: suggestion.planterId,
        },
        update: {
          onThreshold: suggestion.onThreshold,
          offThreshold: suggestion.offThreshold,
          operator: suggestion.operator,
          updatedBy: 'seed',
        },
      });

      return suggestion;
    });
  }
}
