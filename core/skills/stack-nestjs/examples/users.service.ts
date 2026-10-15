import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { ProblemError } from '../problems.js';
import { decodeCursor, encodeCursor } from './cursor.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  /** Raw SQL with bound parameters (the style for complex queries); never string-built SQL. */
  async list(
    limit: number,
    cursor?: string,
  ): Promise<{ items: User[]; nextCursor: string | null }> {
    const after = cursor ? decodeCursor(cursor) : null;
    const rows: Array<Omit<User, 'createdAt'> & { createdAt: Date }> =
      await this.db.query(
        `SELECT id, email, display_name AS displayName, status, created_at AS createdAt
         FROM users
        WHERE (? IS NULL OR created_at < ? OR (created_at = ? AND id < ?))
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
        [
          after?.c ?? null,
          after ? new Date(after.c) : null,
          after ? new Date(after.c) : null,
          after?.i ?? null,
          limit + 1,
        ],
      );
    const items = rows.slice(0, limit).map((r) => Object.assign(new User(), r));
    return {
      items,
      nextCursor:
        rows.length > limit
          ? encodeCursor(
              items[items.length - 1].createdAt,
              items[items.length - 1].id,
            )
          : null,
    };
  }

  /** Entity and repository for everyday CRUD. */
  async create(email: string, displayName: string): Promise<User> {
    const id = randomUUID();
    try {
      await this.users.insert({
        id,
        email: email.toLowerCase(),
        displayName,
        status: 'ACTIVE',
      });
    } catch (e) {
      if (
        e instanceof QueryFailedError &&
        (e.driverError as { code?: string }).code === 'ER_DUP_ENTRY'
      ) {
        throw new ProblemError(
          409,
          'Email already used',
          `A user with email ${email} exists.`,
        );
      }
      throw e;
    }
    return this.get(id);
  }

  async get(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw new ProblemError(404, 'User not found');
    return user;
  }
}
