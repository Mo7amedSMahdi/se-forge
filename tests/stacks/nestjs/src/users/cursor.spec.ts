import { ProblemError } from '../problems.js';
import { decodeCursor, encodeCursor } from './cursor.js';

describe('cursor', () => {
  it('round-trips the last row', () => {
    const at = new Date('2026-10-07T12:00:00.123Z');
    expect(decodeCursor(encodeCursor(at, 'abc'))).toEqual({
      c: at.toISOString(),
      i: 'abc',
    });
  });

  it('rejects anything else as a 400 field error', () => {
    for (const bad of [
      'garbage',
      Buffer.from('{"c":"x","i":1}').toString('base64url'),
    ]) {
      expect(() => decodeCursor(bad)).toThrow(ProblemError);
    }
  });
});
