// forge api check / fetch / generate, with stand-ins for Redocly and oasdiff that work on JSON specs:
// lint fails on a spec containing "LINT-ERROR"; oasdiff reports a removed path as breaking.
// The real tools run in tests/cli/api-real.test.mjs (opt-in).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sh, writeProjectConfig } from '../policy/helpers.mjs';

const FORGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/cli/forge.mjs');
const FAKES = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-api-fakes-')));
fs.writeFileSync(path.join(FAKES, 'redocly.mjs'), `
import fs from 'node:fs';
const [cmd, spec, ...rest] = process.argv.slice(2);
const text = fs.readFileSync(spec, 'utf8');
if (cmd === 'lint') { if (text.includes('LINT-ERROR')) { console.log('error: LINT-ERROR found'); process.exit(1); } console.log('valid'); }
if (cmd === 'bundle') fs.writeFileSync(rest[rest.indexOf('-o') + 1], JSON.stringify(JSON.parse(text)));
`);
fs.writeFileSync(path.join(FAKES, 'oasdiff.mjs'), `
import fs from 'node:fs';
const [, base, rev] = process.argv.slice(2);
const [b, r] = [base, rev].map((f) => JSON.parse(fs.readFileSync(f, 'utf8')));
const gone = Object.keys(b.paths || {}).filter((p) => !(p in (r.paths || {})));
if (gone.length) { console.log(gone.map((p) => 'error [api-path-removed] ' + p).join('\\n')); process.exit(1); }
console.log('No breaking changes');
`);
const ENV = { ...process.env, FORGE_REDOCLY: `node ${path.join(FAKES, 'redocly.mjs')}`, FORGE_OASDIFF: `node ${path.join(FAKES, 'oasdiff.mjs')}` };

const spec = (version, paths = ['/v1/users']) => JSON.stringify({ openapi: '3.1.0', info: { title: 'T', version }, paths: Object.fromEntries(paths.map((p) => [p, { get: { responses: { 200: { description: 'ok' } } } }])) }, null, 2);

