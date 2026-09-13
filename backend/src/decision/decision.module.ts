// Decision module — owns the automation decision loop: given a new sensor
// reading, decides whether an actuator's desired state should change.
//
// Exports DecisionService so IngestionModule can inject it directly
// (decision #11).
import { Module } from '@nestjs/common';
import { OperationModule } from '../operation/operation.module';
import { DecisionService } from './decision.service';

@Module({
  imports: [OperationModule],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
