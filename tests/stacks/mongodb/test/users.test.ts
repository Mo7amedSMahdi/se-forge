// migrate-mongo up, down and up on a real MongoDB (Testcontainers), then the repository against it.
import { execFileSync } from 'node:child_process';
import { MongoDBContainer, StartedMongoDBContainer } from '@testcontainers/mongodb';
import { Db, MongoClient } from 'mongodb';
import { ProblemError, UsersRepository } from '../src/users.js';

let mongo: StartedMongoDBContainer;
let client: MongoClient;
let db: Db;
let repo: UsersRepository;

const migrate = (cmd: 'up' | 'down') =>
  execFileSync('npx', ['migrate-mongo', cmd], { env: { ...process.env, MONGODB_URL: url(), MONGODB_DB: 'app' }, encoding: 'utf8' });
const url = () => `${mongo.getConnectionString()}/?directConnection=true`;

beforeAll(async () => {
  mongo = await new MongoDBContainer('mongo:8.0').start();
  client = await MongoClient.connect(url());
  db = client.db('app');
  repo = new UsersRepository(db);
}, 180_000);

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

it('migrations run up, down and up', async () => {
  migrate('up');
  expect(await db.listCollections({ name: 'users' }).hasNext()).toBe(true);
  migrate('down');
  expect(await db.listCollections({ name: 'users' }).hasNext()).toBe(false);
  migrate('up');
  const names = (await db.collection('users').indexes()).map((i) => i.name);
  expect(names).toEqual(expect.arrayContaining(['ux_users_email', 'ix_users_created_at_id']));
}, 120_000);

it('the validator refuses documents of the wrong shape', async () => {
  await expect(db.collection('users').insertOne({ email: 'x@example.com', role: 'admin' })).rejects.toThrow(/Document failed validation/);
});

it('create, duplicate (409), get and unknown (404)', async () => {
  const user = await repo.create('Amal@Example.com', 'Amal');
  expect(user).toMatchObject({ email: 'amal@example.com', status: 'ACTIVE' });
  expect(user.createdAt).toMatch(/Z$/);
  await expect(repo.create('amal@example.com', 'Again')).rejects.toMatchObject({ status: 409 });
  expect((await repo.get(user.id)).email).toBe('amal@example.com');
  for (const id of ['65f1c0ffee0000000000abcd', 'not-an-id']) await expect(repo.get(id)).rejects.toBeInstanceOf(ProblemError);
});

it('lists page with a cursor, newest first; a bad cursor is 400', async () => {
  for (let i = 0; i < 3; i++) await repo.create(`page${i}@example.com`, `P${i}`);
  const seen: string[] = [];
  let cursor: string | null = null;
  do {
    const page = await repo.list(2, cursor ?? undefined);
    seen.push(...page.items.map((u) => u.email));
    cursor = page.nextCursor;
  } while (cursor);
  expect(new Set(seen).size).toBe(seen.length);
  expect(seen.indexOf('page2@example.com')).toBeLessThan(seen.indexOf('page0@example.com'));
  await expect(repo.list(2, 'garbage')).rejects.toMatchObject({ status: 400 });
});
