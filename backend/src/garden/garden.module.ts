// Read API for the dashboard. Prisma is global (decision 14), so this
// module does not import it. It does not import Operation, Decision, or ML.
import { Module } from '@nestjs/common';
import { GardenController } from './garden.controller';
import { GardenService } from './garden.service';

@Module({
  controllers: [GardenController],
  providers: [GardenService],
})
export class GardenModule {}
