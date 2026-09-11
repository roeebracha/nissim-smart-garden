// Operation module — safety + desired state + command publish + audit row.
// Exports OperationService so DecisionModule can inject it (decision #11
// pattern). Does not import DecisionModule.
import { Module } from '@nestjs/common';

@Module({})
export class OperationModule {}
