// supertest types the HTTP server and JSON body as `any`.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { GardenController } from './garden.controller';
import { GardenService } from './garden.service';

const recordedAt = new Date('2026-10-16T08:00:00.000Z');
const receivedAt = new Date('2026-10-16T08:00:01.000Z');
const desiredSince = new Date('2026-10-16T07:00:00.000Z');
const reportedAt = new Date('2026-10-16T07:00:05.000Z');

describe('GardenController', () => {
  let app: INestApplication;
  const prisma = {
    planter: { findMany: jest.fn() },
    sensorReading: { findMany: jest.fn() },
    actuator: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [GardenController],
      providers: [GardenService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /planters returns sensors, the latest reading, and actuators', async () => {
    prisma.planter.findMany.mockResolvedValue([
      {
        id: 1,
        name: 'Tea',
        sensors: [
          {
            id: 10,
            name: 'tea-temp',
            type: 'temperature',
            readings: [
              { id: 100, value: 24.5, recordedAt, receivedAt },
              { id: 99, value: 20, recordedAt, receivedAt },
            ],
          },
        ],
        actuators: [
          {
            id: 3,
            name: 'tea-pump',
            type: 'pump',
            planterId: 1,
            desiredState: 'on',
            desiredSince,
            reportedState: 'off',
            reportedAt,
          },
        ],
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/planters')
      .expect(200);

    expect(response.body).toEqual([
      {
        id: 1,
        name: 'Tea',
        sensors: [
          {
            id: 10,
            name: 'tea-temp',
            type: 'temperature',
            latestReading: {
              id: 100,
              value: 24.5,
              recordedAt: recordedAt.toISOString(),
              receivedAt: receivedAt.toISOString(),
            },
          },
        ],
        actuators: [
          {
            id: 3,
            name: 'tea-pump',
            type: 'pump',
            planterId: 1,
            desiredState: 'on',
            desiredSince: desiredSince.toISOString(),
            reportedState: 'off',
            reportedAt: reportedAt.toISOString(),
          },
        ],
      },
    ]);
    expect(prisma.planter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          sensors: expect.objectContaining({
            include: {
              readings: { orderBy: { recordedAt: 'desc' }, take: 1 },
            },
          }),
        }),
      }),
    );
  });

  it('GET /planters uses null when a sensor has no reading', async () => {
    prisma.planter.findMany.mockResolvedValue([
      {
        id: 2,
        name: 'Peppers',
        sensors: [
          { id: 11, name: 'pepper-moisture', type: 'moisture', readings: [] },
        ],
        actuators: [],
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/planters')
      .expect(200);

    expect(response.body[0].sensors[0].latestReading).toBeNull();
  });

  it('GET /readings returns the series for sensorId since a timestamp', async () => {
    const older = new Date('2026-10-16T06:00:00.000Z');
    prisma.sensorReading.findMany.mockResolvedValue([
      { id: 2, value: 40, recordedAt, receivedAt },
      { id: 1, value: 30, recordedAt: older, receivedAt: older },
    ]);

    const response = await request(app.getHttpServer())
      .get('/readings')
      .query({ sensorId: '10', since: '2026-10-15T00:00:00.000Z' })
      .expect(200);

    expect(response.body).toEqual([
      {
        id: 1,
        value: 30,
        recordedAt: older.toISOString(),
        receivedAt: older.toISOString(),
      },
      {
        id: 2,
        value: 40,
        recordedAt: recordedAt.toISOString(),
        receivedAt: receivedAt.toISOString(),
      },
    ]);
    expect(prisma.sensorReading.findMany).toHaveBeenCalledWith({
      where: {
        sensorId: 10,
        recordedAt: { gte: new Date('2026-10-15T00:00:00.000Z') },
      },
      orderBy: { recordedAt: 'desc' },
      take: 2000,
    });
  });

  it('GET /readings rejects a missing or invalid sensorId and since', async () => {
    await request(app.getHttpServer()).get('/readings').expect(400);
    await request(app.getHttpServer())
      .get('/readings')
      .query({ sensorId: '0', since: '2026-10-15T00:00:00.000Z' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/readings')
      .query({ sensorId: '1', since: 'not-a-date' })
      .expect(400);
    expect(prisma.sensorReading.findMany).not.toHaveBeenCalled();
  });

  it('GET /actuators returns desiredState and reportedState', async () => {
    prisma.actuator.findMany.mockResolvedValue([
      {
        id: 4,
        name: 'lamp',
        type: 'light',
        planterId: 1,
        desiredState: 'off',
        desiredSince,
        reportedState: 'off',
        reportedAt,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/actuators')
      .expect(200);

    expect(response.body).toEqual([
      {
        id: 4,
        name: 'lamp',
        type: 'light',
        planterId: 1,
        desiredState: 'off',
        desiredSince: desiredSince.toISOString(),
        reportedState: 'off',
        reportedAt: reportedAt.toISOString(),
      },
    ]);
  });
});
