import {
  ConflictException,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { Suggestion } from '../../generated/prisma/client';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

function suggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 12,
    status: 'pending',
    planterId: 2,
    sensorType: 'moisture',
    actuatorType: 'pump',
    onThreshold: 31.5,
    offThreshold: 58.25,
    operator: 'less_than',
    summary: 'Water the tea pot when the soil is dry',
    createdAt: new Date('2026-10-15T12:00:00.000Z'),
    updatedAt: new Date('2026-10-15T12:00:00.000Z'),
    ...overrides,
  };
}

describe('SuggestionsController', () => {
  let app: INestApplication;
  const suggestions = {
    listPending: jest.fn(),
    approve: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SuggestionsController],
      providers: [{ provide: SuggestionsService, useValue: suggestions }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function server(): App {
    return app.getHttpServer() as App;
  }

  it('GET /suggestions?status=pending returns the pending list', async () => {
    const pending = suggestion();
    suggestions.listPending.mockResolvedValue([pending]);

    const response = await request(server())
      .get('/suggestions?status=pending')
      .expect(200);

    expect(response.body).toEqual([
      {
        ...pending,
        createdAt: pending.createdAt.toISOString(),
        updatedAt: pending.updatedAt.toISOString(),
      },
    ]);
    expect(suggestions.listPending).toHaveBeenCalledTimes(1);
  });

  it('rejects a missing or non-pending status filter', async () => {
    await request(server()).get('/suggestions').expect(400);
    await request(server()).get('/suggestions?status=approved').expect(400);

    expect(suggestions.listPending).not.toHaveBeenCalled();
    expect(suggestions.approve).not.toHaveBeenCalled();
  });

  it('POST /suggestions/:id/approve ignores the body and returns the row', async () => {
    const approved = suggestion({ status: 'approved' });
    suggestions.approve.mockResolvedValue(approved);

    const response = await request(server())
      .post('/suggestions/12/approve')
      .send({ onThreshold: 1 })
      .expect(200);

    expect(suggestions.approve).toHaveBeenCalledWith(12);
    expect(response.body).toMatchObject({
      id: 12,
      status: 'approved',
      onThreshold: approved.onThreshold,
    });
  });

  it('rejects a non-numeric id before calling the service', async () => {
    await request(server()).post('/suggestions/abc/approve').expect(400);

    expect(suggestions.approve).not.toHaveBeenCalled();
  });

  it('maps a missing id to 404 and a second approve to 409', async () => {
    suggestions.approve.mockRejectedValueOnce(
      new NotFoundException('Suggestion 9 not found'),
    );
    await request(server()).post('/suggestions/9/approve').expect(404);

    suggestions.approve.mockRejectedValueOnce(
      new ConflictException('Only a pending suggestion can be approved'),
    );
    await request(server()).post('/suggestions/12/approve').expect(409);
  });
});
