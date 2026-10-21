// The OpenProject adapter against a fake curl that logs each request and answers like REST API v3.
// Runs under /bin/bash (3.2 on macOS). The fake also checks the API key never reaches curl's arguments.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TRACKER = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../core/tracker/tracker.sh');
const KEY = 'op-secret-key-123';

const FAKE = String.raw`#!/usr/bin/env node
const fs = require('fs');
const a = process.argv.slice(2);
const at = (f) => { const k = a.indexOf(f); return k < 0 ? null : a[k + 1]; };
const method = at('-X') || 'GET';
const url = new URL(a[a.length - 1]);
const p = url.pathname.replace(/^\/api\/v3/, '');
const cfg = at('-K') ? fs.readFileSync(at('-K'), 'utf8') : '';
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ method, path: p, query: url.search, body: at('--data-binary'), argv: a.join(' '), auth: cfg.includes('apikey:' + process.env.OPENPROJECT_API_KEY) }) + '\n');
const wp = (id, status, subject) => ({ id, subject, lockVersion: 3, description: { raw: 'desc' }, createdAt: '2026-10-07T08:00:00Z', updatedAt: '2026-10-07T09:00:00Z',
  _links: { status: { title: status, href: '/api/v3/statuses/' + (status === 'Todo' ? 1 : 7) }, type: { title: 'Task' }, assignee: { title: 'Amal' }, author: { title: 'Amal' } } });
const orders = JSON.parse(process.env.FAKE_ORDERS || '{"11":{"42":0},"12":{}}');
let r = null;
if (p === '/work_packages/42') r = wp(42, 'Todo', 'Login');
else if (p === '/statuses') r = { _embedded: { elements: [{ name: 'Todo', isClosed: false, _links: { self: { href: '/api/v3/statuses/1' } } }, { name: 'In Development', _links: { self: { href: '/api/v3/statuses/7' } } }, { name: 'Closed', isClosed: true, _links: { self: { href: '/api/v3/statuses/12' } } }] } };
else if (/\/types$/.test(p)) r = { _embedded: { elements: [{ name: 'Task', _links: { self: { href: '/api/v3/types/1' } } }, { name: 'Bug', _links: { self: { href: '/api/v3/types/7' } } }] } };
else if (/\/work_packages$/.test(p) && method === 'GET') r = { _embedded: { elements: [wp(42, 'Todo', 'Login'), wp(43, 'In Development', 'Orders')] } };
else if (p === '/grids/5') r = { widgets: [{ startColumn: 2, options: { queryId: 12 } }, { startColumn: 1, options: { queryId: 11 } }] };
else if (/^\/queries\/\d+\/order$/.test(p)) r = method === 'GET' ? orders[p.split('/')[2]] : {};
else if (/^\/queries\/\d+$/.test(p)) r = { name: p.endsWith('11') ? 'Todo' : 'In Process', _embedded: { results: { _embedded: { elements: p.endsWith('11') ? [wp(42, 'Todo', 'Login')] : [] } } } };
else if (method === 'PATCH' || method === 'POST') r = {};
process.stdout.write(JSON.stringify(r ?? { message: 'not found' }) + '\n' + (r ? 200 : 404));
`;

function op(args, env = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-op-'));
  fs.writeFileSync(path.join(dir, 'curl'), FAKE, { mode: 0o755 });
  const log = path.join(dir, 'calls.log');
  fs.writeFileSync(log, '');
  const r = spawnSync('/bin/bash', [TRACKER, ...args], {
    encoding: 'utf8', cwd: dir,
    env: { PATH: `${dir}:${process.env.PATH}`, HOME: dir, FORGE_TRACKER: 'openproject', FAKE_LOG: log, OPENPROJECT_URL: 'https://op.example.com/', OPENPROJECT_API_KEY: KEY, OPENPROJECT_PROJECT: 'https://op.example.com/projects/ird/work_packages', ...env },
  });
  const calls = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  for (const c of calls) { assert.ok(c.auth, 'the key is sent'); assert.ok(!c.argv.includes(KEY), 'the key is never an argument'); }
  assert.ok(!`${r.stdout}${r.stderr}`.includes(KEY), 'the key is never printed');
  return { code: r.status, out: r.stdout, err: r.stderr, calls, writes: calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.path} ${c.body ?? ''}`.trim()) };
}

test('openproject: a missing setting is named, never its value', () => {
  const r = op(['get', '42'], { OPENPROJECT_API_KEY: '' });
  assert.equal(r.code, 2);
  assert.match(r.err, /OPENPROJECT_API_KEY is not set/);
  assert.deepEqual(r.calls, []);
});

test('openproject: get prints a summary, from a project given as a pasted URL', () => {
  const r = op(['get', '42']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^#42 Login {2}status=Todo {2}type=Task {2}assignee=Amal\nurl: https:\/\/op\.example\.com\/work_packages\/42\n--- description\ndesc/);
  const list = op(['list', 'open']);
  assert.ok(list.calls.some((c) => c.path === '/projects/ird/work_packages'), list.calls.map((c) => c.path).join('\n'));
});

test('openproject: list board groups by status without a board', () => {
  const r = op(['list', 'board']);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /== In Development\n {2}#43 Orders {2}Amal\n== Todo\n {2}#42 Login {2}Amal/);
});

test('openproject: list board shows a basic board\'s columns left to right', () => {
  const r = op(['list', 'board'], { OPENPROJECT_BOARD: '5' });
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /^== Todo\n {2}#42 Login {2}\[Todo\] {2}Amal\n== In Process\n$/);
});

test('openproject: status sets the status, comments, and moves the card to the matching column', () => {
  const r = op(['status', '42', 'In Development', '--comment', 'branch feat/42'], { OPENPROJECT_BOARD: '5' });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.writes, [
    'PATCH /work_packages/42 {"lockVersion":3,"_links":{"status":{"href":"/api/v3/statuses/7"}}}',
    'POST /work_packages/42/activities {"comment":{"raw":"branch feat/42"}}',
    'PATCH /queries/11/order {"delta":{"42":-1}}',
    'PATCH /queries/12/order {"delta":{"42":0}}',
  ]);
  assert.match(r.out, /#42 -> status In Development\ncard moved to 'In Process' on board 5/);
  const none = op(['status', '42', 'Nope']);
  assert.notEqual(none.code, 0);
  assert.match(none.err, /no status named 'Nope'/);
});

test('openproject: create in a dry run writes nothing and keeps labels in the description', () => {
  const r = op(['create', '--subject', '[Bug] x', '--type', 'Bug', '--source', 'ai', '--area', 'ui', '--board', '5', '--column', 'Todo'], { TRACKER_DRY_RUN: '1' });
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.writes, []);
  assert.match(r.err, /DRY RUN: POST \/projects\/ird\/work_packages subject='\[Bug\] x' type=Bug status=Todo/);
  assert.match(r.err, /DRY RUN: place the card in 'Todo' on board 5/);
  const live = op(['create', '--subject', 'y', '--source', 'ai']);
  assert.ok(live.writes[0].startsWith('POST /projects/ird/work_packages') && live.writes[0].includes('Labels: source::ai'), live.writes.join('\n'));
});

test('openproject: list json has the shape every adapter prints', () => {
  const r = op(['list', 'json']);
  assert.deepEqual(JSON.parse(r.out)[0], { id: 42, title: 'Login', labels: ['type::Task', 'status::Todo'], state: 'opened', createdAt: '2026-10-07T08:00:00Z', updatedAt: '2026-10-07T09:00:00Z', author: 'Amal', url: 'https://op.example.com/work_packages/42' });
});
