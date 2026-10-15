// forge design sample: exact colours from provided screens, PNG decoded without dependencies.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../../core/cli/design.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FORGE = path.join(ROOT, 'core/cli/forge.mjs');
const SCREEN = path.join(ROOT, 'tests/live/fixtures/discovery/screens/01-appointments-list-default.png');

// A small RGB PNG whose rows use filters 0-4 in turn, so every unfilter path is exercised.
function png(width, height, color) {
  const chunk = (kind, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([Buffer.from(kind, 'latin1'), data])) >>> 0);
    return Buffer.concat([len, Buffer.from(kind, 'latin1'), data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  const rows = [];
  const prev = Buffer.alloc(width * 3);
  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(width * 3);
    for (let x = 0; x < width; x++) line.set(color(x, y), x * 3);
    const f = y % 5;
    const out = Buffer.alloc(width * 3);
    for (let i = 0; i < line.length; i++) {
      const a = i >= 3 ? line[i - 3] : 0; const b = prev[i]; const c = i >= 3 ? prev[i - 3] : 0;
      const p = a + b - c; const pred = [0, a, b, (a + b) >> 1, Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c][f];
      out[i] = (line[i] - pred) & 0xff;
    }
    rows.push(Buffer.from([f]), out);
    line.copy(prev);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const forge = (...a) => { const r = spawnSync('node', [FORGE, ...a], { encoding: 'utf8' }); return { code: r.status, out: `${r.stdout}${r.stderr}` }; };

test('decodes every PNG row filter exactly', () => {
  const color = (x, y) => [(x * 37 + y) & 0xff, (y * 53) & 0xff, (x * y) & 0xff];
  const img = decodePng(png(13, 11, color));
  for (let y = 0; y < 11; y++) for (let x = 0; x < 13; x++) assert.deepEqual(img.rgb(x, y), color(x, y), `${x},${y}`);
});

test('palette and points: a header colour on a white page', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-design-')), 's.png');
  fs.writeFileSync(file, png(20, 10, (x, y) => (y < 3 ? [0x0f, 0x76, 0x6e] : [255, 255, 255])));
  const r = forge('design', 'sample', file, '--at', '1,1 5,8');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /at 1,1: #0F766E\nat 5,8: #FFFFFF/);
  assert.match(forge('design', 'sample', file).out, /palette \(most used first\):\n {2}#FFFFFF {2}70\.0%\n {2}#0F766E {2}30\.0%/);
  assert.match(forge('design', 'sample', file, '--region', '0,0,20,3').out, /palette of 0,0,20,3[^\n]*\n {2}#0F766E {2}100\.0%/);
  assert.match(forge('design', 'sample', file, '--at', '99,1').out, /--at 99,1 is outside the image/);
});

test('a real provided screen: the brand teal of the discovery trial', () => {
  const r = forge('design', 'sample', SCREEN, '--at', '5,5');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /at 5,5: #0F766E/, 'the header colour from the screen\'s CSS');
  assert.match(forge('design', 'sample', SCREEN).out, /#0F766E/);
});

const hasSips = spawnSync('sips', ['--help']).status !== null && process.platform === 'darwin';
test('other formats are converted with sips (macOS)', { skip: !hasSips && 'macOS sips not available' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-design-'));
  const jpg = path.join(dir, 's.jpg');
  spawnSync('sips', ['-s', 'format', 'jpeg', SCREEN, '--out', jpg]);
  const r = forge('design', 'sample', jpg, '--at', '5,5');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /s\.jpg: 800 x 600\nat 5,5: #0[EF]7[56]6[DEF]/, 'JPEG is lossy: within one step of the teal');
});
