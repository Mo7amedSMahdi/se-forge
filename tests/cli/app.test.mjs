// forge app (decision 123): the app's Compose file, its services and addresses, and up/down, against a fake docker
// that logs its calls. The real thing ran on a throwaway project (caddy and alpine) when this was built.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sh } from '../policy/helpers.mjs';
import { findApp, appServices, app, AppError } from '../../core/cli/app.mjs';

const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const CONFIG = { name: 'lunch-pool', services: { api: {}, db: { ports: [{ target: 27017, published: '27017' }] }, web: { ports: [{ target: 5173, published: '5173' }] } } };

function project({ daemon = true } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-app-')));
  write(path.join(dir, 'frontend/compose.yaml'), 'name: lunch-pool\ninclude:\n  - path: ../backend/compose.yaml\nservices:\n  web: {}\n');
  write(path.join(dir, 'backend/compose.yaml'), 'services:\n  db: {}\n  api: {}\n');
  sh(dir, 'git', 'init', '-q', '-b', 'dev');
  sh(dir, 'git', '-c', 'user.email=t@e', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  const log = path.join(dir, '.docker.log');
  write(path.join(dir, '.bin/docker'), `#!/bin/sh
echo "$PWD: $*" >> "${log}"
case "$1 $2" in
  "compose config") echo '${JSON.stringify(CONFIG)}' ;;
  "compose ps") printf '%s\\n' '{"Service":"web","State":"running","Health":"healthy"}' '{"Service":"api","State":"running","Health":"healthy"}' ;;
  "info --format") ${daemon ? 'echo 29.8.2' : 'echo "Cannot connect to the Docker daemon" >&2; exit 1'} ;;
  "compose up"|"compose down") echo done ;;
  *) exit 1 ;;
esac
`);
  fs.chmodSync(path.join(dir, '.bin/docker'), 0o755);
  const env = { ...process.env, PATH: `${path.join(dir, '.bin')}:${process.env.PATH}` };
  const run = (...args) => { const lines = []; const code = app({ _: args.filter((a) => !a.startsWith('--')), ...Object.fromEntries(args.filter((a) => a.startsWith('--')).map((a) => [a.slice(2), true])) }, { main: dir, env, out: (l) => lines.push(l) }); return { code, out: lines.join('\n') }; };
  return { dir, env, run, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n') : []) };
}

test('the app is the Compose file no other includes: frontend/ over the backend it includes; the root first', () => {
  const p = project();
  assert.deepEqual(findApp(p.dir), { dir: 'frontend', file: 'compose.yaml' });
  write(path.join(p.dir, 'mobile/compose.yaml'), 'include:\n  - ../backend/compose.yaml\n');
  assert.deepEqual(findApp(p.dir), { dir: 'frontend', file: 'compose.yaml' }, 'in the order: root, frontend, …, mobile');
  write(path.join(p.dir, 'docker-compose.yml'), 'services:\n  app: {}\n');
  assert.deepEqual(findApp(p.dir), { dir: '', file: 'docker-compose.yml' });
  const solo = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-app-'));
  write(path.join(solo, 'backend/compose.yml'), 'services:\n  api: {}\n');
  assert.deepEqual(findApp(solo), { dir: 'backend', file: 'compose.yml' }, 'a backend-only repository');
  assert.equal(findApp(fs.mkdtempSync(path.join(os.tmpdir(), 'forge-app-'))), null);
});

test('services and addresses: a web port is a link, a database port an address, the web service is the one to open', () => {
  const p = project();
  const s = appServices(path.join(p.dir, 'frontend'), p.env);
  assert.equal(s.project, 'lunch-pool');
  assert.equal(s.url, 'http://localhost:5173');
  assert.deepEqual(s.services.map((x) => [x.name, x.ports.map((q) => q.url ?? q.address)]), [['api', []], ['db', ['localhost:27017']], ['web', ['http://localhost:5173']]]);
});

test('forge app shows what runs; up builds, starts and waits in the app\'s folder; --fresh renews; down stops', () => {
  const p = project();
  let r = p.run();
  assert.equal(r.code, 0);
  assert.match(r.out, /^lunch-pool \(frontend\/compose\.yaml\):\n {2}api: running \(healthy\)\n {2}db: not running · localhost:27017\n {2}web: running \(healthy\) · http:\/\/localhost:5173\nOpen http:\/\/localhost:5173\.$/);
  r = p.run('up', '--no-open');
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /^Building and starting api, db, web \(frontend\/compose\.yaml\) from the code checked out in forge-app-\w+: dev at [0-9a-f]{7}\./);
  assert.match(r.out, /Running\. Open http:\/\/localhost:5173\. Stop it with forge app down\.$/);
  assert.ok(p.calls().includes(`${path.join(p.dir, 'frontend')}: compose up -d --build --wait`), p.calls().join('\n'));
  p.run('up', '--fresh', '--no-open');
  assert.ok(p.calls().includes(`${path.join(p.dir, 'frontend')}: compose up -d --build --wait --renew-anon-volumes`));
  assert.equal(p.run('down').code, 0);
  assert.ok(p.calls().includes(`${path.join(p.dir, 'frontend')}: compose down`), 'the volumes stay: no -v');
});

test('Docker not running, no Compose file, an unknown verb: each says what to do', () => {
  const p = project({ daemon: false });
  assert.throws(() => p.run('up'), (e) => e instanceof AppError && /Docker is not running: open Docker Desktop/.test(e.message));
  assert.ok(!p.calls().some((c) => /compose up/.test(c)), 'nothing started');
  assert.throws(() => p.run('sideways'), /forge app \[up/);
  fs.rmSync(path.join(p.dir, 'frontend'), { recursive: true });
  fs.rmSync(path.join(p.dir, 'backend'), { recursive: true });
  assert.throws(() => p.run(), /No Compose file in this project .*forge new adds one/);
});
