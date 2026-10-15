// forge shot (decision 100): pictures of the app kept in the team repo with when, which ticket and what they show.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { sh } from '../policy/helpers.mjs';
import { imageInfo, fromPlaywright, readShots, prepare, screensCheck } from '../../core/cli/shot.mjs';

const FORGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/cli/forge.mjs');
const hasSips = spawnSync('sips', ['--help'], { stdio: 'ignore' }).status === 0;

// An 8-bit RGBA PNG; noise makes it large.
function png(width, height, noise = false) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const o = y * (width * 4 + 1) + 1 + x * 4;
    raw[o] = noise ? (x * 7 + y * 13) % 256 : 40; raw[o + 1] = noise ? (x * y) % 256 : 120; raw[o + 2] = noise ? (x ^ y) % 256 : 200; raw[o + 3] = 255;
  }
  const table = [...Array(256).keys()].map((n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (kind, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(kind), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(body)); return Buffer.concat([len, body, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const write = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };

// A team repo folder and a client checkout on a ticket's branch, linked to it.
function world() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-shot-')));
  const folder = path.join(base, 'team', 'acme');
  write(path.join(folder, 'project.json'), JSON.stringify({ project: { name: 'acme' } }));
  sh(path.join(base, 'team'), 'git', 'init', '-q', '-b', 'main');
  const client = path.join(base, 'client');
  fs.mkdirSync(client);
  sh(client, 'git', 'init', '-q', '-b', 'main');
  sh(client, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  sh(client, 'git', 'checkout', '-q', '-b', 'feat/12-vote');
  fs.mkdirSync(path.join(client, '.forge'));
  fs.symlinkSync(folder, path.join(client, '.forge/project'));
  fs.appendFileSync(path.join(client, '.git/info/exclude'), '.forge/\n');
  return { base, folder, client };
}
const forge = (cwd, ...args) => spawnSync('node', [FORGE, 'shot', ...args], { cwd, encoding: 'utf8', env: { ...process.env, CLAUDECODE: '1' } });

// A Playwright JSON report as Playwright 1.63 writes it (checked in its container): a suite per file, one per
// describe, each test once per project, with the paths inside the container.
function report(dir) {
  const result = (status, at, name) => ({ status, startTime: at, duration: 200, attachments: [{ name: 'screenshot', contentType: 'image/png', path: `/app/test-results/${name}/test-${status === 'passed' ? 'finished' : 'failed'}-1.png` }] });
  const spec = (title, line, project, status, at, name) => ({ title, ok: status === 'passed', file: 'vote.spec.ts', line, column: 3, tests: [{ projectName: project, status: status === 'passed' ? 'expected' : 'unexpected', results: [result(status, at, `${name}-${project}`)] }] });
  const r = {
    config: { rootDir: '/app/e2e', projects: [{ name: 'chromium' }, { name: 'firefox' }] },
    suites: [{
      title: 'vote.spec.ts', file: 'vote.spec.ts',
      specs: [spec('S2 see the results', 12, 'firefox', 'passed', '2026-10-11T12:32:15.000Z', 'results'), spec('S2 see the results', 12, 'chromium', 'passed', '2026-10-11T12:32:13.000Z', 'results')],
      suites: [{ title: 'S1 Vote', file: 'vote.spec.ts', specs: [spec('S1 post a vote', 3, 'chromium', 'passed', '2026-10-11T12:32:11.000Z', 'post'), spec('S1 a failing one', 7, 'chromium', 'failed', '2026-10-11T12:32:12.000Z', 'fail'), spec('S1 post a vote', 3, 'firefox', 'passed', '2026-10-11T12:32:11.500Z', 'post')] }],
    }],
  };
  for (const [n, p] of [['results-chromium', 1], ['results-firefox', 2], ['post-chromium', 3], ['post-firefox', 4]]) write(path.join(dir, 'test-results', n, 'test-finished-1.png'), png(40 + p, 30));
  write(path.join(dir, 'test-results', 'fail-chromium', 'test-failed-1.png'), png(10, 10));
  write(path.join(dir, 'test-results', 'forge-shots.json'), JSON.stringify(r));
  return path.join(dir, 'test-results', 'forge-shots.json');
}

test('image sizes: PNG and JPEG headers, anything else is not a picture', () => {
  assert.deepEqual(imageInfo(png(30, 20)), { type: 'png', width: 30, height: 20 });
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.alloc(14)]);
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xd0, 0x05, 0x00, 0x03, ...Buffer.alloc(9)]);
  assert.deepEqual(imageInfo(Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof])), { type: 'jpeg', width: 1280, height: 720 });
  assert.equal(imageInfo(Buffer.from('GIF89a.................................')), null);
  assert.equal(imageInfo(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])), null);
});

