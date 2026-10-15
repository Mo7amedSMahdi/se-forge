// API tests on a real MySQL (Testcontainers) migrated with the same migrations as production: up, all the
// way down and up again, so every gate run proves they are reversible. The style tests hold the team's
// error shape (decisions 33, 81): keep them green.
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MySqlContainer, StartedMySqlContainer } from '@testcontainers/mysql';
import request from 'supertest';
import { DataSource } from 'typeorm';

const PROBLEM = /application\/problem\+json/;
let db: StartedMySqlContainer;
let app: INestApplication;

beforeAll(async () => {
  db = await new MySqlContainer('mysql:8.4').start();
  process.env.DATABASE_URL = db.getConnectionUri();
  const { dataSourceOptions } = await import('../src/data-source.js');
  const migrations = new DataSource(dataSourceOptions());
  await migrations.initialize();
  await migrations.runMigrations();
  for (let i = 0; i < migrations.migrations.length; i++)
    await migrations.undoLastMigration();
  await migrations.runMigrations();
  await migrations.destroy();
  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
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
