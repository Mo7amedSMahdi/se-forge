// API tests on a real MongoDB (Testcontainers) migrated with migrate-mongo like production: up, all the
// way down and up again, so every gate run proves the migrations are reversible. The style tests hold the
// team's error shape (decisions 33, 81): keep them green.
import { execFileSync } from 'node:child_process';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import request from 'supertest';

const PROBLEM = /application\/problem\+json/;
let mongo: StartedMongoDBContainer;
let app: INestApplication;

const migrate = (cmd: 'up' | 'down') =>
  execFileSync('npx', ['migrate-mongo', cmd], {
    env: process.env,
    encoding: 'utf8',
  });

beforeAll(async () => {
  mongo = await new MongoDBContainer('mongo:8.0').start();
  process.env.MONGODB_URL = `${mongo.getConnectionString()}/?directConnection=true`;
  process.env.MONGODB_DB = 'app';
  migrate('up');
  migrate('down');
  migrate('up');
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await mongo?.stop();
});

it('GET /health answers ok', async () => {
  const r = await request(app.getHttpServer()).get('/health');
  expect(r.status).toBe(200);
  expect(r.body).toEqual({ status: 'ok' });
});

it('an unknown route is a 404 problem', async () => {
  const r = await request(app.getHttpServer()).get('/v1/no-such-route');
  expect(r.status).toBe(404);
  expect(r.headers['content-type']).toMatch(PROBLEM);
  expect(r.body.status).toBe(404);
  expect(r.body.title).toBeTruthy();
});

it('a wrong method answers problem details (Express: 404)', async () => {
  const r = await request(app.getHttpServer()).post('/health');
  expect([404, 405]).toContain(r.status);
  expect(r.headers['content-type']).toMatch(PROBLEM);
});
