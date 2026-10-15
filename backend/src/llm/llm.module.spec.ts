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
import { MESSAGES_CLIENT } from './messages';

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
      { provide: MESSAGES_CLIENT, useClass: AnthropicMessagesClient },
    ]);
    expect(meta(MODULE_METADATA.IMPORTS, LlmModule) ?? []).toEqual([]);
    expect(meta('self:paramtypes', LlmService)).toEqual([
      { index: 1, param: MESSAGES_CLIENT },
    ]);
    const serviceParams = meta('design:paramtypes', LlmService);
    expect(Array.isArray(serviceParams) ? serviceParams : []).not.toContain(
      AnthropicMessagesClient,
    );
    expect(meta('design:paramtypes', LlmTools)).toEqual([PrismaService]);
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

    const fake = {
      create: jest.fn().mockResolvedValue({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: 'from the fake' }],
      }),
    };
    const moduleRef = await Test.createTestingModule({
      imports: [FakePrismaModule, LlmModule],
    })
      .overrideProvider(MESSAGES_CLIENT)
      .useValue(fake)
      .compile();
    const service = moduleRef.get(LlmService);
    expect(service).toBeInstanceOf(LlmService);
    await expect(service.explain({ question: 'Hi' })).resolves.toMatchObject({
      content: 'from the fake',
    });
    expect(fake.create).toHaveBeenCalled();
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
