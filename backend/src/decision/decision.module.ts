// Decision module — owns the automation decision loop: given a new sensor
// reading, decides whether an actuator's desired state should change.
//
// Exports DecisionService so IngestionModule can inject it directly
// (decision #11).
import { Module } from '@nestjs/common';
import { DecisionService } from './decision.service';

@Module({
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