test('a Playwright report: the last screen of each passed test, Chromium\'s, found again outside the container', () => {
  const w = world();
  const file = report(path.join(w.client, 'web'));
  const got = fromPlaywright(file);
  assert.deepEqual(got.map((t) => [t.what, t.project, path.relative(w.client, t.file), t.test]), [
    ['S1 Vote › S1 post a vote', 'chromium', 'web/test-results/post-chromium/test-finished-1.png', 'vote.spec.ts:3'],
    ['S2 see the results', 'chromium', 'web/test-results/results-chromium/test-finished-1.png', 'vote.spec.ts:12'],
  ], 'one per test, in time order, the failed one left out');
  assert.equal(got[0].at, Date.parse('2026-10-11T12:32:11.200Z'), 'when the test ended');
  const bare = path.join(w.base, 'bare.json');
  write(bare, JSON.stringify({ config: { projects: [] }, suites: [{ title: 'a.spec.ts', specs: [{ title: 'x', file: 'a.spec.ts', line: 1, column: 1, tests: [{ projectName: 'chromium', results: [{ status: 'passed', attachments: [] }] }] }] }] }));
  assert.throws(() => fromPlaywright(bare), /no screenshots of passed tests .*FORGE_SHOTS=1/);
  assert.throws(() => fromPlaywright(path.join(w.base, 'none.json')), /not a Playwright JSON report \(no such file\)/);
});

test('forge shot: one picture with its ticket from the branch, the report\'s tests, the list, the same picture once', () => {
  const w = world();
  write(path.join(w.client, 'vote.png'), png(64, 48));
  const t = new Date(2026, 9, 11, 14, 5);
  fs.utimesSync(path.join(w.client, 'vote.png'), t, t);
  let r = forge(w.client, 'vote.png', 'S1  the vote is saved');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^recorded: 11 Oct, 2:05 PM {2}#12 {2}S1 the vote is saved {2}\(shots\/\d{4}-\d\d-\d\dT\d{6}Z-12-s1-the-vote-is-saved\.png, 64×48\), 1 KB; forge save shares it$/m);
  const [one] = readShots(w.folder);
  assert.deepEqual([one.what, one.ticket, one.branch, one.at, one.width, fs.existsSync(one.path)], ['S1 the vote is saved', 12, 'feat/12-vote', t.getTime(), 64, true]);
  assert.match(one.commit, /^[0-9a-f]{40}$/);
  r = forge(w.client, 'vote.png', 'again', '--ticket', '#12');
  assert.match(r.stdout, /^already recorded: .*S1 the vote is saved/);
  r = forge(path.join(w.client, 'web'), '--playwright', path.relative(path.join(w.client, 'web'), report(path.join(w.client, 'web'))), '--ticket', '14');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /#14 {2}S1 Vote › S1 post a vote/);
  assert.match(r.stdout, /2 new of 2; forge save shares them/);
  assert.match(forge(path.join(w.client, 'web'), '--playwright', 'test-results/forge-shots.json', '--ticket', '14').stdout, /nothing new: all 2 were recorded before/);
  const all = readShots(w.folder);
  assert.deepEqual(all.map((s) => [s.ticket, s.what, s.test ?? null]), [[14, 'S1 Vote › S1 post a vote', 'vote.spec.ts:3'], [14, 'S2 see the results', 'vote.spec.ts:12'], [12, 'S1 the vote is saved', null]]);
  r = forge(w.client);
  assert.equal(r.stdout.trim().split('\n').length, 3);
  assert.match(forge(w.client, 'vote.png').stderr, /say what the picture shows/);
  write(path.join(w.client, 'notes.txt'), 'hello there, not a picture at all');
  assert.match(forge(w.client, 'notes.txt', 'x').stderr, /notes\.txt is not a PNG or a JPEG/);
  assert.match(forge(w.client, 'vote.png', 'x', '--ticket', 'abc').stderr, /--ticket takes a ticket number/);
  fs.rmSync(path.join(w.client, '.forge/project'));
  assert.match(forge(w.client, 'vote.png', 'x').stderr, /not set up/);
});

