// MlModule — scheduled threshold calibration (decision #20).
// Same backend process as ingestion/decision/operation; not a fourth
// Compose service. Does not import DecisionModule or OperationModule.
//
// When implementing: npm install @nestjs/schedule, then
// ScheduleModule.forRoot() here and @Cron on MlService.recalibrateRules.
import { Module } from '@nestjs/common';
import { MlService } from './ml.service';

@Module({
  providers: [MlService],
})
export class MlModule {}
