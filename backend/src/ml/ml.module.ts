// MlModule — scheduled threshold calibration (decision #20).
// Same backend process as ingestion/decision/operation; not a fourth
// Compose service. Does not import DecisionModule or OperationModule.
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MlService } from './ml.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [MlService],
})
export class MlModule {}
