// API tests per status code of the contract (tests/stacks/contract/users.yaml), on a real MySQL
// (Testcontainers) migrated with the same migrations as production: up, all the way down and up again,
// so every gate run proves they are reversible.
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

const create = async (email: string, displayName = 'Amal') => {
  const r = await request(app.getHttpServer())
    .post('/v1/users')
    .send({ email, displayName });
  expect(r.status).toBe(201);
  return r.body as { id: string; email: string };
};

it('create returns 201 with Location and camelCase', async () => {
  const r = await request(app.getHttpServer())
    .post('/v1/users')
    .send({ email: 'Amal@Example.com', displayName: 'Amal' });
  expect(r.status).toBe(201);
  expect(r.headers.location).toBe(`/v1/users/${r.body.id}`);
  expect(r.body).toMatchObject({
    email: 'amal@example.com',
    displayName: 'Amal',
    status: 'ACTIVE',
  });
  expect(r.body.createdAt).toMatch(/Z$/);
});

it('a duplicate email is 409 problem', async () => {
  await create('dup@example.com');
  const r = await request(app.getHttpServer())
    .post('/v1/users')
    .send({ email: 'dup@example.com', displayName: 'Again' });
  expect(r.status).toBe(409);
  expect(r.headers['content-type']).toMatch(PROBLEM);
});

it('invalid input and unknown fields are 400 with field errors', async () => {
  const r = await request(app.getHttpServer())
    .post('/v1/users')
    .send({ email: 'not-an-email', role: 'admin' });
  expect(r.status).toBe(400);
  expect(r.headers['content-type']).toMatch(PROBLEM);
  const fields = (r.body.errors as Array<{ field: string }>).map(
    (e) => e.field,
  );
  expect(fields).toEqual(
    expect.arrayContaining(['email', 'displayName', 'role']),
  );
});

it('an unknown user is 404 problem', async () => {
  for (const id of ['3f2504e0-4f89-11d3-9a0c-0305e82c3301', 'not-a-uuid']) {
    const r = await request(app.getHttpServer()).get(`/v1/users/${id}`);
    expect(r.status).toBe(404);
    expect(r.headers['content-type']).toMatch(PROBLEM);
  }
});

it('get returns the user', async () => {
  const user = await create('get@example.com');
  const r = await request(app.getHttpServer()).get(`/v1/users/${user.id}`);
  expect(r.status).toBe(200);
  expect(r.body.email).toBe('get@example.com');
});

it('lists page with a cursor, newest first', async () => {
  for (let i = 0; i < 3; i++) await create(`page${i}@example.com`, `P${i}`);
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const r = await request(app.getHttpServer())
      .get('/v1/users')
      .query({ limit: 2, ...(cursor ? { cursor } : {}) });
    expect(r.status).toBe(200);
    seen.push(
      ...(r.body.items as Array<{ email: string }>).map((u) => u.email),
    );
    cursor = r.body.nextCursor;
  } while (cursor);
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.indexOf('page2@example.com')).toBeLessThan(
    seen.indexOf('page0@example.com'),
  );
});

it('a bad limit or cursor is 400', async () => {
  expect(
    (await request(app.getHttpServer()).get('/v1/users').query({ limit: 0 }))
      .status,
  ).toBe(400);
  expect(
    (
      await request(app.getHttpServer())
        .get('/v1/users')
        .query({ cursor: 'garbage' })
    ).status,
  ).toBe(400);
});
