import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LlmController } from './llm.controller';
import { LlmService } from './llm.service';

function httpRequest(app: INestApplication) {
  const candidate: unknown = app.getHttpServer();
  if (typeof candidate !== 'object' || candidate === null) {
    throw new Error('Nest did not create an HTTP server');
  }
  return request(candidate as Parameters<typeof request>[0]);
}

describe('POST /llm/ask', () => {
  let app: INestApplication;
  const ask = jest.fn();

  beforeEach(async () => {
    ask.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [LlmController],
      providers: [{ provide: LlmService, useValue: { ask } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('passes the question and optional planterId to the service', async () => {
    ask.mockResolvedValue({ id: 1, content: 'ok', trace: [] });

    await httpRequest(app)
      .post('/llm/ask')
      .send({ question: 'How wet is the tea planter?', planterId: 2 })
      .expect(201);

    expect(ask).toHaveBeenCalledWith({
      question: 'How wet is the tea planter?',
      planterId: 2,
    });
  });

  it('rejects an empty question and does not call the service', async () => {
    await httpRequest(app)
      .post('/llm/ask')
      .send({ question: '   ' })
      .expect(400);

    expect(ask).not.toHaveBeenCalled();
  });
});
