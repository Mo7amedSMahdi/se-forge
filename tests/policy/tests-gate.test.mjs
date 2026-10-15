// Decision 50: a task is done only with tests - per side whose code changed, and end-to-end when the
// plan's E2E: line names a flow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { makeRepo, ctxFor, sh, writeProjectConfig, DEFAULT_TEST_CONFIG } from './helpers.mjs';
import { verifyDone } from '../../core/policy/lib/gates.mjs';

const TESTS = {
  sides: [
    { name: 'frontend', code: ['web/src/**/*.{ts,tsx}'], tests: ['web/src/**/*.test.{ts,tsx}'] },
    { name: 'backend', code: ['app/**/*.py'], tests: ['tests/**/*.py'], ignore: ['app/migrations/**'] },
  ],
  e2e: { tests: ['web/e2e/**'], command: 'test -f web/e2e/ran.txt || touch web/e2e/.e2e-ran-marker' },
};

function repo(e2eLine = 'E2E: a patient books a slot') {
  const { dir } = makeRepo();
  writeProjectConfig(dir, { policy: { ...DEFAULT_TEST_CONFIG, tests: TESTS } });
  fs.mkdirSync(path.join(dir, '.forge/project/plans'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.forge/project/plans/21-book.md'), `# Book (#21)\nBranch: \`feat/1-login\`\nGates: none\n${e2eLine}\n`);
  return dir;
}
function commit(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
    sh(dir, 'git', 'add', rel);
  }
  sh(dir, 'git', 'commit', '-q', '-m', 'feat: x');
  sh(dir, 'git', 'push', '-q', '-u', 'origin', 'feat/1-login');
}
const done = (dir) => verifyDone(ctxFor(dir), dir);

test('backend code without a backend test is not done; with one it is', () => {
  const dir = repo('E2E: not applicable (API only, no screen changes)');
  commit(dir, { 'app/booking.py': 'x = 1\n' });
  assert.match(done(dir).reason, /The backend code changed \(app\/booking\.py\) but no backend test was added or changed/);
  commit(dir, { 'tests/test_booking.py': 'def test_x(): pass\n' });
  assert.equal(done(dir).ok, true);
});

test('each side needs its own tests: frontend and backend', () => {
  const dir = repo('E2E: not applicable (covered by the booking flow ticket #20)');
  commit(dir, { 'app/booking.py': 'x = 1\n', 'tests/test_booking.py': 't\n', 'web/src/Book.tsx': 'export {}\n' });
  assert.match(done(dir).reason, /The frontend code changed \(web\/src\/Book\.tsx\)/);
  commit(dir, { 'web/src/Book.test.tsx': 't\n' });
  assert.equal(done(dir).ok, true);
});

test('migrations alone need no new test (the test setup migrates up, down and up)', () => {
  const dir = repo('E2E: not applicable (schema only, no behaviour yet)');
  commit(dir, { 'app/migrations/0002_slots.py': 'x\n' });
  assert.equal(done(dir).ok, true);
});

test('the plan must say whether end-to-end tests apply, with a reason when they do not', () => {
  let dir = repo('');
  commit(dir, { 'docs/x.md': 'x\n' });
  assert.match(done(dir).reason, /21-book\.md has no E2E: line/);
  dir = repo('E2E: not applicable');
  commit(dir, { 'docs/x.md': 'x\n' });
  assert.match(done(dir).reason, /needs the reason in brackets/);
});

test('a named flow needs an end-to-end test change, and the end-to-end command runs with the gates', () => {
  const dir = repo('E2E: a patient books a slot');
  commit(dir, { 'web/src/Book.tsx': 'x\n', 'web/src/Book.test.tsx': 't\n' });
  assert.match(done(dir).reason, /says E2E: a patient books a slot, but the branch changes no end-to-end test \(web\/e2e\/\*\*\)/);
  commit(dir, { 'web/e2e/book.spec.ts': 't\n' });
  const r = done(dir);
  assert.equal(r.ok, true, r.reason);
  const gates = JSON.parse(fs.readFileSync(path.join(dir, '.forge/state/gates.json'), 'utf8'));
  assert.match(Object.values(gates).pop().cmd, /^\(sh \.\/check\.sh\) && \(test -f web\/e2e\/ran\.txt/);
});

test('the end-to-end command runs from the repo root, whatever folder the gate command ends in', () => {
  // As forge new writes them for two folders: the gate ends inside the frontend, the e2e command cds into it.
  const { dir } = makeRepo();
  writeProjectConfig(dir, { policy: { ...DEFAULT_TEST_CONFIG, gates: { full: 'sh ./check.sh && cd web' }, tests: { ...TESTS, e2e: { ...TESTS.e2e, command: 'cd web && test -f e2e/book.spec.ts' } } } });
  fs.mkdirSync(path.join(dir, '.forge/project/plans'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.forge/project/plans/21-book.md'), '# Book (#21)\nBranch: `feat/1-login`\nGates: none\nE2E: a patient books a slot\n');
  commit(dir, { 'web/src/Book.tsx': 'x\n', 'web/src/Book.test.tsx': 't\n', 'web/e2e/book.spec.ts': 't\n' });
  const r = done(dir);
  assert.equal(r.ok, true, r.reason);
});

test('no plan for the branch: the E2E rule cannot be judged, so not done', () => {
  const dir = repo();
  fs.rmSync(path.join(dir, '.forge/project/plans/21-book.md'));
  commit(dir, { 'docs/x.md': 'x\n' });
  assert.match(done(dir).reason, /No plan in \.forge\/project\/plans\/ has "Branch: feat\/1-login"/);
});

test('projects without policy.tests keep the old behaviour', () => {
  const { dir } = makeRepo();
  commit(dir, { 'app/booking.py': 'x = 1\n' });
  assert.equal(done(dir).ok, true);
});