// What the Flutter integration tests keep with FORGE_SHOTS (tests/stacks/flutter/integration_test/forge_shots.dart).
test('forge shot --dir: each picture of a folder from its record, the ticket from the branch, refusals', () => {
  const w = world();
  const dir = path.join(w.client, 'mobile', 'build', 'forge-shots');
  const keep = (name, what, at, extra = {}) => {
    write(path.join(dir, `${name}.png`), png(40 + name.length, 84));
    write(path.join(dir, `${name}.json`), JSON.stringify({ what, at, test: 'integration_test/users_test.dart', file: `${name}.png`, ...extra }));
  };
  keep('a-taken-email', 'A taken email is shown on the email field', '2026-10-11T23:13:33.076877Z');
  keep('a-new-user', 'A new user appears   in the list', '2026-10-11T23:13:30.244458Z');
  let r = forge(path.join(w.client, 'mobile'), '--dir', 'build/forge-shots');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^recorded: .* {2}#12 {2}A new user appears in the list {2}\(shots\/2026-10-11T231330Z-12-a-new-user-appears-in-the-list\.png, 50×84\)/m);
  assert.match(r.stdout, /2 new of 2; forge save shares them/);
  assert.deepEqual(readShots(w.folder).map((s) => [s.ticket, s.what, s.test, s.branch]), [
    [12, 'A new user appears in the list', 'integration_test/users_test.dart', 'feat/12-vote'],
    [12, 'A taken email is shown on the email field', 'integration_test/users_test.dart', 'feat/12-vote']]);
  assert.match(forge(w.client, '--dir', dir).stdout, /nothing new: all 2 were recorded before/);
  assert.match(forge(w.client, '--dir').stderr, /--dir takes the folder/);
  assert.match(forge(w.client, '--dir', dir, '--playwright', 'x.json').stderr, /--playwright or --dir, not both/);
  assert.match(forge(w.client, '--dir', dir, 'extra.png').stderr, /give no image with it/);
  assert.match(forge(w.client, '--dir', path.join(w.client, 'nowhere')).stderr, /is not a folder: run the integration tests with --dart-define=FORGE_SHOTS=1/);
  const empty = path.join(w.client, 'empty');
  fs.mkdirSync(empty);
  assert.match(forge(w.client, '--dir', empty).stderr, /no pictures in .*empty/);
  // A record may only name a picture inside its folder, and must say what it shows and when.
  keep('away', 'Away', '2026-10-11T23:14:00Z', { file: '../../secret.png' });
  assert.match(forge(w.client, '--dir', dir).stderr, /away\.json in .* needs file \(a picture in that folder\)/);
  keep('away', 'Away', 'yesterday');
  assert.match(forge(w.client, '--dir', dir).stderr, /away\.json .* and at \(a time\)/);
  write(path.join(dir, 'away.json'), '{ not json');
  assert.match(forge(w.client, '--dir', dir).stderr, /away\.json in .* is not a picture's record/);
});

test('a large picture becomes a JPEG at most 1280 px wide', { skip: !hasSips && 'macOS sips not available' }, () => {
  const w = world();
  const file = path.join(w.base, 'retina.png');
  write(file, png(2400, 1400, true));
  assert.ok(fs.statSync(file).size > 300 * 1024);
  const { buf, info } = prepare(file);
  assert.deepEqual([info.type, info.width, info.height], ['jpeg', 1280, 746]);
  assert.ok(buf.length < fs.statSync(file).size);
  const small = path.join(w.base, 'small.png');
  write(small, png(200, 100));
  assert.equal(prepare(small).info.type, 'png', 'a small picture stays as it is');
});

test('forge doctor\'s screens check: a Playwright config or Flutter tests without the switch, and the pictures kept (decision 125)', () => {
  const main = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-screens-'));
  const w = (rel, text) => { fs.mkdirSync(path.dirname(path.join(main, rel)), { recursive: true }); fs.writeFileSync(path.join(main, rel), text); };
  assert.deepEqual(screensCheck(main), [], 'no end-to-end tests: nothing to say');
  w('frontend/playwright.config.ts', "export default defineConfig({ use: { baseURL, trace: 'on-first-retry' } });\n");
  let r = screensCheck(main);
  assert.equal(r.length, 1);
  assert.equal(r[0].level, 'warn');
  assert.match(r[0].msg, /^frontend\/playwright\.config\.ts keeps no pictures for the dashboard: it needs screenshot: process\.env\.FORGE_SHOTS \? 'on' : 'off' under use \(skill write-e2e\)\. The lead files it as a chore \(decision 125\)$/);
  w('frontend/playwright.config.ts', "export default defineConfig({ use: { screenshot: process.env.FORGE_SHOTS ? 'on' : 'off' } });\n");
  assert.equal(screensCheck(main)[0].level, 'ok');
  w('mobile/pubspec.yaml', 'name: app\n');
  w('mobile/integration_test/flow_test.dart', 'void main() {}\n');
  r = screensCheck(main);
  assert.equal(r[1].level, 'warn');
  assert.match(r[1].msg, /mobile\/integration_test keeps no pictures .*forge_shots\.dart and keepScreen/);
  w('mobile/integration_test/forge_shots.dart', "const _flag = String.fromEnvironment('FORGE_SHOTS');\n");
  assert.equal(screensCheck(main)[1].level, 'ok');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-screens-team-'));
  assert.deepEqual(screensCheck(main, folder).at(-1), { level: 'info', msg: '0 pictures of the app for the dashboard (forge shot)' });
});
