// PrismaService — single shared Prisma client instance, injected via NestJS
// DI into any module that needs Postgres access (decision #14).
//
// extends PrismaClient so every injected instance shares one underlying
// connection pool, instead of each service opening its own.
//
// Lifecycle:
// - OnModuleInit: connect explicitly on app startup, so a DB connection
//   problem fails loudly at boot instead of on the first request.
// - OnModuleDestroy: close the connection cleanly when Nest shuts down
//   (SIGTERM in the container).
//
// See docs/architecture.md decision #14.
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
