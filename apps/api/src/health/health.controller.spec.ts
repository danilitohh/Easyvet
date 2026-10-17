import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';
import { HealthModule } from './health.module';
import { PrismaService } from '../infrastructure/database/prisma.service';

describe('GET /api/v1/health', () => {
  let app: INestApplication;
  const queryRaw = jest.fn<() => Promise<unknown>>();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the shared health contract', async () => {
    await request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' });
  });

  it('confirms database readiness without exposing infrastructure details', async () => {
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(200)
      .expect({ status: 'ok', dependencies: { database: 'ok' } });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns a generic unavailable response when the database is down', async () => {
    queryRaw.mockRejectedValueOnce(new Error('connection details must not escape'));
    await request(app.getHttpServer())
      .get('/api/v1/health/ready')
      .expect(503)
      .expect(({ body }) => {
        expect(body).toEqual({
          code: 'SERVICE_NOT_READY',
          message: 'Service dependencies are not ready',
        });
        expect(JSON.stringify(body)).not.toContain('connection details');
      });
  });
});
