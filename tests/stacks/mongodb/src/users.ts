// Users on MongoDB with the official driver: typed collection, problem errors, cursor pages.
import { Collection, Db, MongoServerError, ObjectId } from 'mongodb';

export interface UserDoc { _id: ObjectId; email: string; displayName: string; status: 'ACTIVE' | 'SUSPENDED'; createdAt: Date }
export interface User { id: string; email: string; displayName: string; status: 'ACTIVE' | 'SUSPENDED'; createdAt: string }

export class ProblemError extends Error {
  constructor(readonly status: number, readonly title: string, readonly errors?: Array<{ field: string; message: string }>) {
    super(title);
  }
}

const toApi = (d: UserDoc): User => ({ id: d._id.toHexString(), email: d.email, displayName: d.displayName, status: d.status, createdAt: d.createdAt.toISOString() });
const encode = (d: UserDoc) => Buffer.from(JSON.stringify({ c: d.createdAt.toISOString(), i: d._id.toHexString() })).toString('base64url');

export class UsersRepository {
  private readonly users: Collection<UserDoc>;
  constructor(db: Db) {
    this.users = db.collection<UserDoc>('users');
  }

  async create(email: string, displayName: string): Promise<User> {
    const doc: UserDoc = { _id: new ObjectId(), email: email.toLowerCase(), displayName, status: 'ACTIVE', createdAt: new Date() };
    try {
      await this.users.insertOne(doc);
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) throw new ProblemError(409, 'Email already used');
      throw e;
    }
    return toApi(doc);
  }

  async get(id: string): Promise<User> {
    const doc = ObjectId.isValid(id) ? await this.users.findOne({ _id: new ObjectId(id) }) : null;
    if (!doc) throw new ProblemError(404, 'User not found');
    return toApi(doc);
  }

  async list(limit: number, cursor?: string): Promise<{ items: User[]; nextCursor: string | null }> {
    let filter = {};
    if (cursor) {
      let after: { c: string; i: string };
      try {
        after = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as { c: string; i: string };
        if (!ObjectId.isValid(after.i) || Number.isNaN(Date.parse(after.c))) throw new Error('shape');
      } catch {
        throw new ProblemError(400, 'Invalid input', [{ field: 'cursor', message: 'is not a cursor from this API' }]);
      }
      const c = new Date(after.c);
      filter = { $or: [{ createdAt: { $lt: c } }, { createdAt: c, _id: { $lt: new ObjectId(after.i) } }] };
    }
    const docs = await this.users.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
    const page = docs.slice(0, limit);
    return { items: page.map(toApi), nextCursor: docs.length > limit ? encode(page[page.length - 1]) : null };
  }
}
