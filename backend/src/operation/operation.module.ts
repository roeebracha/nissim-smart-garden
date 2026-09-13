// Operation module — safety + desired state + command publish + audit row.
// Exports OperationService so DecisionModule can inject it (decision #11).
import { Module } from '@nestjs/common';
import { OperationService } from './operation.service';

@Module({
  providers: [OperationService],
  exports: [OperationService],
})
export class OperationModule {}
