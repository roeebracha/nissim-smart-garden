// Prisma module — wraps PrismaService and registers it globally (decision
// #14) so any feature module (Decision, Ingestion, ...) can inject
// PrismaService without importing this module explicitly.
//
// Needs @Global() decorator + providers/exports: [PrismaService].
// Registered once, in AppModule's imports.
//
// See docs/architecture.md decision #14.
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
