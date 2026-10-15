import { ProblemError } from '../problems.js';

export interface Cursor {
  c: string;
  i: string;
}

/** An opaque cursor: the last row's creation time and id, base64url-encoded JSON. */
export const encodeCursor = (createdAt: Date, id: string): string =>
  Buffer.from(JSON.stringify({ c: createdAt.toISOString(), i: id })).toString(
    'base64url',
  );

export function decodeCursor(cursor: string): Cursor {
  try {
    const value = JSON.parse(
      Buffer.from(cursor, 'base64url').toString(),
    ) as Cursor;
    if (
      typeof value.c !== 'string' ||
      typeof value.i !== 'string' ||
      Number.isNaN(Date.parse(value.c))
    )
      throw new Error('shape');
    return value;
  } catch {
    throw new ProblemError(400, 'Invalid input', undefined, [
      { field: 'cursor', message: 'is not a cursor from this API' },
    ]);
  }
}