function backend({ tag = true } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-api-')));
  sh(dir, 'git', 'init', '-q', '-b', 'main');
  sh(dir, 'git', 'config', 'user.email', 't@e'); sh(dir, 'git', 'config', 'user.name', 't');
  fs.mkdirSync(path.join(dir, 'api'));
  fs.writeFileSync(path.join(dir, 'api/openapi.json'), spec('1.0.0'));
  sh(dir, 'git', 'add', 'api'); sh(dir, 'git', 'commit', '-q', '-m', 'feat: api');
  if (tag) sh(dir, 'git', 'tag', 'api-v1.0.0');
  writeProjectConfig(dir, { project: { api: { spec: 'api/openapi.json' } } });
  return dir;
}
function forge(dir, ...args) {
  const r = spawnSync('node', [FORGE, ...args], { cwd: dir, env: ENV, encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}
const setSpec = (dir, version, paths) => fs.writeFileSync(path.join(dir, 'api/openapi.json'), spec(version, paths));

test('check: a first version has nothing to compare with', () => {
  const r = forge(backend({ tag: false }), 'api', 'check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /lint: ok\nbreaking changes: no approved version yet/);
});

test('check: an additive change needs a higher version; a minor bump is enough', () => {
  const dir = backend();
  setSpec(dir, '1.0.0', ['/v1/users', '/v1/orders']);
  let r = forge(dir, 'api', 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /breaking changes against api-v1\.0\.0 \(1\.0\.0\): none\nNOT OK: the spec changed: raise info\.version above 1\.0\.0/);
  setSpec(dir, '1.1.0', ['/v1/users', '/v1/orders']);
  r = forge(dir, 'api', 'check');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /ok: api\/openapi\.json version 1\.1\.0/);
});

test('check: a breaking change needs a new major version', () => {
  const dir = backend();
  setSpec(dir, '1.1.0', ['/v1/orders']);
  let r = forge(dir, 'api', 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /breaking changes against api-v1\.0\.0 \(1\.0\.0\): YES\nerror \[api-path-removed\] \/v1\/users/);
  assert.match(r.out, /NOT OK: a breaking change needs a new major version: 2\.0\.0 \(info\.version is 1\.1\.0\)/);
  setSpec(dir, '2.0.0', ['/v1/orders']);
  assert.equal(forge(dir, 'api', 'check').code, 0);
});

test('check: lint errors fail; an unchanged spec passes; the newest api-v tag is the base', () => {
  const dir = backend();
  assert.equal(forge(dir, 'api', 'check').code, 0, 'unchanged');
  setSpec(dir, '1.2.0', ['/v1/users', '/v1/orders']);
  sh(dir, 'git', 'commit', '-q', '-am', 'feat: orders'); sh(dir, 'git', 'tag', 'api-v1.2.0');
  sh(dir, 'git', 'tag', 'api-v1.10.0-rc'); // not a release tag: ignored
  setSpec(dir, '1.3.0', ['/v1/users', '/v1/orders', '/v1/items']);
  assert.match(forge(dir, 'api', 'check').out, /against api-v1\.2\.0 \(1\.2\.0\): none/);
  fs.writeFileSync(path.join(dir, 'api/openapi.json'), spec('1.3.0').replace('"T"', '"LINT-ERROR"'));
  const r = forge(dir, 'api', 'check');
  assert.equal(r.code, 1);
  assert.match(r.out, /lint: FAILED\nerror: LINT-ERROR found/);
});

test('check --spec: a draft outside the repo is compared with the approved version', () => {
  const dir = backend();
  const draft = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-draft-')), '12-orders.yaml');
  fs.writeFileSync(draft, spec('1.1.0', ['/v1/users', '/v1/orders']));
  const r = forge(dir, 'api', 'check', '--spec', draft);
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /against api-v1\.0\.0 \(1\.0\.0\): none/);
});

test('fetch and generate: a consumer repo builds from the pinned version of the backend repo', () => {
  const be = backend();
  setSpec(be, '1.1.0', ['/v1/users', '/v1/orders']);
  sh(be, 'git', 'commit', '-q', '-am', 'feat: orders'); sh(be, 'git', 'tag', 'api-v1.1.0');
  setSpec(be, '1.2.0', ['/v1/users', '/v1/orders', '/v1/unapproved']); // work in progress, not tagged
  const fe = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-fe-')));
  sh(fe, 'git', 'init', '-q', '-b', 'main');
  writeProjectConfig(fe, { project: { api: { spec: 'api/openapi.json', contractRepo: be, pin: 'api-v1.1.0', generate: 'mkdir -p src/gen && cp {spec} src/gen/spec.json', generatedDir: 'src/gen' } } });
  const f = forge(fe, 'api', 'fetch');
  assert.equal(f.code, 0, f.out);
  assert.equal(f.out.trim(), path.join(fe, '.forge/state/api/api-v1.1.0.json'));
  const g = forge(fe, 'api', 'generate');
  assert.equal(g.code, 0, g.out);
  assert.match(g.out, /generated from api-v1\.1\.0/);
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(path.join(fe, 'src/gen/spec.json'), 'utf8')).paths), ['/v1/users', '/v1/orders']);
  assert.match(forge(fe, 'api', 'check').out, /consumes the contract from .*: check it there/);
});

test('fetch without a pin, and an unknown pin, fail clearly', () => {
  const dir = backend();
  assert.match(forge(dir, 'api', 'fetch').out, /No pinned contract version: a person sets project\.api\.pin/);
  writeProjectConfig(dir, { project: { api: { spec: 'api/openapi.json', pin: 'api-v9.0.0' } } });
  const r = forge(dir, 'api', 'fetch');
  assert.equal(r.code, 2);
  assert.match(r.out, /api\/openapi\.json not found at api-v9\.0\.0/);
});
