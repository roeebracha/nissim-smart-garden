import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Global, Module } from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { OperationService } from '../operation/operation.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnthropicMessagesClient } from './anthropic-messages.client';
import { LlmController } from './llm.controller';
import { LlmModule } from './llm.module';
import { LlmService } from './llm.service';
import { LlmTools } from './llm-tools';

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: {} }],
  exports: [PrismaService],
})
class FakePrismaModule {}

const FORBIDDEN = [
  'operation.service',
  'decision.service',
  'ingestion.service',
  'ml.service',
  'requestActuation',
  '@Cron',
];

function meta(key: string, target: object): unknown {
  const value: unknown = Reflect.getMetadata(key, target);
  return value;
}

describe('LlmModule', () => {
  it('does not inject OperationService', async () => {
    expect(meta(MODULE_METADATA.PROVIDERS, LlmModule)).toEqual([
      LlmService,
      LlmTools,
      AnthropicMessagesClient,
    ]);
    expect(meta(MODULE_METADATA.IMPORTS, LlmModule) ?? []).toEqual([]);
    expect(meta('design:paramtypes', LlmService)).toEqual([
      PrismaService,
      AnthropicMessagesClient,
      LlmTools,
    ]);
    expect(meta('design:paramtypes', LlmTools)).toEqual([PrismaService]);
    expect(meta('design:paramtypes', AnthropicMessagesClient) ?? []).toEqual(
      [],
    );
    expect(meta('design:paramtypes', LlmController)).toEqual([LlmService]);

    for (const type of [
      LlmService,
      LlmTools,
      AnthropicMessagesClient,
      LlmController,
    ]) {
      const params = meta('design:paramtypes', type);
      const list = Array.isArray(params) ? params : [];
      expect(list).not.toContain(OperationService);
    }

    const moduleRef = await Test.createTestingModule({
      imports: [FakePrismaModule, LlmModule],
    }).compile();
    expect(moduleRef.get(LlmService)).toBeInstanceOf(LlmService);
    expect(() => moduleRef.get(OperationService)).toThrow();
  });

  it('does not import the decision loop or schedule a cron', () => {
    const sources = readdirSync(__dirname).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'),
    );
    expect(sources.length).toBeGreaterThan(0);
    for (const name of sources) {
      const source = readFileSync(join(__dirname, name), 'utf8');
      for (const token of FORBIDDEN) {
        expect(source.includes(token)).toBe(false);
      }
    }
  });
});
